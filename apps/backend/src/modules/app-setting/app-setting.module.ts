import { Global, Module } from '@nestjs/common';
import { AppSettingRepository } from './app-setting.repository';
import { AppSettingService } from './app-setting.service';
import { SchedulingSwitchService } from './scheduling-switch.service';

/**
 * The operator switches (12-admin § 4) and the scheduled-passes switch.
 * Global: the ETL, the stats backfill and the schedulers read them.
 */
@Global()
@Module({
  providers: [AppSettingRepository, AppSettingService, SchedulingSwitchService],
  exports: [AppSettingService],
})
export class AppSettingModule {}
