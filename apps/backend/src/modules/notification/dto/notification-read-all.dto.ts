import { IsIn, IsOptional } from 'class-validator';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from './notification-query.dto';

/** « Tout marquer comme lu », within the screen's kind filter. */
export class NotificationReadAllDto {
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: NotificationCategory;
}
