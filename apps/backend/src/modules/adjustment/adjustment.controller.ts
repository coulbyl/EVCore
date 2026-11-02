import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, Min } from 'class-validator';
import { AdminOrServiceTokenGuard } from '@modules/auth/admin-or-service-token.guard';
import { AdjustmentService } from './adjustment.service';

class SetFixtureResultDto {
  @IsInt()
  @Min(0)
  homeScore!: number;

  @IsInt()
  @Min(0)
  awayScore!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  homeHtScore?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  awayHtScore?: number;
}

// The operations routes' guard: an admin's session or the service token
// (x-admin-token), so the human rollback CLAUDE.md requires can be run from
// docs/exploitation.md.
@Controller('adjustment')
@UseGuards(AdminOrServiceTokenGuard)
export class AdjustmentController {
  constructor(private readonly adjustment: AdjustmentService) {}

  @Patch('fixture/:id/result')
  async setFixtureResult(
    @Param('id') id: string,
    @Body() dto: SetFixtureResultDto,
  ) {
    const result = await this.adjustment.setFixtureResult(id, {
      homeScore: dto.homeScore,
      awayScore: dto.awayScore,
      homeHtScore: dto.homeHtScore ?? null,
      awayHtScore: dto.awayHtScore ?? null,
    });
    if (!result) throw new NotFoundException(`Fixture ${id} not found`);
    return result;
  }

  @Post('settle-and-check/:fixtureId')
  async settleAndCheck(@Param('fixtureId') fixtureId: string) {
    return this.adjustment.settleAndCheck(fixtureId);
  }

  @Post('run-calibration')
  async runCalibration() {
    return this.adjustment.runCalibrationCheck();
  }

  @Get()
  async listProposals() {
    return this.adjustment.listProposals();
  }

  @Post(':id/rollback')
  async rollback(@Param('id') id: string) {
    return this.adjustment.rollback(id);
  }
}
