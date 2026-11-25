import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from './core/guards/public.decorator';
import { PrismaService } from './core/prisma/prisma.service';
import { RedisService } from './core/redis/redis.service';
import { GoogleAdminService } from './modules/google-admin/google-admin.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly googleAdmin: GoogleAdminService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness — process is up (does not check dependencies). */
  @Public()
  @Get()
  health() {
    return { status: 'ok', service: 'mali-one-api' };
  }

  /** Readiness — Postgres + Redis reachable. */
  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks = {
      postgres: false,
      redis: false,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = true;
    } catch {
      checks.postgres = false;
    }

    try {
      const pong = await this.redis.client.ping();
      checks.redis = pong === 'PONG';
    } catch {
      checks.redis = false;
    }

    const ok = checks.postgres && checks.redis;
    if (!ok) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'degraded', service: 'mali-one-api', checks };
    }

    return { status: 'ok', service: 'mali-one-api', checks };
  }

  @Public()
  @Get('google-admin')
  async googleAdminHealth() {
    return this.googleAdmin.healthCheck();
  }
}
