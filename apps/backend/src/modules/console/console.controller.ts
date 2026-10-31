import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import type { PassView } from './console-passes';
import { ConsolePassesService } from './console-passes.service';
import { ConsoleService } from './console.service';
import type { ConsoleStatus } from './console.types';

/** The admin (docs/refonte-ui/12-admin.md). Admin accounts only. */
@ApiTags('console')
@Controller('console')
@UseGuards(AuthSessionGuard, AdminGuard)
export class ConsoleController {
  constructor(
    private readonly console: ConsoleService,
    private readonly passes: ConsolePassesService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'The three lights and « À faire »',
    description:
      'Données, Moteur, Joueurs: green, orange or red by the rules written once in console.constants.ts; « À faire » lists what the system found, reds first, each with its figures.',
  })
  @ApiOkResponse({ description: 'The lights and the lines.' })
  getStatus(): Promise<ConsoleStatus> {
    return this.console.getStatus();
  }

  @Get('passes')
  @ApiOperation({
    summary: "Les passes d'aujourd'hui",
    description:
      'Each scheduled pass of the day with its time, its last run read from its queue, running, failed (with the queue message), waiting or missed, and whether it can be relaunched.',
  })
  @ApiOkResponse({ description: 'The passes, in the order of the day.' })
  getPasses(): Promise<PassView[]> {
    return this.passes.getPasses();
  }

  @Post('passes/:key/relaunch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Relancer a pass',
    description:
      'Adds the same job as the schedule. Refused (409) while it runs, once done, and for the morning brief, which writes to every player.',
  })
  @ApiOkResponse({ description: 'The pass after the relaunch.' })
  relaunch(@Param('key') key: string): Promise<PassView> {
    return this.passes.relaunch(key);
  }
}
