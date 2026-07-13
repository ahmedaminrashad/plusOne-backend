import { IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'PHONE_INVALID',
  })
  phone: string;
}
