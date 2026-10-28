import { IsIn } from 'class-validator';
import {
  PAUSE_DURATIONS_DAYS,
  type PauseDurationDays,
} from '@config/pause.constants';

export class PauseAccountDto {
  @IsIn(PAUSE_DURATIONS_DAYS)
  days!: PauseDurationDays;
}
