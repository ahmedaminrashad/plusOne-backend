import { IsIn } from 'class-validator';

export class SaveLanguageDto {
  @IsIn(['ar', 'en'])
  language: 'ar' | 'en';
}
