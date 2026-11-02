import { Global, Module } from '@nestjs/common';
import { AppSettingRepository } from './app-setting.repository';
import { AppSettingService } from './app-setting.service';

/**
 * The operator switches (12-admin § 4), the scheduled-passes switch among
 * them. Global: the ETL, the stats backfill and the schedulers read them;
 * the worker applies the switch (SchedulingSwitchModule).
 */
@Global()
@Module({
  providers: [AppSettingRepository, AppSettingService],
  exports: [AppSettingService, AppSettingRepository],
})
export class AppSettingModule {}
