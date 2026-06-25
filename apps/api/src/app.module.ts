import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './core/prisma/prisma.module';
import { QrModule } from './core/qr/qr.module';
import { RedisModule } from './core/redis/redis.module';
import { S3Module } from './core/s3/s3.module';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { RolesGuard } from './core/guards/roles.guard';
import { HealthController } from './health.controller';
import { AuthGoogleModule } from './modules/auth-google/auth-google.module';
import { GoogleAdminModule } from './modules/google-admin/google-admin.module';
import { LinksModule } from './modules/links/links.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    S3Module,
    QrModule,
    AuthGoogleModule,
    GoogleAdminModule,
    LinksModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
