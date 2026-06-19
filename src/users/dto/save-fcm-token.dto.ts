import { IsString, IsNotEmpty } from 'class-validator';

export class SaveFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
