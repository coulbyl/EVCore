import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { NotificationType } from '@evcore/db';

export type NotificationCategory = 'announcement' | 'alert';

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

  // Merged Notifications screen (docs/vantage-centric-redesign-2026-09-01.md
  // §0 point 3) — "announcement" is exactly ANNOUNCEMENT_PUBLISHED,
  // "alert" is every other type. Not a new data model: ANNOUNCEMENT_PUBLISHED
  // already mirrors a published Announcement into this same table
  // (notification.service.ts).
  @IsOptional()
  @IsIn(['announcement', 'alert'])
  category?: NotificationCategory;

  // Un seul type (le point de la semaine de l'Accueil lit le dernier
  // WEEKLY_STATEMENT). Toujours ET-é sur les types permis au rôle.
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
