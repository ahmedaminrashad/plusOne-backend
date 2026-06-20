import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bills')
@UseGuards(JwtAuthGuard)
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get('group/:groupId')
  getGroupBills(@Param('groupId') groupId: string, @CurrentUser() user: any) {
    return this.billsService.getGroupBills(groupId, user.id);
  }

  @Post('group/:groupId')
  createBill(
    @Param('groupId') groupId: string,
    @Body() dto: CreateBillDto,
    @CurrentUser() user: any,
  ) {
    return this.billsService.createBill(groupId, user.id, dto);
  }

  @Delete(':id')
  deleteBill(@Param('id') id: string, @CurrentUser() user: any) {
    return this.billsService.deleteBill(id, user.id);
  }
}
