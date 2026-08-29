import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { Friend } from './entities/friend.entity';
import { User } from '../users/entities/user.entity';
import { LinksModule } from '../links/links.module';

@Module({
  imports: [TypeOrmModule.forFeature([Friend, User]), LinksModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
