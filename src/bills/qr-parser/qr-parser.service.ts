import { Injectable, Logger } from '@nestjs/common';
import { BillLineItem } from '../entities/bill.entity';

export interface ParsedBillData {
  venueName?: string;
  lineItems: BillLineItem[];
  subtotal?: number;
  tax?: number;
  taxType?: 'percent' | 'amount';
  service?: number;
  serviceType?: 'percent' | 'amount';
  captureMethod: 'qr';
  sourceRef: string;
}

export type QrParseResult =
  | { success: true; bill: ParsedBillData }
  | { success: false; fallback: 'webview'; url: string }
  | { success: false; fallback: 'manual'; reason: string };

interface QrStrategy {
  name: string;
  canParse(payload: string): boolean;
  parse(payload: string): Promise<ParsedBillData | null>;
}

@Injectable()
export class QrParserService {
  private readonly logger = new Logger(QrParserService.name);
  private readonly strategies: QrStrategy[] = [];

  constructor() {
    this.strategies = [new FoodicsStrategy(), new SchemaOrgStrategy()];
  }

  async parse(payload: string): Promise<QrParseResult> {
    const trimmed = payload.trim();

    let isUrl = false;
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(trimmed);
      isUrl = true;
    } catch {
      isUrl = false;
    }

    if (!isUrl) {
      return { success: false, fallback: 'manual', reason: 'QR payload is not a URL' };
    }

    const matchingStrategies = this.strategies.filter((s) => s.canParse(trimmed));

    for (const strategy of matchingStrategies) {
      try {
        const result = await withTimeout(strategy.parse(trimmed), 10_000);
        if (result) {
          this.logger.log(`[QR] Parsed by strategy: ${strategy.name}`);
          return { success: true, bill: result };
        }
      } catch (err: any) {
        this.logger.warn(`[QR] Strategy ${strategy.name} failed: ${err?.message}`);
      }
    }

    // Generic URL — try fetch + heuristic extraction
    try {
      const result = await withTimeout(genericHeuristicParse(trimmed), 10_000);
      if (result) {
        return { success: true, bill: result };
      }
    } catch (err: any) {
      this.logger.warn(`[QR] Generic heuristic failed: ${err?.message}`);
    }

    // Fall through to web-view fallback
    return { success: false, fallback: 'webview', url: trimmed };
  }
}

// ──────────────────────────────────────────────────────────────
// Foodics strategy
// ──────────────────────────────────────────────────────────────

class FoodicsStrategy implements QrStrategy {
  name = 'Foodics';

  canParse(payload: string): boolean {
    try {
      const u = new URL(payload);
      return u.hostname.includes('foodics.com') || u.hostname.includes('fds.st');
    } catch {
      return false;
    }
  }

  async parse(payload: string): Promise<ParsedBillData | null> {
    const res = await fetch(payload, {
      headers: { Accept: 'application/json, text/html' },
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const json = await res.json();
      return parseFoodicsJson(json, payload);
    }

    const html = await res.text();
    return parseFoodicsHtml(html, payload);
  }
}

function parseFoodicsJson(data: any, sourceRef: string): ParsedBillData | null {
  if (!data) return null;

  const lineItems: BillLineItem[] = (data.items ?? data.order_items ?? []).map((it: any) => ({
    name: it.name ?? it.item_name ?? 'صنف',
    qty: Number(it.quantity ?? it.qty ?? 1),
    unitPrice: Number(it.price ?? it.unit_price ?? 0),
  }));

  return {
    venueName: data.branch_name ?? data.store_name ?? data.restaurant_name,
    lineItems,
    subtotal: data.subtotal != null ? Number(data.subtotal) : undefined,
    tax: data.tax != null ? Number(data.tax) : undefined,
    taxType: 'amount',
    service: data.service_charge != null ? Number(data.service_charge) : undefined,
    serviceType: 'amount',
    captureMethod: 'qr',
    sourceRef,
  };
}

function parseFoodicsHtml(html: string, sourceRef: string): ParsedBillData | null {
  // Look for embedded JSON state (Foodics embeds receipt data in a script tag)
  const patterns = [
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/,
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    try {
      const data = JSON.parse(match[1]);
      // Traverse nested structures to find receipt data
      const receipt = findReceiptInObject(data);
      if (receipt) return parseFoodicsJson(receipt, sourceRef);
    } catch {
      continue;
    }
  }

  return null;
}

function findReceiptInObject(obj: any, depth = 0): any {
  if (depth > 6 || !obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj.items) || Array.isArray(obj.order_items)) return obj;
  for (const val of Object.values(obj)) {
    const found = findReceiptInObject(val, depth + 1);
    if (found) return found;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Schema.org / JSON-LD strategy
// ──────────────────────────────────────────────────────────────

class SchemaOrgStrategy implements QrStrategy {
  name = 'SchemaOrg';

  canParse(payload: string): boolean {
    try {
      new URL(payload);
      return true;
    } catch {
      return false;
    }
  }

  async parse(payload: string): Promise<ParsedBillData | null> {
    const res = await fetch(payload, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const html = await res.text();
    const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const raw = JSON.parse(match[1]);
        const nodes: any[] = Array.isArray(raw) ? raw : [raw];
        for (const node of nodes) {
          if (node['@type'] === 'Receipt' || node['@type'] === 'Invoice') {
            return this.extractFromSchemaNode(node, payload);
          }
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private extractFromSchemaNode(node: any, sourceRef: string): ParsedBillData {
    const lineItems: BillLineItem[] = (node.referencesOrder?.orderedItem ?? []).map((it: any) => ({
      name: it.orderedItem?.name ?? it.name ?? 'صنف',
      qty: Number(it.orderQuantity ?? 1),
      unitPrice: Number(it.orderedItem?.offers?.price ?? it.price ?? 0),
    }));

    const totalPrice = node.totalPaymentDue?.price ?? node.referencesOrder?.totalPrice;

    return {
      venueName: node.broker?.name ?? node.seller?.name ?? node.provider?.name,
      lineItems,
      subtotal: totalPrice != null ? Number(totalPrice) : undefined,
      captureMethod: 'qr',
      sourceRef,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Generic heuristic (last resort before webview)
// ──────────────────────────────────────────────────────────────

async function genericHeuristicParse(url: string): Promise<ParsedBillData | null> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json, text/html' },
    redirect: 'follow',
  });
  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;

  const data = await res.json();
  if (!data || typeof data !== 'object') return null;

  const receipt = findReceiptInObject(data);
  if (!receipt) return null;

  return parseFoodicsJson(receipt, url);
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}
