import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [FirebaseModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
