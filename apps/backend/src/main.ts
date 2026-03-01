import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const openApiConfig = new DocumentBuilder()
    .setTitle('EVCore Backend API')
    .setDescription('EVCore backend API reference')
    .setVersion('1.0.0')
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  app.use(
    '/reference',
    apiReference({
      content: document,
      theme: 'default',
    }),
  );

  await app.listen(port, host);
  const appUrl = await app.getUrl();
  console.log(`🚀 Backend running at ${appUrl}`);
  console.log(`📚 Scalar API reference: ${appUrl}/reference`);
}
void bootstrap();
