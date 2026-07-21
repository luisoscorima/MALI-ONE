import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function parseCorsOrigins(): Set<string> {
  const origins = new Set<string>();
  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  if (appUrl) origins.add(appUrl);

  const extra = process.env.CORS_ORIGINS?.split(',') ?? [];
  for (const raw of extra) {
    const origin = raw.trim().replace(/\/$/, '');
    if (origin) origins.add(origin);
  }

  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'r/:slug', method: RequestMethod.GET },
      { path: 'n/:slug', method: RequestMethod.GET },
      { path: 'mail/o/:token', method: RequestMethod.GET },
      { path: 'mail/c/:token', method: RequestMethod.GET },
    ],
  });
  app.use(cookieParser());

  const allowedOrigins = parseCorsOrigins();
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      // Peticiones sin Origin (curl, same-origin) — permitir
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.replace(/\/$/, '');
      if (allowedOrigins.size === 0 || allowedOrigins.has(normalized)) {
        callback(null, origin);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
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
