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
   * Contrato Anura → EducacionCrmActivity (channel=call, externalSystem=anura).
   */
  anuraContract() {
    return {
      status: 'ready',
      endpoint: 'GET /GCAPI/rest/tenants/stats/cdrs/',
      cdr_fields: [
        'id', 'direction', 'status', 'calling', 'called', 'callingName', 'calledName',
        'account.id', 'account.name', 'dialTime', 'duration', 'billSeconds',
        'wasRecorded', 'routePriceTypeName', 'lastAction', 'price',
      ],
      mapping: {
        'cdr.id': 'externalRef + payload',
        'cdr.direction IN|OUT': 'direction inbound|outbound',
        'cdr.status ANSWER|NOANSWER|BUSY|CANCEL|…': 'result reached|no_answer|attempted|other',
        'cdr.called (OUT) / calling (IN)': 'phone match → waCycleId / person',
        'cdr.account.name (Karol-108)': 'agent display Karol (no es el lead)',
        'cdr.calledName': 'NO es persona — etiqueta de ruta (PERU - RESTO - MOVIL)',
        'cdr.billSeconds': 'segundos de conversación (preferido sobre duration)',
        'cdr.dialTime': 'occurredAt',
        'cdr completo': 'payload Json',
      },
      webhook: {
        url: 'POST /api/crm-educacion/webhooks/anura',
        auth: 'Bearer ANURA_WEBHOOK_SECRET',
        depends_on_refresh_token: false,
        preferred_trigger: 'END + BOTH',
      },
      note: 'El nombre del lead no viene de Anura: se resuelve en ONE/WA por teléfono. Poll usa refresh; webhook no. Ver docs/anura-contract.md.',
    };
  }
}
