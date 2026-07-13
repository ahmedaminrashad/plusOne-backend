import { Injectable, ConflictException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { Share, ShareStatus, ShareFailureReason } from './entities/share.entity';
import { Bill } from '../bills/entities/bill.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditSource } from '../audit/entities/audit-log.entity';

const ALLOWED_TRANSITIONS: Record<ShareStatus, ShareStatus[]> = {
  [ShareStatus.PENDING]: [ShareStatus.INITIATED, ShareStatus.CANCELLED],
  [ShareStatus.FAILED]: [ShareStatus.INITIATED],
  [ShareStatus.INITIATED]: [ShareStatus.PENDING, ShareStatus.SETTLED, ShareStatus.FAILED],
  [ShareStatus.SETTLED]: [ShareStatus.FAILED],
  [ShareStatus.CANCELLED]: [],
};

export interface TransitionOptions {
  actor: string | null;
  source: AuditSource;
  reason?: string | null;
  failureReason?: ShareFailureReason | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class SharesStateService {
  constructor(private readonly auditLog: AuditLogService) {}

  async transition(
    manager: EntityManager,
    share: Share,
    toState: ShareStatus,
    options: TransitionOptions,
  ): Promise<Share> {
    const allowed = ALLOWED_TRANSITIONS[share.status] ?? [];
    if (!allowed.includes(toState)) {
      throw new ConflictException('INVALID_SHARE_TRANSITION');
    }

    const fromState = share.status;
    share.status = toState;

    if (toState === ShareStatus.INITIATED) {
      share.initiatedAt = new Date();
      share.failureReason = null;
    }
    if (toState === ShareStatus.PENDING) {
      share.initiatedAt = null;
      share.failureReason = null;
    }
    if (toState === ShareStatus.FAILED) {
      share.failureReason = options.failureReason ?? null;
    }
    if (toState === ShareStatus.SETTLED) {
      share.failureReason = null;
    }

    const saved = await manager.save(share);

    // Once a member starts (or completes) paying, item claims can no longer be
    // edited out from under an in-flight/settled amount — lock the bill for good.
    if (toState === ShareStatus.INITIATED || toState === ShareStatus.SETTLED) {
      await manager.update(Bill, { id: share.billId, closedAt: IsNull() }, { closedAt: new Date() });
    }

    await this.auditLog.record(manager, {
      shareId: saved.id,
      fromState,
      toState,
      actor: options.actor,
      source: options.source,
      reason: options.reason,
      metadata: options.metadata,
    });

    return saved;
  }
}
