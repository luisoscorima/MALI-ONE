import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'r/:slug', method: RequestMethod.GET }],
  });
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.APP_URL?.replace(/\/$/, '') ?? true,
    credentials: true,
  });

  const trustProxy = process.env.TRUST_PROXY === 'true';
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.API_PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
