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
import { PrismaService } from '@/prisma.service';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
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

@Controller('adjustment')
@UseGuards(AuthSessionGuard, AdminGuard)
export class AdjustmentController {
  constructor(
    private readonly adjustment: AdjustmentService,
    private readonly prisma: PrismaService,
  ) {}

  @Patch('fixture/:id/result')
  async setFixtureResult(
    @Param('id') id: string,
    @Body() dto: SetFixtureResultDto,
  ) {
    const fixture = await this.prisma.client.fixture.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!fixture) throw new NotFoundException(`Fixture ${id} not found`);

    await this.prisma.client.fixture.update({
      where: { id },
      data: {
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        homeHtScore: dto.homeHtScore ?? null,
        awayHtScore: dto.awayHtScore ?? null,
        status: 'FINISHED',
      },
    });

    const settle = await this.adjustment.settleAndCheck(id);
    return { fixtureId: id, ...settle };
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
