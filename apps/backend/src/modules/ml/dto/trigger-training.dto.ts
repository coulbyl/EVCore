import { IsIn, IsString } from 'class-validator';
import { ML_SEGMENTS, type MlSegment } from '../ml.constants';

export class TriggerTrainingDto {
  @IsString()
  @IsIn(ML_SEGMENTS)
  segment!: MlSegment;
}
