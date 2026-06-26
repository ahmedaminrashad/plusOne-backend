import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { Bill } from './entities/bill.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { QrParserService } from './qr-parser/qr-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bill, GroupMember]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [BillsController],
  providers: [BillsService, QrParserService],
})
export class BillsModule {}
