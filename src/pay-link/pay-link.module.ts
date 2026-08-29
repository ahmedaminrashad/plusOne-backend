import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayLinkController, LegacyPayLinkController, SharePayLinkController } from './pay-link.controller';
import { PayLinkService } from './pay-link.service';
import { Share } from '../shares/entities/share.entity';
import { PayLinkToken } from '../links/pay-link-token.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { SharesModule } from '../shares/shares.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Share, PayLinkToken, GroupMember]),
    SharesModule,
    NotificationsModule,
  ],
  controllers: [PayLinkController, LegacyPayLinkController, SharePayLinkController],
  providers: [PayLinkService],
})
export class PayLinkModule {}
