import { Injectable, Logger } from '@nestjs/common';
import {
  BackgroundJobStatus,
  BackgroundJobType,
  Prisma,
} from '@prisma/client';
import { hostname } from 'node:os';
import { PrismaService } from '../prisma/prisma.service';

export type BackgroundJobPayload = Record<string, unknown>;

@Injectable()
export class BackgroundJobsService {
  private readonly logger = new Logger(BackgroundJobsService.name);
  private readonly workerId = `${hostname()}:${process.pid}`;

  constructor(private readonly prisma: PrismaService) {}

  enqueue(
    type: BackgroundJobType,
    payload: BackgroundJobPayload = {},
    createdById?: string | null,
  ) {
    return this.prisma.backgroundJob.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        createdById: createdById ?? null,
      },
    });
  }

  /** Claim oldest pending job (skip locked). Returns null if queue empty. */
  async claimNext() {
    const pending = await this.prisma.backgroundJob.findFirst({
      where: { status: BackgroundJobStatus.pending },
      orderBy: { createdAt: 'asc' },
    });
    if (!pending) return null;

    const claimed = await this.prisma.backgroundJob.updateMany({
      where: { id: pending.id, status: BackgroundJobStatus.pending },
      data: {
        status: BackgroundJobStatus.running,
        lockedAt: new Date(),
        lockedBy: this.workerId,
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) return null;

    return this.prisma.backgroundJob.findUniqueOrThrow({
      where: { id: pending.id },
    });
  }

  async complete(id: string) {
    await this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: BackgroundJobStatus.completed,
        finishedAt: new Date(),
        error: null,
      },
    });
  }

  async fail(id: string, error: unknown) {
    const message =
      error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);
    this.logger.warn(`background_job_failed id=${id} error=${message}`);
    await this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: BackgroundJobStatus.failed,
        finishedAt: new Date(),
        error: message,
      },
    });
  }
}
