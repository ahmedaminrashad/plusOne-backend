import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Friend, FriendStatus } from './entities/friend.entity';
import { User } from '../users/entities/user.entity';
import { AddFriendDto } from './dto/add-friend.dto';
import { InviteLinksService } from '../links/invite-links.service';
import { InviteKind } from '../links/invite-link.entity';
import { normalizeEgPhone, phoneLookupVariants } from '../common/utils/phone';

export interface AddFriendResult extends Friend {
  onPlusOne: boolean;
  created: boolean;
  shareText?: string;
  shareUrl?: string;
}

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friend) private friendsRepo: Repository<Friend>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private readonly invites: InviteLinksService,
  ) {}

  async listCircle(ownerUserId: string): Promise<Friend[]> {
    return this.friendsRepo.find({
      where: { ownerUserId },
      relations: { friend: true },
      order: { createdAt: 'DESC' },
    });
  }

  async lookupRegistered(phones: string[]): Promise<{ registered: string[] }> {
    const variants = phones.flatMap((p) => phoneLookupVariants(p));
    if (variants.length === 0) return { registered: [] };
    const users = await this.usersRepo.find({ where: { phone: In([...new Set(variants)]) } });
    const registeredNorm = new Set(users.map((u) => normalizeEgPhone(u.phone)));
    return {
      registered: phones.filter((p) => registeredNorm.has(normalizeEgPhone(p))),
    };
  }

  async addFriend(ownerUserId: string, dto: AddFriendDto): Promise<AddFriendResult> {
    const phone = normalizeEgPhone(dto.phone);
    const owner = await this.usersRepo.findOneOrFail({ where: { id: ownerUserId } });
    if (phoneLookupVariants(owner.phone).includes(phone) || owner.phone === phone) {
      throw new BadRequestException('CANNOT_ADD_SELF');
    }

    const registeredUser = await this.usersRepo.findOne({
      where: { phone: In(phoneLookupVariants(phone)) },
    });

    const existing = await this.friendsRepo.findOne({
      where: registeredUser
        ? { ownerUserId, friendUserId: registeredUser.id }
        : { ownerUserId, pendingPhone: In(phoneLookupVariants(phone)) },
      relations: { friend: true },
    });

    if (existing) {
      return this.decorate(existing, owner, false);
    }

    const saved = await this.friendsRepo.save(
      this.friendsRepo.create({
        ownerUserId,
        friendUserId: registeredUser?.id ?? undefined,
        pendingPhone: registeredUser ? undefined : phone,
        displayName: registeredUser ? undefined : dto.displayName,
        status: registeredUser ? FriendStatus.ACTIVE : FriendStatus.PENDING,
      }),
    );
    const full = await this.friendsRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { friend: true },
    });
    return this.decorate(full, owner, true);
  }

  async shareInvite(ownerUserId: string, friendId: string): Promise<AddFriendResult> {
    const owner = await this.usersRepo.findOneOrFail({ where: { id: ownerUserId } });
    const friend = await this.friendsRepo.findOne({
      where: { id: friendId, ownerUserId },
      relations: { friend: true },
    });
    if (!friend) throw new NotFoundException('FRIEND_NOT_FOUND');
    return this.decorate(friend, owner, false);
  }

  async removeFriend(ownerUserId: string, friendId: string): Promise<void> {
    const friend = await this.friendsRepo.findOne({ where: { id: friendId } });
    if (!friend || friend.ownerUserId !== ownerUserId) {
      throw new NotFoundException('FRIEND_NOT_FOUND');
    }
    await this.friendsRepo.remove(friend);
  }

  private async decorate(friend: Friend, owner: User, created: boolean): Promise<AddFriendResult> {
    const onPlusOne = friend.status === FriendStatus.ACTIVE && !!friend.friendUserId;
    const result = Object.assign(friend, { onPlusOne, created }) as AddFriendResult;
    if (!onPlusOne && friend.pendingPhone) {
      const lang = owner.language === 'ar' ? 'ar' : 'en';
      const invite = await this.invites.issue({
        ownerUserId: owner.id,
        kind: InviteKind.CIRCLE,
        phone: friend.pendingPhone,
        inviterName: owner.displayName ?? '',
        language: lang,
      });
      result.shareText = invite.message;
      result.shareUrl = invite.url;
    }
    return result;
  }
}
