import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, Matches } from 'class-validator';

export class LookupPhonesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(/^\+?[1-9]\d{6,14}$/, { each: true, message: 'PHONE_INVALID' })
  phones: string[];
}
