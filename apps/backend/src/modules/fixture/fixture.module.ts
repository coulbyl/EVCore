import { Module } from '@nestjs/common';
import { AdjustmentModule } from '@modules/adjustment/adjustment.module';
import { PrismaModule } from '../../prisma.module';
import { FixtureController } from './fixture.controller';
import { FixtureRepository } from './fixture.repository';
import { FixtureService } from './fixture.service';

@Module({
  imports: [PrismaModule, AdjustmentModule],
  controllers: [FixtureController],
  providers: [FixtureRepository, FixtureService],
  exports: [FixtureService],
})
export class FixtureModule {}
