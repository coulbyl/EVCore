import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { ReportsService } from './reports.service';
import { MlPromotionQueryDto } from './dto/ml-promotion-query.dto';
import type { MlPromotionReport } from './reports.types';

@Controller('reports')
@UseGuards(AuthSessionGuard, AdminGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // ML promotion decision board — baseline vs shadow-corrected performance per
  // segment, with a deterministic GO/WATCH/NO-GO verdict. Admin only.
  @Get('ml-promotion')
  async mlPromotion(
    @Query() query: MlPromotionQueryDto,
  ): Promise<MlPromotionReport> {
    return this.reports.getMlPromotionReport(query.window ?? 'P30D');
  }
}
