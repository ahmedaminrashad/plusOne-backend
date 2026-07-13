import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bill } from '../bills/entities/bill.entity';
import { Share } from '../shares/entities/share.entity';
import { GroupMember } from '../groups/entities/group-member.entity';
import { LedgerService } from './ledger.service';
import { LedgerController } from './ledger.controller';
import { SharesModule } from '../shares/shares.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bill, Share, GroupMember]), SharesModule],
  controllers: [LedgerController],
  providers: [LedgerService],
})
export class LedgerModule {}
