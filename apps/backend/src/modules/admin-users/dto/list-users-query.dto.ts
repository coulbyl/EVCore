import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['ALL', 'ADMIN', 'OPERATOR'])
  role?: 'ALL' | 'ADMIN' | 'OPERATOR';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(200)
  @Type(() => Number)
  pageSize?: number;
}
