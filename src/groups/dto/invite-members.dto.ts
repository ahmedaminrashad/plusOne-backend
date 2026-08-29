import { IsArray, ArrayMinSize, IsString, Matches, IsOptional, MaxLength } from 'class-validator';

export class InviteMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    each: true,
    message: 'PHONE_INVALID',
  })
  phones: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  names?: string[];
}

