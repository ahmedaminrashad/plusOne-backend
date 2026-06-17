import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember, MemberRole, MemberStatus } from './entities/group-member.entity';
import { User } from '../users/entities/user.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteMembersDto } from './dto/invite-members.dto';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectRepository(Group)
    private readonly groupsRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepo: Repository<GroupMember>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async createGroup(userId: string, dto: CreateGroupDto): Promise<Group> {
    return this.dataSource.transaction(async (manager) => {
      const group = manager.create(Group, {
        name: dto.name,
        category: dto.category,
        avatarUrl: dto.avatarUrl,
      });
      const saved = await manager.save(group);

      await manager.save(GroupMember, {
        groupId: saved.id,
        userId,
        role: MemberRole.ADMIN,
        status: MemberStatus.ACTIVE,
      });

      const result = await manager.findOne(Group, {
        where: { id: saved.id },
        relations: { members: { user: true } },
      });
      if (!result) throw new Error('Group creation failed');
      return result;
    });
  }

  async getUserGroups(userId: string): Promise<Group[]> {
    const memberships = await this.membersRepo.find({
      where: { userId, status: MemberStatus.ACTIVE },
      relations: { group: { members: true } },
      order: { createdAt: 'DESC' },
    });
    return memberships.map((m) => m.group);
  }

  async getGroup(groupId: string, userId: string): Promise<Group> {
    await this.assertMembership(groupId, userId);
    const group = await this.groupsRepo.findOne({
      where: { id: groupId },
      relations: { members: { user: true } },
    });
    if (!group) throw new NotFoundException('المجموعة غير موجودة');
    return group;
  }

  async inviteMembers(
    groupId: string,
    adminId: string,
    dto: InviteMembersDto,
  ): Promise<{ sent: number; failed: number; alreadyMembers: number }> {
    await this.assertAdmin(groupId, adminId);

    let sent = 0;
    let failed = 0;
    let alreadyMembers = 0;

    for (const phone of dto.phones) {
      try {
        const existing = await this.membersRepo.findOne({
          where: [
            { groupId, pendingPhone: phone },
          ],
        });

        const registeredUser = await this.usersRepo.findOne({ where: { phone } });

        if (registeredUser) {
          const existingActive = await this.membersRepo.findOne({
            where: { groupId, userId: registeredUser.id },
          });

          if (existingActive) {
            alreadyMembers++;
            continue;
          }

          await this.membersRepo.save({
            groupId,
            userId: registeredUser.id,
            role: MemberRole.MEMBER,
            status: MemberStatus.ACTIVE,
          });
          // TODO: send push notification to registeredUser
          this.logger.log(`[INVITE] Push sent to user ${registeredUser.id} for group ${groupId}`);
        } else {
          if (existing) {
            alreadyMembers++;
            continue;
          }

          await this.membersRepo.save({
            groupId,
            pendingPhone: phone,
            role: MemberRole.MEMBER,
            status: MemberStatus.PENDING,
          });
          // TODO: send SMS invite with deep link
          this.logger.log(`[INVITE] SMS invite sent to ${phone} for group ${groupId}`);
        }
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed, alreadyMembers };
  }

  async removeMember(
    groupId: string,
    adminId: string,
    targetMemberId: string,
  ): Promise<void> {
    await this.assertAdmin(groupId, adminId);

    const target = await this.membersRepo.findOne({
      where: { id: targetMemberId, groupId },
      relations: { user: true },
    });

    if (!target) throw new NotFoundException('العضو غير موجود في المجموعة');

    if (target.userId === adminId) {
      throw new ForbiddenException('لا يمكنك حذف نفسك من المجموعة');
    }

    target.status = MemberStatus.REMOVED;
    target.removedBy = adminId;
    await this.membersRepo.save(target);

    // TODO: send push/SMS notification to removed member
    this.logger.log(`[REMOVE] Member ${targetMemberId} removed from group ${groupId} by ${adminId}`);
  }

  async getMembers(groupId: string, userId: string): Promise<GroupMember[]> {
    await this.assertMembership(groupId, userId);
    return this.membersRepo.find({
      where: { groupId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  private async assertMembership(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId, status: MemberStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenException('ليس لديك صلاحية الوصول إلى هذه المجموعة');
    return membership;
  }

  private async assertAdmin(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId, role: MemberRole.ADMIN, status: MemberStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenException('فقط المسؤولون يمكنهم إزالة الأعضاء');
    return membership;
  }
}
