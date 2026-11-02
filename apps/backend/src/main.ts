import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';
import { applyHttpHardening } from './common/http/http-hardening';
import { API_REFERENCE_PATH } from './config/http.constants';
import { createLogger } from './utils/logger';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : [];
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // In prod, `backend` sits behind a reverse proxy (see docker-compose.prod's
  // rustfs comment — same deployment shape applies here). Without this,
  // every request's req.ip is the proxy's own address, so @nestjs/throttler
  // would rate-limit all users' combined traffic as a single client instead
  // of each one individually. `1` trusts exactly one hop.
  app.set('trust proxy', 1);
  applyHttpHardening(app, createLogger('http'));
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useWebSocketAdapter(new IoAdapter(app));

  // The API reference lists every route: served in development only. In
  // production it gave the whole surface to anyone (audit 2026-11-02 § 2.3).
  if (process.env.NODE_ENV !== 'production') {
    const openApiConfig = new DocumentBuilder()
      .setTitle('EVCore Backend API')
      .setDescription('EVCore backend API reference')
      .setVersion('1.0.0')
      .build();

    const document = SwaggerModule.createDocument(app, openApiConfig);
    app.use(
      API_REFERENCE_PATH,
      apiReference({
        content: document,
        theme: 'default',
      }),
    );
  }

  // SIGTERM (container stop): requests in flight finish, then Prisma and
  // the queues' connections close.
  app.enableShutdownHooks();
  await app.listen(port, host);
  const appUrl = await app.getUrl();
  console.log(`🚀 Backend running at ${appUrl}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📚 Scalar API reference: ${appUrl}${API_REFERENCE_PATH}`);
  }
}
void bootstrap();
