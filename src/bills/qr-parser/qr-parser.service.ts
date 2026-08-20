import { Injectable, Logger } from '@nestjs/common';
import { BillLineItem } from '../entities/bill.entity';

export interface ParsedBillData {
  venueName?: string;
  lineItems: BillLineItem[];
  subtotal?: number;
  tax?: number;
  taxType?: 'percent' | 'amount';
  delivery?: number;
  deliveryType?: 'percent' | 'amount';
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
    this.strategies = [new EtaReceiptStrategy(), new FoodicsStrategy(), new SchemaOrgStrategy()];
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
// ETA (Egyptian Tax Authority) receipt strategy
// ──────────────────────────────────────────────────────────────

const ETA_SHARE_RE =
  /invoicing\.eta\.gov\.eg\/receipts\/search\/([0-9a-f]{64})\/share\/([^?#\s]+)/i;

const ETA_API_BASE = 'https://api-portal.invoicing.eta.gov.eg';

class EtaReceiptStrategy implements QrStrategy {
  name = 'ETA';

  canParse(payload: string): boolean {
    return ETA_SHARE_RE.test(payload);
  }

  async parse(payload: string): Promise<ParsedBillData | null> {
    const match = ETA_SHARE_RE.exec(payload);
    if (!match) return null;

    const [, hash, rawDate] = match;
    const dateTimeIssued = normalizeEtaDate(rawDate);

    const apiUrl =
      `${ETA_API_BASE}/api/v1/receipts/${hash}/share` +
      `?dateTimeIssued=${encodeURIComponent(dateTimeIssued)}`;

    const res = await fetch(apiUrl, {
      headers: {
        Accept: 'text/plain',
        Origin: 'https://invoicing.eta.gov.eg',
        Referer: 'https://invoicing.eta.gov.eg/',
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    return mapEtaReceipt(data, payload);
  }
}

function normalizeEtaDate(raw: string): string {
  const decoded = decodeURIComponent(raw);
  // "T14:52:Z"   → "T14:52:00.000Z"
  // "T14:52:30Z" → "T14:52:30.000Z"
  return decoded
    .replace(/T(\d{2}:\d{2}):Z$/, 'T$1:00.000Z')
    .replace(/T(\d{2}:\d{2}:\d{2})Z$/, 'T$1.000Z');
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function mapEtaReceipt(data: any, sourceRef: string): ParsedBillData | null {
  const r = data?.receipt;
  if (!r) return null;

  const lineItems: BillLineItem[] = (r.itemData ?? []).map((item: any) => {
    const qty = Number(item.quantity ?? 1) || 1;
    const lineTotal = Number(item.total ?? item.netTotal ?? NaN);
    const unitFromTotal = Number.isFinite(lineTotal) ? lineTotal / qty : NaN;
    const unitPrice = Number.isFinite(unitFromTotal)
      ? round2(unitFromTotal)
      : round2(Number(item.unitPrice ?? 0));
    return {
      name: item.description ?? item.itemCodeName ?? 'صنف',
      qty,
      unitPrice,
    };
  });

  if (lineItems.length === 0) return null;

  const itemsSubtotal = round2(lineItems.reduce((sum, it) => sum + it.unitPrice * it.qty, 0));

  let receiptDiscount = 0;
  for (const d of r.extraReceiptDiscountData ?? r.discountData ?? []) {
    receiptDiscount += Number(d.amount ?? d.discountAmount ?? 0);
  }
  receiptDiscount = Math.abs(receiptDiscount);

  let vatAmount = 0;
  let otherTaxAmount = 0;
  for (const t of r.taxTotals ?? []) {
    const amount = Number(t.amount ?? 0);
    if (!amount) continue;
    const code = String(t.taxType ?? t.type ?? t.taxTypeCode ?? '').toUpperCase();
    if (code.includes('T1') || code.includes('VAT') || code.includes('ضريبة القيمة')) {
      vatAmount += amount;
    } else {
      otherTaxAmount += amount;
    }
  }

  // Prefer ETA totalAmount as the receipt truth when present.
  const totalAmount = r.totalAmount != null ? Number(r.totalAmount) : undefined;
  const netAmount = r.netAmount != null ? Number(r.netAmount) : undefined;
  const targetTotal =
    totalAmount ??
    (netAmount != null ? netAmount + vatAmount + otherTaxAmount - receiptDiscount : undefined);
  const extrasAlreadyIncluded =
    targetTotal != null && Math.abs(itemsSubtotal - targetTotal) <= 0.05;

  const result: ParsedBillData = {
    venueName: r.seller?.sellerName ?? undefined,
    lineItems,
    subtotal: extrasAlreadyIncluded ? itemsSubtotal : (netAmount ?? itemsSubtotal - receiptDiscount),
    captureMethod: 'qr',
    sourceRef,
  };

  // Don't invent tax when line totals already ≈ receipt total.
  if (!extrasAlreadyIncluded) {
    if (otherTaxAmount > 0) {
      result.tax = otherTaxAmount;
      result.taxType = 'amount';
    }
    if (vatAmount > 0 && targetTotal != null && targetTotal > itemsSubtotal + 0.05) {
      result.tax = (result.tax ?? 0) + vatAmount;
      result.taxType = 'amount';
    }
  }

  return result;
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
    unitPrice: round2(Number(it.price ?? it.unit_price ?? 0)),
  }));

  return {
    venueName: data.branch_name ?? data.store_name ?? data.restaurant_name,
    lineItems,
    subtotal: data.subtotal != null ? Number(data.subtotal) : undefined,
    tax: data.tax != null ? Number(data.tax) : undefined,
    taxType: 'amount',
    delivery: data.service_charge != null ? Number(data.service_charge) : undefined,
    deliveryType: 'amount',
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
      unitPrice: round2(Number(it.orderedItem?.offers?.price ?? it.price ?? 0)),
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
