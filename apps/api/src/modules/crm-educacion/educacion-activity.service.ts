import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

const CHANNELS = ['call', 'email', 'whatsapp', 'other'] as const;
const RESULTS = [
  'attempted', 'reached', 'no_answer', 'left_voicemail', 'bounced', 'other',
] as const;

@Injectable()
export class EducacionActivityService {
  constructor(private readonly prisma: PrismaService) {}

  listByCycle(waCycleId: number) {
    return this.prisma.educacionCrmActivity.findMany({
      where: { waCycleId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  listByOpportunity(opportunityId: string) {
    return this.prisma.educacionCrmActivity.findMany({
      where: { opportunityId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async create(input: {
    waCycleId?: number;
    opportunityId?: string;
    waContactId?: number | null;
    channel: string;
    direction?: string;
    occurredAt: string;
    result: string;
    notes?: string;
    externalRef?: string;
    externalSystem?: string;
    actorEmail?: string;
  }) {
    if (!CHANNELS.includes(input.channel as (typeof CHANNELS)[number])) {
      throw new BadRequestException('channel inválido');
    }
    if (!RESULTS.includes(input.result as (typeof RESULTS)[number])) {
      throw new BadRequestException('result inválido');
    }
    const waCycleId =
      input.waCycleId != null && Number.isInteger(input.waCycleId) && input.waCycleId > 0
        ? input.waCycleId
        : null;
    const opportunityId = input.opportunityId?.trim() || null;
    if (!waCycleId && !opportunityId) {
      throw new BadRequestException('Indica waCycleId u opportunityId');
    }
    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('occurredAt inválida');
    }
    return this.prisma.educacionCrmActivity.create({
      data: {
        waCycleId,
        opportunityId,
        waContactId: input.waContactId ?? null,
        channel: input.channel,
        direction: input.direction === 'inbound' ? 'inbound' : 'outbound',
        occurredAt,
        result: input.result,
        notes: input.notes?.trim() || null,
        externalRef: input.externalRef?.trim() || null,
        externalSystem: input.externalSystem?.trim() || 'manual',
        actorEmail: input.actorEmail ?? null,
      },
    });
  }

  /**
   * Spike Anura: contrato esperado. Sin API real aún.
   * Importar CDR → create({ channel:'call', externalSystem:'anura', ... }).
   */
  anuraContract() {
    return {
      status: 'spike',
      expected_fields: [
        'cdr_id', 'phone', 'agent_email', 'direction', 'started_at',
        'ended_at', 'disposition', 'recording_url?',
      ],
      mapping: {
        cdr_id: 'externalRef',
        disposition: 'result (reached|no_answer|attempted|other)',
        agent_email: 'actorEmail',
        started_at: 'occurredAt',
      },
      note: 'Solo abre captación si el contexto es consulta comercial nueva; si no, solo actividad.',
    };
  }
}
