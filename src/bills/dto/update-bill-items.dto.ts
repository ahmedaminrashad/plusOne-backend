import { IsArray, IsEnum, IsNumber, IsOptional, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LineItemDto } from './create-bill.dto';
import { CreateShareDto } from '../../shares/dto/create-share.dto';

function nullableNumber({ value }: { value: unknown }): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return Number(value);
}

export class UpdateBillItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShareDto)
  shares: CreateShareDto[];

  @IsOptional()
  @Transform(nullableNumber)
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  @Min(0)
  tax?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsEnum(['percent', 'amount'])
  taxType?: 'percent' | 'amount' | null;

  @IsOptional()
  @Transform(nullableNumber)
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  @Min(0)
  delivery?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsEnum(['percent', 'amount'])
  deliveryType?: 'percent' | 'amount' | null;

  @IsOptional()
  @Transform(nullableNumber)
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  @Min(0)
  vat?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsEnum(['percent', 'amount'])
  vatType?: 'percent' | 'amount' | null;
}
