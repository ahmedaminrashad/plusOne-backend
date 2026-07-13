import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SharesService } from './shares.service';
import { FailShareDto } from './dto/fail-share.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Get('bill/:billId')
  getBillShares(@Param('billId') billId: string) {
    return this.sharesService.getBillShares(billId);
  }

  @Post(':id/pay')
  payShare(@Param('id') id: string, @CurrentUser() user: any) {
    return this.sharesService.payShare(id, user.id);
  }

  @Post(':id/cancel-initiation')
  cancelInitiation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.sharesService.cancelInitiation(id, user.id);
  }

  @Post(':id/confirm')
  confirmShare(@Param('id') id: string, @CurrentUser() user: any) {
    return this.sharesService.confirmShare(id, user.id);
  }

  @Post(':id/fail')
  failShare(@Param('id') id: string, @Body() dto: FailShareDto, @CurrentUser() user: any) {
    return this.sharesService.failShare(id, user.id, dto);
  }

  @Post(':id/remind')
  sendReminder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.sharesService.sendReminder(id, user.id);
  }

  @Post('bill/:billId/remind-all')
  remindAllPending(@Param('billId') billId: string, @CurrentUser() user: any) {
    return this.sharesService.remindAllPending(billId, user.id);
  }
}
