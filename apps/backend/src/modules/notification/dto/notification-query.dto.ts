import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class NotificationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  unread?: boolean;
}
