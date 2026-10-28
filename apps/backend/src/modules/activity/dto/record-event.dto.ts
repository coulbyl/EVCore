import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { ProductEventType } from '@evcore/db';

/** Types de notification dont on mesure l'ouverture. */
export const TRACKED_NOTIFICATION_TYPES = [
  'MORNING_BRIEF',
  'WEEKLY_STATEMENT',
] as const;

export class RecordEventDto {
  @IsEnum(ProductEventType)
  type!: ProductEventType;

  /** Pour NOTIFICATION_OPENED : la notification d'origine. */
  @IsOptional()
  @IsIn(TRACKED_NOTIFICATION_TYPES)
  notificationType?: (typeof TRACKED_NOTIFICATION_TYPES)[number];
}
