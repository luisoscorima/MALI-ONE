import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

/**
 * Ingest outbox shadow WA→ONE. No escribe etapa/assign (sin dual-write).
 * processedAt queda null hasta un consumidor F4 futuro.
 */
@Injectable()
export class EducacionChannelEventService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(input: {
    eventId: string;
    eventType: string;
    occurredAt?: string;
    payload?: Record<string, unknown>;
  }) {
    const eventId = String(input.eventId ?? '').trim();
    const eventType = String(input.eventType ?? '').trim();
    if (!eventId) throw new BadRequestException('eventId requerido');
    if (!eventType) throw new BadRequestException('eventType requerido');
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('occurredAt inválido');
    }
    const payload = (input.payload ?? {}) as Prisma.InputJsonValue;
    const row = await this.prisma.educacionChannelEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        eventType,
        occurredAt,
        payload,
      },
      // A retry acknowledges the original fact; never rewrite its history.
      update: {},
    });
    return {
      id: row.id,
      event_id: row.eventId,
      event_type: row.eventType,
      occurred_at: row.occurredAt.toISOString(),
      processed_at: row.processedAt?.toISOString() ?? null,
      shadow: true,
    };
  }

  async recent(limit = 20) {
    const take = Math.min(100, Math.max(1, limit));
    const rows = await this.prisma.educacionChannelEvent.findMany({
      orderBy: { occurredAt: 'desc' },
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      event_id: row.eventId,
      event_type: row.eventType,
      occurred_at: row.occurredAt.toISOString(),
      processed_at: row.processedAt?.toISOString() ?? null,
      payload: row.payload,
    }));
  }
}
