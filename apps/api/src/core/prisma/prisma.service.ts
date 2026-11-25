import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const SLOW_QUERY_MS = Number(process.env.PRISMA_SLOW_MS ?? 300);

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    this.$on('query', (event: Prisma.QueryEvent) => {
      if (event.duration < SLOW_QUERY_MS) return;
      // Log shape + duration only — never event.params (may contain PII/secrets).
      this.logger.warn(
        `slow_query durationMs=${event.duration} query=${event.query}`,
      );
    });
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
