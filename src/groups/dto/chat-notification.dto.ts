import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ChatNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  senderName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  messagePreview: string;
}
