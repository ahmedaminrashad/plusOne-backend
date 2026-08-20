import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bill, BillLineItem } from './entities/bill.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { Message } from '../groups/entities/message.entity';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillItemsDto } from './dto/update-bill-items.dto';
import { QrParserService, QrParseResult } from './qr-parser/qr-parser.service';
import { MindeeOcrService, OcrParseResult } from './ocr/mindee-ocr.service';
import { SharesService } from '../shares/shares.service';
import { NotificationsService } from '../notifications/notifications.service';

function resolveExtraAmount(
  value: number | null | undefined,
  type: 'percent' | 'amount' | null | undefined,
  base: number,
): number {
  if (value == null) return 0;
  return type === 'percent' ? (base * value) / 100 : value;
}

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(Bill) private billsRepo: Repository<Bill>,
    @InjectRepository(GroupMember) private membersRepo: Repository<GroupMember>,
    private readonly dataSource: DataSource,
    private readonly qrParser: QrParserService,
    private readonly ocrParser: MindeeOcrService,
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
    // Any group member can edit while the bill is not fully settled.
    // Do not use closedAt here — older builds set it on the first payment.
    const isEditable = aggregateStatus !== 'fully_settled';

    return { ...bill, shares, aggregateStatus, isEditable };
  }

  async updateBillItems(billId: string, userId: string, dto: UpdateBillItemsDto): Promise<Bill & { aggregateStatus: string; shares: unknown[]; isEditable: boolean }> {
    const bill = await this.billsRepo.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('BILL_NOT_FOUND');
    await this.assertMember(bill.groupId, userId);

    const existingShares = await this.sharesService.getBillShares(billId);
    const aggregateStatus = this.sharesService.computeAggregateBillStatus(existingShares);
    if (aggregateStatus === 'fully_settled') {
      throw new ConflictException('BILL_FULLY_SETTLED');
    }

    await this.dataSource.transaction(async (manager) => {
      const fresh = await manager.findOne(Bill, { where: { id: billId } });
      if (!fresh) throw new NotFoundException('BILL_NOT_FOUND');

      fresh.lineItems = dto.lineItems.map((li): BillLineItem => ({
        name: li.name,
        qty: li.qty,
        unitPrice: li.unitPrice,
        claimedBy: li.claimedBy ?? [],
      }));

      const extrasSent =
        dto.tax !== undefined ||
        dto.taxType !== undefined ||
        dto.delivery !== undefined ||
        dto.deliveryType !== undefined ||
        dto.vat !== undefined ||
        dto.vatType !== undefined;

      if (dto.tax !== undefined) fresh.tax = dto.tax;
      if (dto.taxType !== undefined) fresh.taxType = dto.taxType;
      if (dto.delivery !== undefined) fresh.delivery = dto.delivery;
      if (dto.deliveryType !== undefined) fresh.deliveryType = dto.deliveryType;
      if (dto.vat !== undefined) fresh.vat = dto.vat;
      if (dto.vatType !== undefined) fresh.vatType = dto.vatType;

      if (extrasSent) {
        const subtotal = fresh.lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0);
        const taxAmt = resolveExtraAmount(fresh.tax, fresh.taxType, subtotal);
        const deliveryAmt = resolveExtraAmount(fresh.delivery, fresh.deliveryType, subtotal);
        const vatAmt = resolveExtraAmount(fresh.vat, fresh.vatType, subtotal + taxAmt + deliveryAmt);
        fresh.amount = Math.round((subtotal + taxAmt + deliveryAmt + vatAmt) * 100) / 100;
      }

      // Re-open for chat / detail if this bill was locked too early by an older build.
      if (fresh.closedAt != null) {
        fresh.closedAt = null;
      }

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

  async parseReceipt(
    groupId: string,
    userId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<OcrParseResult> {
    await this.assertMember(groupId, userId);
    return this.ocrParser.parseReceipt(buffer, filename);
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
