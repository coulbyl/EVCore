import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { MlService } from './ml.service';
import { TriggerTrainingDto } from './dto/trigger-training.dto';

@Controller('ml')
@UseGuards(AuthSessionGuard)
export class MlController {
  constructor(private readonly ml: MlService) {}

  private assertAdmin(session: AuthSession): void {
    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
  }

  @Post('train')
  async triggerTraining(
    @Body() dto: TriggerTrainingDto,
    @CurrentSession() session: AuthSession,
  ): Promise<{ jobId: string }> {
    this.assertAdmin(session);
    return this.ml.triggerTraining(dto.segment, session.user.id);
  }

  @Get('models')
  async listModels(@CurrentSession() session: AuthSession) {
    this.assertAdmin(session);
    return this.ml.listModels();
  }

  @Get('models/active')
  async getActiveModel(
    @Query('segment') segment: string,
    @CurrentSession() _session: AuthSession,
  ) {
    return this.ml.getActiveModel(segment ?? 'ALL');
  }

  @Post('models/:id/activate')
  async activateModel(
    @Param('id') id: string,
    @CurrentSession() session: AuthSession,
  ) {
    this.assertAdmin(session);
    return this.ml.activateModel(id);
  }
}
