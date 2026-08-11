import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditLog, AuditSource } from './entities/audit-log.entity';

export interface RecordAuditEntryInput {
  shareId: string;
  fromState: string | null;
  toState: string;
  actor: string | null;
  source: AuditSource;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogService {
  async record(manager: EntityManager, input: RecordAuditEntryInput): Promise<AuditLog> {
    const entry = manager.create(AuditLog, {
      shareId: input.shareId,
      fromState: input.fromState,
      toState: input.toState,
      actor: input.actor,
      source: input.source,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    });
    return manager.save(entry);
  }
}
