import { IsArray, ArrayMinSize, IsString, Matches } from 'class-validator';

export class InviteMembersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    each: true,
    message: 'PHONE_INVALID',
  })
  phones: string[];
}
