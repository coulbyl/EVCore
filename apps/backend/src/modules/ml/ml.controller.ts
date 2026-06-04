import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { MlService } from './ml.service';
import { MlBackfillService } from './ml.backfill.service';
import { TriggerTrainingDto } from './dto/trigger-training.dto';

@Controller('ml')
@UseGuards(AuthSessionGuard)
export class MlController {
  constructor(
    private readonly ml: MlService,
    private readonly backfill: MlBackfillService,
  ) {}

  @Post('train')
  @UseGuards(AdminGuard)
  async triggerTraining(
    @Body() dto: TriggerTrainingDto,
    @CurrentSession() session: AuthSession,
  ): Promise<{ jobId: string }> {
    return this.ml.triggerTraining(dto.segment, session.user.id);
  }

  @Get('train/:jobId')
  @UseGuards(AdminGuard)
  async getTrainingJobStatus(@Param('jobId') jobId: string) {
    return this.ml.getTrainingJobStatus(jobId);
  }

  @Get('models')
  @UseGuards(AdminGuard)
  async listModels() {
    return this.ml.listModels();
  }

  @Get('models/active')
  async getActiveModel(@Query('segment') segment: string) {
    return this.ml.getActiveModel(segment ?? 'ALL');
  }

  @Post('backfill')
  @UseGuards(AdminGuard)
  async triggerBackfill() {
    return this.backfill.queueAllSeasons();
  }

  @Post('models/:id/activate')
  @UseGuards(AdminGuard)
  async activateModel(@Param('id') id: string) {
    return this.ml.activateModel(id);
  }
}
