import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friend, FriendStatus } from './entities/friend.entity';
import { User } from '../users/entities/user.entity';
import { AddFriendDto } from './dto/add-friend.dto';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friend) private friendsRepo: Repository<Friend>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async listCircle(ownerUserId: string): Promise<Friend[]> {
    return this.friendsRepo.find({
      where: { ownerUserId },
      relations: { friend: true },
      order: { createdAt: 'DESC' },
    });
  }

  async addFriend(ownerUserId: string, dto: AddFriendDto): Promise<Friend> {
    const owner = await this.usersRepo.findOneOrFail({ where: { id: ownerUserId } });
    if (dto.phone === owner.phone) {
      throw new BadRequestException('CANNOT_ADD_SELF');
    }

    const registeredUser = await this.usersRepo.findOne({ where: { phone: dto.phone } });

    const existing = await this.friendsRepo.findOne({
      where: registeredUser
        ? { ownerUserId, friendUserId: registeredUser.id }
        : { ownerUserId, pendingPhone: dto.phone },
    });
    if (existing) {
      throw new ConflictException('ALREADY_IN_CIRCLE');
    }

    const entity = this.friendsRepo.create({
      ownerUserId,
      friendUserId: registeredUser?.id ?? undefined,
      pendingPhone: registeredUser ? undefined : dto.phone,
      displayName: registeredUser ? undefined : dto.displayName,
      status: registeredUser ? FriendStatus.ACTIVE : FriendStatus.PENDING,
    });
    const saved = await this.friendsRepo.save(entity);

    return this.friendsRepo.findOneOrFail({ where: { id: saved.id }, relations: { friend: true } });
  }

  async removeFriend(ownerUserId: string, friendId: string): Promise<void> {
    const friend = await this.friendsRepo.findOne({ where: { id: friendId } });
    if (!friend || friend.ownerUserId !== ownerUserId) {
      throw new NotFoundException('FRIEND_NOT_FOUND');
    }
    await this.friendsRepo.remove(friend);
  }
}
