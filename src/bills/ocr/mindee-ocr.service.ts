import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mindee from 'mindee';
import { BillLineItem } from '../entities/bill.entity';

export interface ParsedReceiptData {
  venueName?: string;
  lineItems: BillLineItem[];
  tax?: number;
  taxType?: 'percent' | 'amount';
  service?: number;
  serviceType?: 'percent' | 'amount';
  captureMethod: 'ocr';
  sourceRef: string;
}

export type OcrParseResult =
  | { success: true; bill: ParsedReceiptData }
  | { success: false; fallback: 'manual'; reason: string };

@Injectable()
export class MindeeOcrService {
  private readonly logger = new Logger(MindeeOcrService.name);

  constructor(private readonly config: ConfigService) {}

  async parseReceipt(buffer: Buffer, filename: string): Promise<OcrParseResult> {
    const apiKey = this.config.get<string>('MINDEE_API_KEY');
    const modelId = this.config.get<string>('MINDEE_MODEL_ID');
    if (!apiKey || !modelId) {
      return { success: false, fallback: 'manual', reason: 'OCR service not configured' };
    }

    try {
      const client = new mindee.Client({ apiKey });
      const inputSource = new mindee.BufferInput({ buffer, filename });

      const response = await client.enqueueAndGetResult(mindee.product.Extraction, inputSource, {
        modelId,
      });

      const fields = response.inference.result.fields;
      const lineItems = this.extractLineItems(fields);
      if (lineItems.length === 0) {
        return { success: false, fallback: 'manual', reason: 'NO_LINE_ITEMS_DETECTED' };
      }

      let venueName: string | undefined;
      try {
        venueName = fields.getSimpleField('supplier_name').stringValue ?? undefined;
      } catch {
        venueName = undefined;
      }

      let tax: number | undefined;
      try {
        tax = fields.getSimpleField('total_tax').numberValue ?? undefined;
      } catch {
        tax = undefined;
      }

      return {
        success: true,
        bill: {
          venueName,
          lineItems,
          tax,
          taxType: tax !== undefined ? 'amount' : undefined,
          captureMethod: 'ocr',
          sourceRef: `mindee:${filename}`,
        },
      };
    } catch (err: any) {
      this.logger.warn(`[OCR] Mindee parse failed: ${err?.message}`);
      return { success: false, fallback: 'manual', reason: 'OCR_FAILED' };
    }
  }

  private extractLineItems(fields: mindee.v2.parsing.field.InferenceFields): BillLineItem[] {
    const items: BillLineItem[] = [];
    let list;
    try {
      list = fields.getListField('line_items');
    } catch {
      return items;
    }

    for (const item of list.objectItems) {
      const name = item.simpleFields.get('description')?.stringValue;
      if (!name) continue;
      const qty = item.simpleFields.get('quantity')?.numberValue;
      const unitPrice = item.simpleFields.get('unit_price')?.numberValue;
      items.push({
        name,
        qty: qty && qty > 0 ? qty : 1,
        unitPrice: unitPrice ?? 0,
      });
    }
    return items;
  }
}
