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
import { Group } from '../groups/entities/group.entity';
import { User } from '../users/entities/user.entity';
import { CreateShareDto } from './dto/create-share.dto';
import { FailShareDto } from './dto/fail-share.dto';
import { SharesStateService } from './shares-state.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditSource } from '../audit/entities/audit-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationTexts } from '../notifications/notification-texts';

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
      relations: { user: true },
    });
    const memberById = new Map(members.map((m) => [m.id, m]));

    let totalPiastres = 0;
    const toCreate: Partial<Share>[] = [];

    for (const dto of dtos) {
      const member = memberById.get(dto.groupMemberId);
      if (!member) {
        throw new BadRequestException('INVALID_GROUP_MEMBER');
      }
      if (member.userId && member.userId === bill.paidByUserId) {
        throw new BadRequestException('PAYER_CANNOT_OWE_SELF');
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
      throw new BadRequestException('SHARES_EXCEED_BILL_TOTAL');
    }

    const created = await manager.save(Share, toCreate);
    for (const share of created) {
      share.reference = `+one-${bill.id.slice(0, 8)}-${share.id.slice(0, 8)}`;
    }
    const saved = await manager.save(Share, created);

    await this.notifyAssignedShares(manager, bill, saved, members);

    return saved;
  }

  private async notifyAssignedShares(
    manager: EntityManager,
    bill: Bill,
    shares: Share[],
    members: GroupMember[],
  ): Promise<void> {
    const ownedShares = shares.filter((s) => s.ownerUserId);
    if (ownedShares.length === 0) return;

    const [initiator, group] = await Promise.all([
      manager.findOne(User, { where: { id: bill.paidByUserId } }),
      manager.findOne(Group, { where: { id: bill.groupId } }),
    ]);
    const memberByUserId = new Map(members.filter((m) => m.userId).map((m) => [m.userId, m]));

    for (const share of ownedShares) {
      const member = memberByUserId.get(share.ownerUserId!);
      if (!member?.user?.fcmToken) continue;
      await this.notifications.send(
        member.user.fcmToken,
        notificationTexts.shareAssigned(member.user.language, {
          initiatorName: initiator?.displayName ?? (member.user.language === 'en' ? 'A friend' : 'صديقك'),
          groupName: group?.name ?? '',
          amountPiastres: share.amountPiastres,
          currency: share.currency,
        }),
        {
          type: 'share_assigned',
          groupId: bill.groupId,
          groupName: group?.name ?? '',
          billId: bill.id,
        },
      );
    }
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
      throw new ForbiddenException('NOT_SHARE_OWNER');
    }
    if (share.status === ShareStatus.INITIATED) {
      throw new ConflictException('SHARE_ALREADY_INITIATED');
    }
    if (share.status === ShareStatus.SETTLED) {
      throw new ConflictException('SHARE_ALREADY_SETTLED');
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
      const lang = withRelations.initiator.language;
      await this.notifications.send(
        withRelations.initiator.fcmToken,
        notificationTexts.shareInitiated(lang, {
          ownerName: withRelations.owner?.displayName ?? (lang === 'en' ? 'A member' : 'عضو'),
          amountPiastres: withRelations.amountPiastres,
          currency: withRelations.currency,
          billTitle: withRelations.bill?.title ?? (lang === 'en' ? 'the bill' : 'الفاتورة'),
        }),
        { type: 'share_initiated', shareId: updated.id },
      );
    }
    return updated;
  }

  async cancelInitiation(shareId: string, userId: string): Promise<Share> {
    const share = await this.getShareOrThrow(shareId);
    if (share.ownerUserId !== userId) {
      throw new ForbiddenException('NOT_SHARE_OWNER');
    }
    if (share.status !== ShareStatus.INITIATED) {
      throw new ConflictException('SHARE_CANNOT_CANCEL');
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
      throw new ForbiddenException('NOT_BILL_INITIATOR');
    }
    if (share.status !== ShareStatus.INITIATED) {
      throw new ConflictException('SHARE_NOT_INITIATED');
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
      const lang = withRelations.owner.language;
      await this.notifications.send(
        withRelations.owner.fcmToken,
        notificationTexts.shareSettled(lang, {
          initiatorName: withRelations.initiator?.displayName ?? (lang === 'en' ? 'The creator' : 'المُنشئ'),
          amountPiastres: withRelations.amountPiastres,
          currency: withRelations.currency,
          billTitle: withRelations.bill?.title ?? (lang === 'en' ? 'the bill' : 'الفاتورة'),
        }),
        { type: 'share_settled', shareId: updated.id },
      );
    }
    return updated;
  }

  async failShare(shareId: string, userId: string, dto: FailShareDto): Promise<Share> {
    const share = await this.getShareOrThrow(shareId);
    if (share.initiatorUserId !== userId) {
      throw new ForbiddenException('NOT_BILL_INITIATOR');
    }
    if (share.status !== ShareStatus.INITIATED && share.status !== ShareStatus.SETTLED) {
      throw new ConflictException('SHARE_CANNOT_FAIL');
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
    if (!share) throw new NotFoundException('SHARE_NOT_FOUND');
    if (share.initiatorUserId !== actorId) {
      throw new ForbiddenException('NOT_BILL_INITIATOR');
    }
    if (share.status !== ShareStatus.PENDING && share.status !== ShareStatus.FAILED) {
      throw new ConflictException('SHARE_REMINDER_NOT_ALLOWED');
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
    if (shares.length === 0) throw new NotFoundException('BILL_NOT_FOUND');
    if (shares[0].initiatorUserId !== actorId) {
      throw new ForbiddenException('NOT_BILL_INITIATOR');
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
      const lang = share.owner.language;
      await this.notifications.send(
        share.owner.fcmToken,
        notificationTexts.shareReminder(lang, {
          initiatorName: share.initiator?.displayName ?? (lang === 'en' ? 'A friend' : 'صديقك'),
          amountPiastres: share.amountPiastres,
          currency: share.currency,
          billTitle: share.bill?.title ?? (lang === 'en' ? 'the bill' : 'الفاتورة'),
          groupName: share.bill?.group?.name ?? (lang === 'en' ? 'the group' : 'المجموعة'),
        }),
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
      const lang = share.initiator.language;
      await this.notifications.send(
        share.initiator.fcmToken,
        notificationTexts.shareStaleNudge(lang, {
          amountPiastres: share.amountPiastres,
          currency: share.currency,
          billTitle: share.bill?.title ?? (lang === 'en' ? 'the bill' : 'الفاتورة'),
        }),
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
    if (!share) throw new NotFoundException('SHARE_NOT_FOUND');
    return share;
  }
}
