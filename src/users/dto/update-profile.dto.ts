import { IsString, IsOptional, Length, Matches, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'DISPLAY_NAME_LENGTH_INVALID' })
  @Matches(/^[؀-ۿa-zA-Z\s'-]+$/, {
    message: 'DISPLAY_NAME_CHARS_INVALID',
  })
  displayName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  instaPayAlias?: string | null;
}
