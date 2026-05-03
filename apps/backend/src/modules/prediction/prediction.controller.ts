import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { PredictionService } from './prediction.service';
import {
  PredictionListQueryDto,
  PredictionStatsQueryDto,
} from './dto/prediction-query.dto';

@Controller('predictions')
@UseGuards(AuthSessionGuard)
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Get()
  list(@Query() query: PredictionListQueryDto) {
    const today = new Date().toISOString().slice(0, 10);
    return this.predictionService.list(
      query.date ?? today,
      query.competition,
      query.channel,
    );
  }

  @Get('stats')
  stats(@Query() query: PredictionStatsQueryDto) {
    const today = new Date().toISOString().slice(0, 10);
    return this.predictionService.stats({
      from: query.from ?? today,
      to: query.to ?? today,
      competition: query.competition,
      channel: query.channel,
    });
  }
}
