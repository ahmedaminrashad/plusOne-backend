import { IsEnum } from 'class-validator';
import { ShareFailureReason } from '../entities/share.entity';

export class FailShareDto {
  @IsEnum(ShareFailureReason, { message: 'FAIL_REASON_REQUIRED' })
  reason: ShareFailureReason;
}
