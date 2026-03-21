import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PrismaService } from '@/prisma.service';
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
export class AdjustmentController {
  constructor(
    private readonly adjustment: AdjustmentService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * PATCH /adjustment/fixture/:id/result
   * Record a match result manually, then settle open bets and run calibration.
   */
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

  /**
   * POST /adjustment/settle-and-check/:fixtureId
   * Settles open bets for a fixture, then checks calibration and auto-applies if triggered.
   */
  @Post('settle-and-check/:fixtureId')
  async settleAndCheck(@Param('fixtureId') fixtureId: string) {
    return this.adjustment.settleAndCheck(fixtureId);
  }

  /**
   * GET /adjustment
   * Lists all AdjustmentProposals, most recent first.
   */
  @Get()
  async listProposals() {
    return this.adjustment.listProposals();
  }

  /**
   * POST /adjustment/:id/rollback
   * Creates a new APPLIED proposal that reverts the weights to before the target proposal.
   */
  @Post(':id/rollback')
  async rollback(@Param('id') id: string) {
    return this.adjustment.rollback(id);
  }
}
