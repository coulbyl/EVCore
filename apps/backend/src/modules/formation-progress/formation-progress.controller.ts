import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { FormationContentType } from '@evcore/db';
import { FormationProgressService } from './formation-progress.service';
import { UpsertFormationProgressDto } from './dto/formation-progress.dto';

@Controller('formation/progress')
@UseGuards(AuthSessionGuard)
export class FormationProgressController {
  constructor(private readonly service: FormationProgressService) {}

  @Get()
  list(@CurrentSession() session: AuthSession) {
    return this.service.list(session.user.id);
  }

  @Post()
  upsert(
    @CurrentSession() session: AuthSession,
    @Body() body: UpsertFormationProgressDto,
  ) {
    return this.service.upsert({
      userId: session.user.id,
      contentType: body.contentType,
      slug: body.slug,
    });
  }

  @Delete(':type/:slug')
  remove(
    @CurrentSession() session: AuthSession,
    @Param('type') type: keyof typeof FormationContentType,
    @Param('slug') slug: string,
  ) {
    const contentType = FormationContentType[type];
    return this.service.remove({ userId: session.user.id, contentType, slug });
  }
}
