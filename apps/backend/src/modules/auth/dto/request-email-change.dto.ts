import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail()
  @MaxLength(254)
  newEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
