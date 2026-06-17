import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { phone } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);

    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.photoUrl !== undefined) user.photoUrl = dto.photoUrl;
    if (dto.instaPayAlias !== undefined) user.instaPayAlias = dto.instaPayAlias;

    const hasRequiredFields = !!user.displayName;
    user.isProfileComplete = hasRequiredFields;

    return this.usersRepo.save(user);
  }
}
