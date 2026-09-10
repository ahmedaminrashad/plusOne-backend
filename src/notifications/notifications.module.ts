import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseModule } from '../firebase/firebase.module';
import { NotificationsService } from './notifications.service';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [FirebaseModule, TypeOrmModule.forFeature([User])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
