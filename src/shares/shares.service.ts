import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { Share, ShareStatus, ShareMethod } from './entities/share.entity';
import { Bill } from '../bills/entities/bill.entity';
import { GroupMember, MemberStatus } from '../groups/entities/group-member.entity';
import { CreateShareDto } from './dto/create-share.dto';
import { FailShareDto } from './dto/fail-share.dto';
import { SharesStateService } from './shares-state.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditSource } from '../audit/entities/audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function formatEgp(amountPiastres: number): string {
  return (amountPiastres / 100).toFixed(2);
}

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(
    @InjectRepository(Share) private sharesRepo: Repository<Share>,
    @InjectRepository(GroupMember) private membersRepo: Repository<GroupMember>,
    private readonly dataSource: DataSource,
    private readonly stateService: SharesStateService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  async createSharesForBill(
    manager: EntityManager,
    bill: Bill,
    dtos: CreateShareDto[],
  ): Promise<Share[]> {
    if (!dtos || dtos.length === 0) return [];

    const memberIds = dtos.map((d) => d.groupMemberId);
    const members = await manager.find(GroupMember, {
      where: { id: In(memberIds), groupId: bill.groupId, status: MemberStatus.ACTIVE },
    });
    const memberById = new Map(members.map((m) => [m.id, m]));

    let totalPiastres = 0;
    const toCreate: Partial<Share>[] = [];

    for (const dto of dtos) {
      const member = memberById.get(dto.groupMemberId);
      if (!member) {
        throw new BadRequestException(
          `Group member ${dto.groupMemberId} is not an active member of this group`,
        );
      }
      if (member.userId && member.userId === bill.paidByUserId) {
        throw new BadRequestException('The bill payer cannot owe a share of their own bill');
      }
      totalPiastres += dto.amountPiastres;
      toCreate.push({
        billId: bill.id,
        groupId: bill.groupId,
        initiatorUserId: bill.paidByUserId,
        ownerUserId: member.userId ?? null,
        ownerPendingPhone: member.userId ? null : member.pendingPhone,
        amountPiastres: dto.amountPiastres,
        currency: bill.currency,
        status: ShareStatus.PENDING,
        method: ShareMethod.INSTAPAY,
      });
    }

    const billTotalPiastres = Math.round(Number(bill.amount) * 100);
    if (totalPiastres > billTotalPiastres) {
      throw new BadRequestException(
        'The sum of shares exceeds the total bill amount',
      );
    }

    const created = await manager.save(Share, toCreate);
    for (const share of created) {
      share.reference = `+one-${bill.id.slice(0, 8)}-${share.id.slice(0, 8)}`;
    }
    return manager.save(Share, created);
  }

  async getBillShares(billId: string): Promise<Share[]> {
    return this.sharesRepo.find({
      where: { billId },
      relations: { owner: true, initiator: true },
      order: { createdAt: 'ASC' },
    });
  }

  computeAggregateBillStatus(
    shares: Share[],
  ): 'fully_settled' | 'partially_settled' | 'pending' | 'voided' {
    const active = shares.filter((s) => s.status !== ShareStatus.CANCELLED);
    if (active.length === 0) return 'voided';
    const settledCount = active.filter((s) => s.status === ShareStatus.SETTLED).length;
    if (settledCount === active.length) return 'fully_settled';
    if (settledCount > 0) return 'partially_settled';
    return 'pending';
  }

  async payShare(shareId: string, userId: string): Promise<Share> {
    const share = await this.getShareOrThrow(shareId);
    if (share.ownerUserId !== userId) {
      throw new ForbiddenException('هذا النصيب ليس مستحقاً عليك');
    }
    if (share.status === ShareStatus.INITIATED) {
      throw new ConflictException(
        'تم بدء الدفع بالفعل، هل تريد إلغاءه وإعادة المحاولة؟',
      );
    }
    if (share.status === ShareStatus.SETTLED) {
      throw new ConflictException('هذا النصيب مدفوع بالفعل');
    }

    const updated = await this.dataSource.transaction((manager) =>
      this.stateService.transition(manager, share, ShareStatus.INITIATED, {
        actor: userId,
        source: AuditSource.USER,
        reason: 'member_initiated_payment',
      }),
    );

    const withRelations = await this.sharesRepo.findOne({
      where: { id: updated.id },
      relations: { owner: true, initiator: true, bill: true },
    });
    if (withRelations?.initiator?.fcmToken) {
      await this.notifications.send(
        withRelations.initiator.fcmToken,
        {
          title: 'دفعة قيد التنفيذ',
          body: `${withRelations.owner?.displayName ?? 'عضو'} بدأ دفع مبلغ ${formatEgp(withRelations.amountPiastres)} ج.م لـ ${withRelations.bill?.title ?? 'الفاتورة'}`,
        },
        { type: 'share_initiated', shareId: updated.id },
      );
    }
    return updated;
  }

  async cancelInitiation(shareId: string, userId: string): Promise<Share> {
    const share = await this.getShareOrThrow(shareId);
    if (share.ownerUserId !== userId) {
      throw new ForbiddenException('هذا النصيب ليس مستحقاً عليك');
    }
    if (share.status !== ShareStatus.INITIATED) {
      throw new ConflictException('لا يمكن إلغاء هذا النصيب في حالته الحالية');
    }

    return this.dataSource.transaction((manager) =>
      this.stateService.transition(manager, share, ShareStatus.PENDING, {
        actor: userId,
        source: AuditSource.USER,
        reason: 'member_cancelled_initiation',
      }),
    );
  }

  async confirmShare(shareId: string, userId: string): Promise<Share> {
    const share = await this.getShareOrThrow(shareId);
    if (share.initiatorUserId !== userId) {
      throw new ForbiddenException('هذا الإجراء متاح فقط لصاحب الفاتورة');
    }
    if (share.status !== ShareStatus.INITIATED) {
      throw new ConflictException('هذا النصيب مؤكد بالفعل أو لم يبدأ الدفع له بعد');
    }

    const updated = await this.dataSource.transaction((manager) =>
      this.stateService.transition(manager, share, ShareStatus.SETTLED, {
        actor: userId,
        source: AuditSource.USER,
        reason: 'manual_confirm',
      }),
    );

    const withRelations = await this.sharesRepo.findOne({
      where: { id: updated.id },
      relations: { owner: true, initiator: true, bill: true },
    });
    if (withRelations?.owner?.fcmToken) {
      await this.notifications.send(
        withRelations.owner.fcmToken,
        {
          title: 'تم تأكيد الدفع ✅',
          body: `${withRelations.initiator?.displayName ?? 'المُنشئ'} أكد استلام ${formatEgp(withRelations.amountPiastres)} ج.م لـ ${withRelations.bill?.title ?? 'الفاتورة'}`,
        },
        { type: 'share_settled', shareId: updated.id },
      );
    }
    return updated;
  }

  async failShare(shareId: string, userId: string, dto: FailShareDto): Promise<Share> {
    const share = await this.getShareOrThrow(shareId);
    if (share.initiatorUserId !== userId) {
      throw new ForbiddenException('هذا الإجراء متاح فقط لصاحب الفاتورة');
    }
    if (share.status !== ShareStatus.INITIATED && share.status !== ShareStatus.SETTLED) {
      throw new ConflictException('لا يمكن تعليم هذا النصيب كفاشل في حالته الحالية');
    }

    return this.dataSource.transaction((manager) =>
      this.stateService.transition(manager, share, ShareStatus.FAILED, {
        actor: userId,
        source: AuditSource.USER,
        reason: dto.reason,
        failureReason: dto.reason,
      }),
    );
  }

  async sendReminder(shareId: string, actorId: string): Promise<{ sent: boolean; rateLimited: boolean }> {
    const share = await this.sharesRepo.findOne({
      where: { id: shareId },
      relations: { owner: true, initiator: true, bill: { group: true } },
    });
    if (!share) throw new NotFoundException('النصيب غير موجود');
    if (share.initiatorUserId !== actorId) {
      throw new ForbiddenException('هذا الإجراء متاح فقط لصاحب الفاتورة');
    }
    if (share.status !== ShareStatus.PENDING && share.status !== ShareStatus.FAILED) {
      throw new ConflictException('لا يمكن إرسال تذكير لنصيب مدفوع أو قيد المعالجة');
    }

    return this.dataSource.transaction((manager) =>
      this.doSendReminder(manager, share, actorId, AuditSource.USER),
    );
  }

  async remindAllPending(
    billId: string,
    actorId: string,
  ): Promise<{ sent: number; skipped: number }> {
    const shares = await this.sharesRepo.find({
      where: { billId },
      relations: { owner: true, initiator: true, bill: { group: true } },
    });
    if (shares.length === 0) throw new NotFoundException('الفاتورة غير موجودة');
    if (shares[0].initiatorUserId !== actorId) {
      throw new ForbiddenException('هذا الإجراء متاح فقط لصاحب الفاتورة');
    }

    const eligible = shares.filter(
      (s) => s.status === ShareStatus.PENDING || s.status === ShareStatus.FAILED,
    );

    let sent = 0;
    let skipped = 0;
    for (const share of eligible) {
      const result = await this.dataSource.transaction((manager) =>
        this.doSendReminder(manager, share, actorId, AuditSource.USER),
      );
      if (result.sent) sent++;
      else skipped++;
    }
    return { sent, skipped };
  }

  private async doSendReminder(
    manager: EntityManager,
    share: Share,
    actorId: string,
    source: AuditSource,
  ): Promise<{ sent: boolean; rateLimited: boolean }> {
    const now = new Date();
    const rateLimited = !!(
      share.lastReminderSentAt &&
      now.getTime() - share.lastReminderSentAt.getTime() < REMINDER_COOLDOWN_MS
    );

    if (rateLimited) {
      await this.auditLog.record(manager, {
        shareId: share.id,
        fromState: share.status,
        toState: share.status,
        actor: actorId,
        source,
        reason: 'reminder_skipped_rate_limited',
        metadata: { channel: 'push', wasRateLimited: true },
      });
      return { sent: false, rateLimited: true };
    }

    let deliveryFailed = false;
    if (share.owner?.fcmToken) {
      await this.notifications.send(
        share.owner.fcmToken,
        {
          title: 'تذكير بالدفع',
          body: `${share.initiator?.displayName ?? 'صديقك'} يذكرك بدفع ${formatEgp(share.amountPiastres)} ج.م لـ ${share.bill?.title ?? 'الفاتورة'} في ${share.bill?.group?.name ?? 'المجموعة'}`,
        },
        { type: 'share_reminder', shareId: share.id },
      );
    } else {
      deliveryFailed = true;
    }

    share.lastReminderSentAt = now;
    await manager.save(share);

    await this.auditLog.record(manager, {
      shareId: share.id,
      fromState: share.status,
      toState: share.status,
      actor: actorId,
      source,
      reason: 'reminder_sent',
      metadata: { channel: 'push', wasRateLimited: false, deliveryFailed },
    });

    return { sent: true, rateLimited: false };
  }

  async sendStaleInitiatedNudge(share: Share): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.doSendStaleNudge(manager, share),
    );
  }

  private async doSendStaleNudge(manager: EntityManager, share: Share): Promise<void> {
    const now = new Date();
    if (share.initiator?.fcmToken) {
      await this.notifications.send(
        share.initiator.fcmToken,
        {
          title: 'دفعة في انتظار التأكيد',
          body: `لديك دفعة بقيمة ${formatEgp(share.amountPiastres)} ج.م في انتظار تأكيد الاستلام لـ ${share.bill?.title ?? 'الفاتورة'}`,
        },
        { type: 'share_stale_nudge', shareId: share.id },
      );
    }
    share.lastReminderSentAt = now;
    await manager.save(share);

    await this.auditLog.record(manager, {
      shareId: share.id,
      fromState: share.status,
      toState: share.status,
      actor: null,
      source: AuditSource.REMINDER_JOB,
      reason: 'stale_initiated_nudge',
      metadata: { channel: 'push', wasRateLimited: false },
    });
  }

  async findStaleInitiatedShares(): Promise<Share[]> {
    const staleCutoff = new Date(Date.now() - REMINDER_COOLDOWN_MS);
    return this.sharesRepo
      .createQueryBuilder('share')
      .leftJoinAndSelect('share.initiator', 'initiator')
      .leftJoinAndSelect('share.bill', 'bill')
      .where('share.status = :status', { status: ShareStatus.INITIATED })
      .andWhere('share.initiatedAt < :staleCutoff', { staleCutoff })
      .andWhere('(share.lastReminderSentAt IS NULL OR share.lastReminderSentAt < :staleCutoff)', {
        staleCutoff,
      })
      .getMany();
  }

  private async getShareOrThrow(shareId: string): Promise<Share> {
    const share = await this.sharesRepo.findOne({ where: { id: shareId } });
    if (!share) throw new NotFoundException('النصيب غير موجود');
    return share;
  }
}
