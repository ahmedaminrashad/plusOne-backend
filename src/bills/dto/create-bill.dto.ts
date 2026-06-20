import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBillDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @IsNotEmpty()
  paidByUserId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptPhotoUrl?: string;
}
