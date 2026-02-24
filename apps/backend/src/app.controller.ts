import { Controller, Get, Inject, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { NovuService } from './novu.service';

@Controller()
export class AppController {
  constructor(
    @Inject(AppService) private readonly appService: AppService,
    @Inject(NovuService) private readonly novuService: NovuService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return { status: 'ok' };
  }

  @Get('health/novu')
  getNovuHealth() {
    return this.novuService.healthCheck();
  }

  @Post('notifications/test')
  sendNotificationTest() {
    return this.novuService.triggerFoundationsTest();
  }
}
