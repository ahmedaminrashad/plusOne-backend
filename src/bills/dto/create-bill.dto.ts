import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateShareDto } from '../../shares/dto/create-share.dto';

export class LineItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  qty: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  unitPrice: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  claimedBy?: string[];
}

export class CreateBillDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

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

  @IsOptional()
  @IsEnum(['qr', 'manual', 'ocr'])
  captureMethod?: 'qr' | 'manual' | 'ocr';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  venueName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems?: LineItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsOptional()
  @IsEnum(['percent', 'amount'])
  taxType?: 'percent' | 'amount';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  service?: number;

  @IsOptional()
  @IsEnum(['percent', 'amount'])
  serviceType?: 'percent' | 'amount';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tip?: number;

  @IsOptional()
  @IsEnum(['percent', 'amount'])
  tipType?: 'percent' | 'amount';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShareDto)
  shares?: CreateShareDto[];
}
