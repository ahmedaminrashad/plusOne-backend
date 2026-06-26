import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ParseQrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  payload: string;
}
