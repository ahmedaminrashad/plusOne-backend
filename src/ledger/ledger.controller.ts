import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('group/:groupId')
  getGroupLedger(@Param('groupId') groupId: string, @CurrentUser() user: any) {
    return this.ledgerService.getGroupLedger(groupId, user.id);
  }
}
