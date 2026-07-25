import { IsEnum, IsOptional } from 'class-validator';
import { ShareMethod } from '../entities/share.entity';

export class PayShareDto {
  @IsOptional()
  @IsEnum(ShareMethod, { message: 'INVALID_SHARE_METHOD' })
  method?: ShareMethod;
}
