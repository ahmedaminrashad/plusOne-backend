import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LineItemDto } from './create-bill.dto';
import { CreateShareDto } from '../../shares/dto/create-share.dto';

export class UpdateBillItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShareDto)
  shares: CreateShareDto[];
}
