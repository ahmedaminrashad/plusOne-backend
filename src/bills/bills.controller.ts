import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BillsService } from './bills.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { ParseQrDto } from './dto/parse-qr.dto';
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

  @Get(':id')
  getBillDetail(@Param('id') id: string, @CurrentUser() user: any) {
    return this.billsService.getBillDetail(id, user.id);
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

  @Post('group/:groupId/parse-qr')
  parseQr(
    @Param('groupId') groupId: string,
    @Body() dto: ParseQrDto,
    @CurrentUser() user: any,
  ) {
    return this.billsService.parseQr(groupId, user.id, dto.payload);
  }

  @Post('group/:groupId/parse-receipt')
  @UseInterceptors(FileInterceptor('image'))
  parseReceipt(
    @Param('groupId') groupId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() _user: any,
  ) {
    if (!file) throw new BadRequestException('IMAGE_FILE_REQUIRED');
    // OCR integration scaffold — requires GOOGLE_VISION_API_KEY or AWS credentials
    // Return a structured response indicating OCR is not yet configured
    return {
      success: false,
      fallback: 'manual',
      reason: 'OCR service not configured',
    };
  }
}
