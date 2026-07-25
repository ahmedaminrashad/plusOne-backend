import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { Friend } from './entities/friend.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Friend, User])],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
