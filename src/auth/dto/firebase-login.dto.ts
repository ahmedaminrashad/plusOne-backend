import { IsString, MinLength } from 'class-validator';

export class FirebaseLoginDto {
  @IsString()
  @MinLength(20, { message: 'FIREBASE_TOKEN_INVALID' })
  idToken: string;
}
