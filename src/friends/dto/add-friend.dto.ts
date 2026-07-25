import { IsString, Matches, IsOptional, MaxLength } from 'class-validator';

export class AddFriendDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{6,14}$/, { message: 'PHONE_INVALID' })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
