import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bill, BillLineItem } from './entities/bill.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Message } from '../groups/entities/message.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillItemsDto } from './dto/update-bill-items.dto';
import { QrParserService, QrParseResult } from './qr-parser/qr-parser.service';
import { SharesService } from '../shares/shares.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(Bill) private billsRepo: Repository<Bill>,
    @InjectRepository(GroupMember) private membersRepo: Repository<GroupMember>,
    private readonly dataSource: DataSource,
    private readonly qrParser: QrParserService,
    private readonly sharesService: SharesService,
    private readonly notifications: NotificationsService,
  ) {}

  async getGroupBills(groupId: string, userId: string): Promise<Bill[]> {
    await this.assertMember(groupId, userId);
    return this.billsRepo.find({
      where: { groupId },
      relations: { paidBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createBill(groupId: string, userId: string, dto: CreateBillDto): Promise<Bill> {
    const membership = await this.assertMember(groupId, userId);
    const { shares, ...billFields } = dto;
    const title = dto.title || dto.venueName || 'فاتورة';

    const savedId = await this.dataSource.transaction(async (manager) => {
      const bill = manager.create(Bill, {
        groupId,
        ...billFields,
        title,
        captureMethod: dto.captureMethod ?? 'manual',
      });
      const saved = await manager.save(bill);
      if (shares && shares.length > 0) {
        await this.sharesService.createSharesForBill(manager, saved, shares);
      }
      // Sharing the receipt into the group chat is part of creating it — any member
      // can then open it straight from the chat feed to add/claim items.
      await manager.save(Message, {
        groupId,
        senderId: userId,
        billId: saved.id,
      });
      return saved.id;
    });

    const result = (await this.billsRepo.findOne({
      where: { id: savedId },
      relations: { paidBy: true },
    })) as Bill;

    this.notifyBillShared(groupId, userId, membership.user?.displayName ?? null, result).catch(() => {});

    return result;
  }

  async getBillDetail(
    billId: string,
    userId: string,
  ): Promise<Bill & { aggregateStatus: string; shares: unknown[]; isEditable: boolean }> {
    const bill = await this.billsRepo.findOne({
      where: { id: billId },
      relations: { paidBy: true },
    });
    if (!bill) throw new NotFoundException('BILL_NOT_FOUND');
    await this.assertMember(bill.groupId, userId);

    const shares = await this.sharesService.getBillShares(billId);
    const aggregateStatus = this.sharesService.computeAggregateBillStatus(shares);

    return { ...bill, shares, aggregateStatus, isEditable: bill.closedAt === null };
  }

  async updateBillItems(billId: string, userId: string, dto: UpdateBillItemsDto): Promise<Bill & { aggregateStatus: string; shares: unknown[]; isEditable: boolean }> {
    const bill = await this.billsRepo.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('BILL_NOT_FOUND');
    await this.assertMember(bill.groupId, userId);
    if (bill.closedAt !== null) throw new ConflictException('BILL_CLOSED');

    await this.dataSource.transaction(async (manager) => {
      const fresh = await manager.findOne(Bill, { where: { id: billId } });
      if (!fresh) throw new NotFoundException('BILL_NOT_FOUND');
      if (fresh.closedAt !== null) throw new ConflictException('BILL_CLOSED');

      fresh.lineItems = dto.lineItems.map((li): BillLineItem => ({
        name: li.name,
        qty: li.qty,
        unitPrice: li.unitPrice,
        claimedBy: li.claimedBy ?? [],
      }));
      await manager.save(fresh);

      await this.sharesService.reconcileSharesForBill(manager, fresh, dto.shares, userId);
    });

    return this.getBillDetail(billId, userId);
  }

  async closeBill(billId: string, userId: string): Promise<Bill> {
    const bill = await this.billsRepo.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('BILL_NOT_FOUND');
    if (bill.paidByUserId !== userId) throw new ForbiddenException('NOT_BILL_OWNER');
    if (bill.closedAt !== null) throw new ConflictException('BILL_ALREADY_CLOSED');

    bill.closedAt = new Date();
    return this.billsRepo.save(bill);
  }

  async deleteBill(billId: string, userId: string): Promise<void> {
    const bill = await this.billsRepo.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('BILL_NOT_FOUND');

    if (bill.paidByUserId !== userId) {
      const adminMembership = await this.membersRepo.findOne({
        where: { groupId: bill.groupId, userId, status: 'active' as any, role: 'admin' as any },
      });
      if (!adminMembership) throw new ForbiddenException('NOT_BILL_OWNER_OR_ADMIN');
    }
    await this.billsRepo.delete(billId);
  }

  async parseQr(groupId: string, userId: string, payload: string): Promise<QrParseResult> {
    await this.assertMember(groupId, userId);
    return this.qrParser.parse(payload);
  }

  private async notifyBillShared(
    groupId: string,
    senderId: string,
    senderName: string | null,
    bill: Bill,
  ): Promise<void> {
    const members = await this.membersRepo.find({
      where: { groupId, status: 'active' as any },
      relations: { user: true },
    });
    const recipients = members.filter((m) => m.userId && m.userId !== senderId && m.user?.fcmToken);

    await Promise.allSettled(
      recipients.map((m) =>
        this.notifications.send(
          m.user!.fcmToken!,
          { title: senderName ?? 'User', body: `🧾 ${bill.title ?? 'Receipt'} — ${bill.amount} ${bill.currency}` },
          { type: 'chat_message', groupId },
        ),
      ),
    );
  }

  private async assertMember(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId, status: 'active' as any },
      relations: { user: true },
    });
    if (!membership) throw new ForbiddenException('GROUP_ACCESS_DENIED');
    return membership;
  }
}
