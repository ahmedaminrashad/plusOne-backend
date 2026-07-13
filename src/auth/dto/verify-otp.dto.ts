import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'PHONE_INVALID',
  })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'OTP_FORMAT_INVALID' })
  @Matches(/^\d{6}$/, { message: 'OTP_FORMAT_INVALID' })
  code: string;
}
