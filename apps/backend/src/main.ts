import { Logger } from '@nestjs/common';
import { networkInterfaces } from 'node:os';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  const app = await NestFactory.create(AppModule);
  await app.listen(port, host);

  const urls = new Set<string>([await app.getUrl()]);

  if (host === '0.0.0.0' || host === '::') {
    urls.add(`http://localhost:${port}`);
    urls.add(`http://127.0.0.1:${port}`);

    for (const infos of Object.values(networkInterfaces())) {
      for (const info of infos ?? []) {
        if (info.family === 'IPv4' && !info.internal) {
          urls.add(`http://${info.address}:${port}`);
        }
      }
    }
  } else {
    urls.add(`http://${host}:${port}`);
  }

  logger.log('Server listening on:');
  for (const url of urls) {
    logger.log(`  ${url}`);
  }
}
void bootstrap();
