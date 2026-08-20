import { IsString, Length } from 'class-validator';

export class UpdateGroupDto {
  @IsString()
  @Length(1, 50, { message: 'GROUP_NAME_TOO_LONG' })
  name: string;
}
