import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { FixtureRepository } from './fixture.repository';
import { FixtureService } from './fixture.service';

@Module({
  imports: [PrismaModule],
  providers: [FixtureRepository, FixtureService],
  exports: [FixtureService],
})
export class FixtureModule {}
