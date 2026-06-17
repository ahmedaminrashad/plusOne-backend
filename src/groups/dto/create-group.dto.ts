import { IsString, IsOptional, Length, IsEnum } from 'class-validator';
import { GroupCategory } from '../entities/group.entity';

export class CreateGroupDto {
  @IsString()
  @Length(1, 50, { message: 'اسم المجموعة طويل جداً (أقصى 50 حرف)' })
  name: string;

  @IsOptional()
  @IsEnum(GroupCategory)
  category?: GroupCategory;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
