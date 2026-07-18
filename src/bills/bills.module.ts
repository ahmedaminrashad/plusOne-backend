import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { Bill } from './entities/bill.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { QrParserService } from './qr-parser/qr-parser.service';
import { MindeeOcrService } from './ocr/mindee-ocr.service';
import { SharesModule } from '../shares/shares.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bill, GroupMember]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
    SharesModule,
    NotificationsModule,
  ],
  controllers: [BillsController],
  providers: [BillsService, QrParserService, MindeeOcrService],
})
export class BillsModule {}
