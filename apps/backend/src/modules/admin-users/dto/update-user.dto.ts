import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['ADMIN', 'OPERATOR'])
  role?: 'ADMIN' | 'OPERATOR';

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}
