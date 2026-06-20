import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bill } from './entities/bill.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { CreateBillDto } from './dto/create-bill.dto';

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(Bill) private billsRepo: Repository<Bill>,
    @InjectRepository(GroupMember) private membersRepo: Repository<GroupMember>,
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
    await this.assertMember(groupId, userId);
    const bill = this.billsRepo.create({ groupId, ...dto });
    const saved = await this.billsRepo.save(bill);
    return this.billsRepo.findOne({ where: { id: saved.id }, relations: { paidBy: true } }) as Promise<Bill>;
  }

  async deleteBill(billId: string, userId: string): Promise<void> {
    const bill = await this.billsRepo.findOne({ where: { id: billId } });
    if (!bill) throw new NotFoundException('Bill not found');

    if (bill.paidByUserId !== userId) {
      const adminMembership = await this.membersRepo.findOne({
        where: { groupId: bill.groupId, userId, status: 'active' as any, role: 'admin' as any },
      });
      if (!adminMembership) throw new ForbiddenException('Only the payer or a group admin can delete this bill');
    }
    await this.billsRepo.delete(billId);
  }

  private async assertMember(groupId: string, userId: string): Promise<void> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId, status: 'active' as any },
    });
    if (!membership) throw new ForbiddenException('Not an active member of this group');
  }
}
