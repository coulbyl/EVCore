import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { ConsoleService } from './console.service';
import type { ConsoleStatus } from './console.types';

/** The admin (docs/refonte-ui/12-admin.md). Admin accounts only. */
@ApiTags('console')
@Controller('console')
@UseGuards(AuthSessionGuard, AdminGuard)
export class ConsoleController {
  constructor(private readonly console: ConsoleService) {}

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
}
