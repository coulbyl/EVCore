import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, Min } from 'class-validator';
import { PrismaService } from '@/prisma.service';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
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
@UseGuards(AuthSessionGuard)
export class AdjustmentController {
  constructor(
    private readonly adjustment: AdjustmentService,
    private readonly prisma: PrismaService,
  ) {}

  private assertAdmin(session: AuthSession): void {
    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
  }

  /**
   * PATCH /adjustment/fixture/:id/result
   * Record a match result manually, then settle open bets and run calibration.
   */
  @Patch('fixture/:id/result')
  async setFixtureResult(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() dto: SetFixtureResultDto,
  ) {
    this.assertAdmin(session);

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
  async settleAndCheck(
    @CurrentSession() session: AuthSession,
    @Param('fixtureId') fixtureId: string,
  ) {
    this.assertAdmin(session);
    return this.adjustment.settleAndCheck(fixtureId);
  }

  /**
   * POST /adjustment/run-calibration
   * Manually triggers calibration check and auto-apply if needed.
   * Does not settle any bets — reads existing settled bets only.
   */
  @Post('run-calibration')
  async runCalibration(@CurrentSession() session: AuthSession) {
    this.assertAdmin(session);
    return this.adjustment.runCalibrationCheck();
  }

  /**
   * GET /adjustment
   * Lists all AdjustmentProposals, most recent first.
   */
  @Get()
  async listProposals(@CurrentSession() session: AuthSession) {
    this.assertAdmin(session);
    return this.adjustment.listProposals();
  }

  /**
   * POST /adjustment/:id/rollback
   * Creates a new APPLIED proposal that reverts the weights to before the target proposal.
   */
  @Post(':id/rollback')
  async rollback(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ) {
    this.assertAdmin(session);
    return this.adjustment.rollback(id);
  }
}
