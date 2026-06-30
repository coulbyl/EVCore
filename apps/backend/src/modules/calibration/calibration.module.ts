import { Module } from '@nestjs/common';
import { CalibrationRepository } from './calibration.repository';

@Module({
  providers: [CalibrationRepository],
  exports: [CalibrationRepository],
})
export class CalibrationModule {}
