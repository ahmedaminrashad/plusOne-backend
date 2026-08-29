import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteLink } from './invite-link.entity';
import { PayLinkToken } from './pay-link-token.entity';
import { InviteLinksService } from './invite-links.service';
import { InviteLandingController } from './invite-landing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InviteLink, PayLinkToken])],
  controllers: [InviteLandingController],
  providers: [InviteLinksService],
  exports: [InviteLinksService, TypeOrmModule],
})
export class LinksModule {}
