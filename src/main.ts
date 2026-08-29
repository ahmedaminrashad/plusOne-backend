import { join } from 'path';
import { mkdirSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(join(uploadsDir, 'chat'), { recursive: true });
  mkdirSync(join(uploadsDir, 'groups'), { recursive: true });
  mkdirSync(join(uploadsDir, 'users'), { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // The public pay-link page (opened from an SMS link by someone without the
  // app) lives at a bare "/s/:shareId" path — it must stay outside "/api/v1"
  // so the short link matches the pay.plusone-app.com/s/... shape from the design.
  app.setGlobalPrefix('api/v1', { exclude: ['s/:shareId', 'p/:token', 'p/:token/paid', 'i/:token'] });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}/api/v1`);
}
bootstrap();
