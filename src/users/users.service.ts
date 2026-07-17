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
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    return user;
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { phone } });
  }

  async saveFcmToken(id: string, fcmToken: string): Promise<void> {
    // A device's token can only be valid for one logged-in account at a time —
    // if another user previously registered this same device, drop it from them
    // first so they stop receiving pushes meant for whoever is logged in now.
    await this.usersRepo.update({ fcmToken }, { fcmToken: null as unknown as string });
    await this.usersRepo.update(id, { fcmToken });
  }

  async saveLanguage(id: string, language: 'ar' | 'en'): Promise<void> {
    await this.usersRepo.update(id, { language });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    console.log('Updating profile for user ID:', id, 'with data:', dto);
    const user = await this.findById(id);

    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.photoUrl !== undefined) user.photoUrl = dto.photoUrl;
    if (dto.instaPayAlias !== undefined) user.instaPayAlias = dto.instaPayAlias;

    const hasRequiredFields = !!user.displayName;
    user.isProfileComplete = hasRequiredFields;

    return this.usersRepo.save(user);
  }
}
