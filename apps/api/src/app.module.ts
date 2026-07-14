import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './core/prisma/prisma.module';
import { QrModule } from './core/qr/qr.module';
import { RedisModule } from './core/redis/redis.module';
import { S3Module } from './core/s3/s3.module';
import { JwtAuthGuard } from './core/guards/jwt-auth.guard';
import { ModuleGuard } from './core/guards/module.guard';
import { PermissionGuard } from './core/guards/permission.guard';
import { RolesGuard } from './core/guards/roles.guard';
import { SuperAdminGuard } from './core/guards/super-admin.guard';
import { HealthController } from './health.controller';
import { AppUsersModule } from './modules/app-users/app-users.module';
import { AuthGoogleModule } from './modules/auth-google/auth-google.module';
import { GoogleAdminModule } from './modules/google-admin/google-admin.module';
import { LinksModule } from './modules/links/links.module';
import { S3ManagerModule } from './modules/s3-manager/s3-manager.module';
import { WidgetsModule } from './modules/widgets/widgets.module';
import { PamModule } from './modules/pam/pam.module';
import { ScreenCastModule } from './modules/screen-cast/screen-cast.module';
import { BsaleModule } from './modules/bsale/bsale.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    S3Module,
    QrModule,
    AuthGoogleModule,
    GoogleAdminModule,
    LinksModule,
    S3ManagerModule,
    AppUsersModule,
    WidgetsModule,
    PamModule,
    ScreenCastModule,
    BsaleModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: SuperAdminGuard },
  ],
})
export class AppModule {}
