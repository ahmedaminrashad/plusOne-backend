import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayLinkController } from './pay-link.controller';
import { PayLinkService } from './pay-link.service';
import { Share } from '../shares/entities/share.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Share])],
  controllers: [PayLinkController],
  providers: [PayLinkService],
})
export class PayLinkModule {}
