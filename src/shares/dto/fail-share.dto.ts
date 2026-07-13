import { IsEnum } from 'class-validator';
import { ShareFailureReason } from '../entities/share.entity';

export class FailShareDto {
  @IsEnum(ShareFailureReason, { message: 'يجب اختيار سبب لتعليم الدفع كفاشل' })
  reason: ShareFailureReason;
}
