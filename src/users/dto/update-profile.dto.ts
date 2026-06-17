import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 50, { message: 'يجب أن يكون الاسم بين 2 و 50 حرفاً' })
  @Matches(/^[؀-ۿa-zA-Z\s'-]+$/, {
    message: 'الاسم يحتوي على أحرف غير مسموح بها',
  })
  displayName?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9._@-]{3,50}$/, {
    message: 'اسم InstaPay غير صحيح',
  })
  instaPayAlias?: string;
}
