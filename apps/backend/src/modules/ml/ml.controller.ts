import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { TriggerTrainingDto } from './dto/trigger-training.dto';

@Controller('ml')
@UseGuards(AuthSessionGuard)
export class MlController {
  constructor(private readonly ml: MlService) {}

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

  @Post('models/:id/activate')
  @UseGuards(AdminGuard)
  async activateModel(@Param('id') id: string) {
    return this.ml.activateModel(id);
  }

  @Post('models/:id/rollback')
  @UseGuards(AdminGuard)
  async rollbackModel(@Param('id') id: string) {
    return this.ml.rollbackModel(id);
  }

  @Delete('models/:id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async deleteModel(@Param('id') id: string): Promise<void> {
    return this.ml.deleteModel(id);
  }

  @Post('retrain-check')
  @UseGuards(AdminGuard)
  async triggerRetrainCheck(@CurrentSession() session: AuthSession) {
    return this.ml.forceRetrain(`admin:${session.user.id}`);
  }

  @Post('catch-up-switch')
  @UseGuards(AdminGuard)
  async triggerCatchUpSwitch(): Promise<{ status: string }> {
    await this.ml.catchUpAutoSwitch();
    return { status: 'ok' };
  }
}
