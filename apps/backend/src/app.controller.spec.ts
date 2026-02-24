import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NovuService } from './novu.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: NovuService,
          useValue: {
            healthCheck: vi
              .fn()
              .mockResolvedValue({ status: 'not_configured' }),
            triggerFoundationsTest: vi
              .fn()
              .mockResolvedValue({ configured: false }),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return service health status', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });
  });
});
