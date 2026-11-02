import { Global, Module } from '@nestjs/common';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';
import { IntegrationsTestService } from './integrations-test.service';

/**
 * Réglages › Intégrations. Global: the ETL clients, the mail, the push and
 * the storage read their keys through it.
 */
@Global()
@Module({
  providers: [
    IntegrationsRepository,
    IntegrationsService,
    IntegrationsTestService,
  ],
  exports: [IntegrationsService, IntegrationsTestService],
})
export class IntegrationsModule {}
