import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import type { AuthSession } from '@modules/auth/auth.types';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import { IntegrationsTestService } from '@modules/integrations/integrations-test.service';
import { IntegrationsService } from '@modules/integrations/integrations.service';
import type {
  IntegrationTestResult,
  IntegrationView,
} from '@modules/integrations/integrations.types';
import { SetIntegrationDto } from './dto/integration.dto';

/**
 * Réglages › Intégrations (revue admin du 01/11): the third-party services'
 * keys and addresses. A secret is accepted, encrypted and never returned.
 * Admin accounts only; every change is journaled without its value.
 */
@ApiTags('console')
@Controller('console/integrations')
@UseGuards(AuthSessionGuard, AdminGuard)
export class ConsoleIntegrationsController {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly tests: IntegrationsTestService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Réglages › Intégrations',
    description:
      'Each service with its fields: where the value serving comes from (stored, .env, none), an address in clear, a secret never.',
  })
  @ApiOkResponse({
    description: 'The integrations and whether secrets can be saved.',
  })
  async list(): Promise<{ canEncrypt: boolean; items: IntegrationView[] }> {
    return {
      canEncrypt: this.integrations.canEncrypt(),
      items: await this.integrations.list(),
    };
  }

  @Put(':key')
  @ApiOperation({ summary: 'Store a field (a secret is encrypted)' })
  async set(
    @Param('key') key: string,
    @Body() body: SetIntegrationDto,
    @CurrentSession() session: AuthSession,
  ): Promise<{ ok: true }> {
    await this.integrations.set({
      key,
      value: body.value,
      actorId: session.user.id,
    });
    return { ok: true };
  }

  @Delete(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a stored field: the .env serves again' })
  async clear(
    @Param('key') key: string,
    @CurrentSession() session: AuthSession,
  ): Promise<{ ok: true }> {
    await this.integrations.clear({ key, actorId: session.user.id });
    return { ok: true };
  }

  @Post(':integration/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tester la connexion with the values serving' })
  test(
    @Param('integration') integration: string,
  ): Promise<IntegrationTestResult> {
    return this.tests.test(integration);
  }
}
