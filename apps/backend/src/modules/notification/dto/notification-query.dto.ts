import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NotificationType } from '@evcore/db';

export const NOTIFICATION_CATEGORIES = ['technical', 'player'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_READ_STATUSES = ['unread', 'read'] as const;
export type NotificationReadStatus =
  (typeof NOTIFICATION_READ_STATUSES)[number];

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

  /** The screen's « Non lues » / « Lues »; absent, both. */
  @IsOptional()
  @IsIn(NOTIFICATION_READ_STATUSES)
  status?: NotificationReadStatus;

  // "player" what a player's bell holds, "technical" everything else (only
  // an admin has them) — notification.service.ts, categoryOf.
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: NotificationCategory;

  // Un seul type (le point de la semaine de l'Accueil lit le dernier
  // WEEKLY_STATEMENT). Toujours ET-é sur les types permis au rôle.
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
