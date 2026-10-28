import { IsEnum, IsIn, ValidateIf } from 'class-validator';
import { ProductEventType } from '@evcore/db';

/** Types de notification dont on mesure l'ouverture. */
export const TRACKED_NOTIFICATION_TYPES = [
  'MORNING_BRIEF',
  'WEEKLY_STATEMENT',
] as const;

export class RecordEventDto {
  @IsEnum(ProductEventType)
  type!: ProductEventType;

  /** Obligatoire pour NOTIFICATION_OPENED : la notification d'origine. */
  @ValidateIf(
    (dto: RecordEventDto) =>
      dto.type === ProductEventType.NOTIFICATION_OPENED ||
      dto.notificationType !== undefined,
  )
  @IsIn(TRACKED_NOTIFICATION_TYPES)
  notificationType?: (typeof TRACKED_NOTIFICATION_TYPES)[number];
}
