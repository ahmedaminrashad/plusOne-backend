import { IsString, IsNotEmpty, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateShareDto {
  @IsString()
  @IsNotEmpty()
  groupMemberId: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amountPiastres: number;
}
