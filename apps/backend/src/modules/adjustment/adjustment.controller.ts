import { Controller, Get, Param, Post } from '@nestjs/common';
import { AdjustmentService } from './adjustment.service';

@Controller('adjustment')
export class AdjustmentController {
  constructor(private readonly adjustment: AdjustmentService) {}

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
