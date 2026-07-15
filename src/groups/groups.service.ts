import { unlink, writeFile } from 'fs/promises';
import sharp from 'sharp';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember, MemberRole, MemberStatus } from './entities/group-member.entity';
import { Message } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { InviteMembersDto } from './dto/invite-members.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationTexts } from '../notifications/notification-texts';

export interface MessageResponse {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  text: string | null;
  imageUrl: string | null;
  createdAt: string;
}

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectRepository(Group)
    private readonly groupsRepo: Repository<Group>,
    @InjectRepository(GroupMember)
    private readonly membersRepo: Repository<GroupMember>,
    @InjectRepository(Message)
    private readonly messagesRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
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
      if (!result) throw new InternalServerErrorException('GROUP_CREATION_FAILED');
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
    if (!group) throw new NotFoundException('GROUP_NOT_FOUND');
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
            status: MemberStatus.PENDING,
          });
          const invitedGroup = await this.groupsRepo.findOne({ where: { id: groupId } });
          if (registeredUser.fcmToken) {
            await this.notifications.send(
              registeredUser.fcmToken,
              notificationTexts.invitation(registeredUser.language, { groupName: invitedGroup?.name ?? '' }),
              { type: 'invitation', groupId },
            );
          }
          this.logger.log(`[INVITE] Notification sent to user ${registeredUser.id} for group ${groupId}`);
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

    if (!target) throw new NotFoundException('GROUP_MEMBER_NOT_FOUND');

    if (target.userId === adminId) {
      throw new ForbiddenException('CANNOT_REMOVE_SELF');
    }

    target.status = MemberStatus.REMOVED;
    target.removedBy = adminId;
    await this.membersRepo.save(target);

    if (target.user?.fcmToken) {
      const removedGroup = await this.groupsRepo.findOne({ where: { id: groupId } });
      await this.notifications.send(
        target.user.fcmToken,
        notificationTexts.removed(target.user.language, { groupName: removedGroup?.name ?? '' }),
        { type: 'removed', groupId },
      );
    }
    this.logger.log(`[REMOVE] Member ${targetMemberId} removed from group ${groupId} by ${adminId}`);
  }

  async getMyInvitations(userId: string, phone: string): Promise<GroupMember[]> {
    await this.membersRepo
      .createQueryBuilder()
      .update()
      .set({ userId, pendingPhone: () => 'NULL' })
      .where('pendingPhone = :phone AND status = :status', { phone, status: MemberStatus.PENDING })
      .execute();

    return this.membersRepo.find({
      where: { userId, status: MemberStatus.PENDING },
      relations: { group: true },
      order: { createdAt: 'DESC' },
    });
  }

  async acceptInvitation(membershipId: string, userId: string): Promise<void> {
    const membership = await this.membersRepo.findOne({
      where: { id: membershipId, userId, status: MemberStatus.PENDING },
    });
    if (!membership) throw new NotFoundException('INVITATION_NOT_FOUND');
    membership.status = MemberStatus.ACTIVE;
    await this.membersRepo.save(membership);

    const [user, group] = await Promise.all([
      this.usersRepo.findOne({ where: { id: userId } }),
      this.groupsRepo.findOne({ where: { id: membership.groupId } }),
    ]);
    const admins = await this.membersRepo.find({
      where: { groupId: membership.groupId, role: MemberRole.ADMIN, status: MemberStatus.ACTIVE },
      relations: { user: true },
    });
    for (const admin of admins) {
      if (admin.user?.fcmToken) {
        await this.notifications.send(
          admin.user.fcmToken,
          notificationTexts.memberJoined(admin.user.language, {
            userName: user?.displayName ?? (admin.user.language === 'en' ? 'A user' : 'مستخدم'),
            groupName: group?.name ?? '',
          }),
          { type: 'member_joined', groupId: membership.groupId },
        );
      }
    }
  }

  async declineInvitation(membershipId: string, userId: string): Promise<void> {
    const membership = await this.membersRepo.findOne({
      where: { id: membershipId, userId, status: MemberStatus.PENDING },
    });
    if (!membership) throw new NotFoundException('INVITATION_NOT_FOUND');
    membership.status = MemberStatus.REMOVED;
    membership.removedBy = userId;
    await this.membersRepo.save(membership);
  }

  async getMembers(groupId: string, userId: string): Promise<GroupMember[]> {
    await this.assertMembership(groupId, userId);
    return this.membersRepo.find({
      where: { groupId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  async sendMessage(groupId: string, senderId: string, dto: CreateMessageDto): Promise<MessageResponse> {
    await this.assertMembership(groupId, senderId);

    const text = dto.text?.trim() || null;
    if (!text && !dto.imageUrl) {
      throw new BadRequestException('MESSAGE_TEXT_OR_IMAGE_REQUIRED');
    }

    const saved = await this.messagesRepo.save({
      groupId,
      senderId,
      text,
      imageUrl: dto.imageUrl ?? null,
    });

    const full = await this.messagesRepo.findOne({
      where: { id: saved.id },
      relations: { sender: true },
    });
    if (!full) throw new InternalServerErrorException('MESSAGE_CREATION_FAILED');

    // Fire-and-forget — a notification failure shouldn't fail the send.
    this.notifyGroupChat(groupId, senderId, full).catch(() => {});

    return this.toMessageResponse(full);
  }

  async getMessages(groupId: string, userId: string, limit: number): Promise<MessageResponse[]> {
    await this.assertMembership(groupId, userId);
    const messages = await this.messagesRepo.find({
      where: { groupId },
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return messages.map((m) => this.toMessageResponse(m));
  }

  private toMessageResponse(message: Message): MessageResponse {
    return {
      id: message.id,
      groupId: message.groupId,
      senderId: message.senderId,
      senderName: message.sender.displayName ?? 'User',
      senderPhoto: message.sender.photoUrl ?? null,
      text: message.text,
      imageUrl: message.imageUrl,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async notifyGroupChat(groupId: string, senderId: string, message: Message): Promise<void> {
    const members = await this.membersRepo.find({
      where: { groupId, status: MemberStatus.ACTIVE },
      relations: { user: true },
    });

    const recipients = members.filter((m) => m.userId && m.userId !== senderId && m.user?.fcmToken);
    const senderName = message.sender.displayName ?? 'User';
    const preview = message.imageUrl ? '📷 Photo' : (message.text ?? '');

    await Promise.allSettled(
      recipients.map((m) =>
        this.notifications.send(
          m.user!.fcmToken!,
          { title: senderName, body: preview },
          { type: 'chat_message', groupId },
        ),
      ),
    );
  }

  async uploadChatImage(
    groupId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('IMAGE_FILE_REQUIRED');
    try {
      await this.assertMembership(groupId, userId);
    } catch (err) {
      await unlink(file.path).catch(() => {});
      throw err;
    }

    // Photos shared in at full camera resolution can be several MB — downscale to a
    // size sane for a chat thumbnail so it actually loads promptly on-device.
    const resized = await sharp(file.path)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    await writeFile(file.path, resized);

    return { url: `/uploads/chat/${file.filename}` };
  }

  private async assertMembership(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId, status: MemberStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenException('GROUP_ACCESS_DENIED');
    return membership;
  }

  private async assertAdmin(groupId: string, userId: string): Promise<GroupMember> {
    const membership = await this.membersRepo.findOne({
      where: { groupId, userId, role: MemberRole.ADMIN, status: MemberStatus.ACTIVE },
    });
    if (!membership) throw new ForbiddenException('ADMIN_ONLY_ACTION');
    return membership;
  }
}
