import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'رقم الهاتف غير صحيح',
  })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'الكود الذي أدخلته غير صحيح' })
  @Matches(/^\d{6}$/, { message: 'الكود الذي أدخلته غير صحيح' })
  code: string;
}
