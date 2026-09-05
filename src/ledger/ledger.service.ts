import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Bill } from '../bills/entities/bill.entity';
import { Share, ShareStatus } from '../shares/entities/share.entity';
import { GroupMember, MemberStatus } from '../groups/entities/group-member.entity';
import { SharesService } from '../shares/shares.service';

interface CounterpartBreakdown {
  counterpartUserId: string | null;
  counterpartPendingPhone: string | null;
  counterpartName: string;
  netAmountPiastres: number;
  direction: 'owes_you' | 'you_owe';
}

interface LedgerBillSummary {
  id: string;
  title: string | null;
  amountPiastres: number;
  createdAt: Date;
  aggregateStatus: 'fully_settled' | 'partially_settled' | 'pending' | 'voided';
  pointsDelta: null;
}

export interface GroupLedgerResponse {
  groupMonthlyTotal: number;
  /** Sum of this month's bill amounts where the current user is the payer (fronted). */
  youPaidPiastres: number;
  /** Sum of this month's share amounts owed by the current user (their fair share of splits). */
  yourSharePiastres: number;
  currentUserNetBalance: number;
  perCounterpartBreakdown: CounterpartBreakdown[];
  bills: LedgerBillSummary[];
  computedAt: Date;
}

const OUTSTANDING_STATUSES = [
  ShareStatus.PENDING,
  ShareStatus.INITIATED,
  ShareStatus.FAILED,
  ShareStatus.LINK_SENT,
  ShareStatus.LINK_OPENED,
  ShareStatus.PENDING_CONFIRMATION,
];

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(Bill) private billsRepo: Repository<Bill>,
    @InjectRepository(Share) private sharesRepo: Repository<Share>,
    @InjectRepository(GroupMember) private membersRepo: Repository<GroupMember>,
    private readonly sharesService: SharesService,
  ) {}

  async getGroupLedger(groupId: string, userId: string): Promise<GroupLedgerResponse> {
    await this.assertMembership(groupId, userId);

    const bills = await this.billsRepo.find({ where: { groupId }, order: { createdAt: 'DESC' } });
    const billIds = bills.map((b) => b.id);
    const shares = billIds.length
      ? await this.sharesRepo.find({
          where: { billId: In(billIds) },
          relations: { owner: true, initiator: true },
        })
      : [];

    const sharesByBill = new Map<string, Share[]>();
    for (const share of shares) {
      const list = sharesByBill.get(share.billId) ?? [];
      list.push(share);
      sharesByBill.set(share.billId, list);
    }

    const { year: currentYear, month: currentMonth } = this.getCairoYearMonth(new Date());

    let groupMonthlyTotal = 0;
    let youPaidPiastres = 0;
    let yourSharePiastres = 0;
    const billSummaries: LedgerBillSummary[] = bills.map((bill) => {
      const billShares = sharesByBill.get(bill.id) ?? [];
      const aggregateStatus = this.sharesService.computeAggregateBillStatus(billShares);
      const amountPiastres = Math.round(Number(bill.amount) * 100);

      if (aggregateStatus !== 'voided') {
        const { year, month } = this.getCairoYearMonth(bill.createdAt);
        if (year === currentYear && month === currentMonth) {
          groupMonthlyTotal += amountPiastres;
          if (bill.paidByUserId === userId) {
            youPaidPiastres += amountPiastres;
            const othersOwe = billShares
              .filter((s) => s.status !== ShareStatus.CANCELLED)
              .reduce((sum, s) => sum + s.amountPiastres, 0);
            yourSharePiastres += Math.max(0, amountPiastres - othersOwe);
          }
          for (const share of billShares) {
            if (share.ownerUserId === userId && share.status !== ShareStatus.CANCELLED) {
              yourSharePiastres += share.amountPiastres;
            }
          }
        }
      }

      return {
        id: bill.id,
        title: bill.title,
        amountPiastres,
        createdAt: bill.createdAt,
        aggregateStatus,
        pointsDelta: null,
      };
    });

    const outstanding = shares.filter((s) => OUTSTANDING_STATUSES.includes(s.status));

    let currentUserNetBalance = 0;
    const rawDirectional = new Map<string, number>();
    const nameCache = new Map<string, string>();

    for (const share of outstanding) {
      const debtorKey = share.ownerUserId ?? `phone:${share.ownerPendingPhone}`;
      const creditorKey = share.initiatorUserId;

      if (share.ownerUserId) nameCache.set(share.ownerUserId, share.owner?.displayName ?? 'عضو');
      nameCache.set(share.initiatorUserId, share.initiator?.displayName ?? 'عضو');

      if (creditorKey === userId) currentUserNetBalance += share.amountPiastres;
      if (debtorKey === userId) currentUserNetBalance -= share.amountPiastres;

      const key = `${debtorKey}::${creditorKey}`;
      rawDirectional.set(key, (rawDirectional.get(key) ?? 0) + share.amountPiastres);
    }

    const counterpartNet = new Map<string, number>();
    for (const [key, amount] of rawDirectional.entries()) {
      const [debtorKey, creditorKey] = key.split('::');
      if (debtorKey === userId) {
        counterpartNet.set(creditorKey, (counterpartNet.get(creditorKey) ?? 0) - amount);
      } else if (creditorKey === userId) {
        counterpartNet.set(debtorKey, (counterpartNet.get(debtorKey) ?? 0) + amount);
      }
    }

    const perCounterpartBreakdown: CounterpartBreakdown[] = [];
    for (const [counterpartKey, net] of counterpartNet.entries()) {
      if (net === 0) continue;
      const isPhone = counterpartKey.startsWith('phone:');
      perCounterpartBreakdown.push({
        counterpartUserId: isPhone ? null : counterpartKey,
        counterpartPendingPhone: isPhone ? counterpartKey.slice(6) : null,
        counterpartName: nameCache.get(counterpartKey) ?? 'عضو',
        netAmountPiastres: Math.abs(net),
        direction: net > 0 ? 'owes_you' : 'you_owe',
      });
    }

    return {
      groupMonthlyTotal,
      youPaidPiastres,
      yourSharePiastres,
      currentUserNetBalance,
      perCounterpartBreakdown,
      bills: billSummaries,
      computedAt: new Date(),
    };
  }

  /**
   * One round-trip for Home: hero totals + badge counts + per-group nets.
   * Replaces N× GET /ledger/group plus GET /shares/mine on the home screen.
   */
  async getHomeSummary(userId: string): Promise<{
    owedPiastres: number;
    owePiastres: number;
    approvalCount: number;
    toPayCount: number;
    invitationCount: number;
    groupNets: Record<string, number>;
  }> {
    const outstanding = [
      ShareStatus.PENDING,
      ShareStatus.INITIATED,
      ShareStatus.FAILED,
      ShareStatus.LINK_SENT,
      ShareStatus.LINK_OPENED,
      ShareStatus.PENDING_CONFIRMATION,
    ];

    const netRows: Array<{ groupId: string; net: string }> = await this.sharesRepo
      .createQueryBuilder('s')
      .innerJoin(
        GroupMember,
        'gm',
        'gm.groupId = s.groupId AND gm.userId = :userId AND gm.status = :active',
        { userId, active: MemberStatus.ACTIVE },
      )
      .select('s.groupId', 'groupId')
      .addSelect(
        `SUM(CASE WHEN s.initiatorUserId = :userId AND s.status IN (:...outstanding) THEN s.amountPiastres ELSE 0 END)
         - SUM(CASE WHEN s.ownerUserId = :userId AND s.status IN (:...outstanding) THEN s.amountPiastres ELSE 0 END)`,
        'net',
      )
      .where('s.status IN (:...outstanding)', { outstanding, userId })
      .groupBy('s.groupId')
      .getRawMany();

    const groupNets: Record<string, number> = {};
    let owedPiastres = 0;
    let owePiastres = 0;
    for (const row of netRows) {
      const net = Number(row.net) || 0;
      groupNets[row.groupId] = net;
      if (net > 0) owedPiastres += net;
      else if (net < 0) owePiastres += -net;
    }

    const [approvalCount, toPayCount, invitationCount] = await Promise.all([
      this.sharesRepo.count({
        where: { initiatorUserId: userId, status: ShareStatus.INITIATED },
      }),
      this.sharesRepo.count({
        where: { ownerUserId: userId, status: In([ShareStatus.PENDING, ShareStatus.FAILED]) },
      }),
      this.membersRepo.count({
        where: { userId, status: MemberStatus.PENDING },
      }),
    ]);

    return {
      owedPiastres,
      owePiastres,
      approvalCount,
      toPayCount,
      invitationCount,
      groupNets,
    };
  }

  private getCairoYearMonth(date: Date): { year: number; month: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(date);
    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const month = Number(parts.find((p) => p.type === 'month')!.value);
    return { year, month };
  }

  private async assertMembership(groupId: string, userId: string): Promise<void> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId, status: MemberStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenException('GROUP_ACCESS_DENIED');
  }
}
