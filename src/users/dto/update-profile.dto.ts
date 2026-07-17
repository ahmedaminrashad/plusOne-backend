import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'DISPLAY_NAME_LENGTH_INVALID' })
  @Matches(/^[؀-ۿa-zA-Z\s'-]+$/, {
    message: 'DISPLAY_NAME_CHARS_INVALID',
  })
  displayName?: string;

  @IsOptional()
  @IsString()
  instaPayAlias?: string;
}
