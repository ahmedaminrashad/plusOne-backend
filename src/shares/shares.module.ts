import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Share } from './entities/share.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { SharesService } from './shares.service';
import { SharesStateService } from './shares-state.service';
import { SharesController } from './shares.controller';
import { SharesReminderScheduler } from './shares-reminder.scheduler';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Share, GroupMember]),
    AuditModule,
    NotificationsModule,
  ],
  controllers: [SharesController],
  providers: [SharesService, SharesStateService, SharesReminderScheduler],
  exports: [SharesService],
})
export class SharesModule {}
