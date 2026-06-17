import { IsString, IsIn, IsOptional, IsEmail } from 'class-validator';

export class SocialLoginDto {
  @IsString()
  @IsIn(['google', 'apple'])
  provider: 'google' | 'apple';

  @IsString()
  idToken: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
