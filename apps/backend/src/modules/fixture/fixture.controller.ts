import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { AdjustmentService } from '@modules/adjustment/adjustment.service';
import { FixtureRepository } from './fixture.repository';
import { SetFixtureResultDto } from './dto/set-fixture-result.dto';

@Controller('fixture')
export class FixtureController {
  constructor(
    private readonly fixtureRepo: FixtureRepository,
    private readonly adjustment: AdjustmentService,
  ) {}

  /**
   * PATCH /fixture/:id/result
   * Manually record a match result, then settle open bets and run calibration.
   */
  @Patch(':id/result')
  async setResult(@Param('id') id: string, @Body() dto: SetFixtureResultDto) {
    const fixture = await this.fixtureRepo.setResultById(id, {
      homeScore: dto.homeScore,
      awayScore: dto.awayScore,
      homeHtScore: dto.homeHtScore ?? null,
      awayHtScore: dto.awayHtScore ?? null,
    });
    if (!fixture) throw new NotFoundException(`Fixture ${id} not found`);

    const settle = await this.adjustment.settleAndCheck(id);
    return { fixtureId: id, ...settle };
  }
}
