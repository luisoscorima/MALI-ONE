import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';

function enrichmentOf(payload: unknown): {
  fromMeta?: boolean;
  inbox?: { id?: number; kind?: string; label?: string } | null;
} | null {
  if (!payload || typeof payload !== 'object') return null;
  const enrichment = (payload as { enrichment?: unknown }).enrichment;
  if (!enrichment || typeof enrichment !== 'object') return null;
  return enrichment as {
    fromMeta?: boolean;
    inbox?: { id?: number; kind?: string; label?: string } | null;
  };
}

function fromMetaFlag(sourceLabel: string | null, payload: unknown): boolean {
  if (sourceLabel && /(^|·\s)Meta(\s·|$)/.test(sourceLabel)) return true;
  return enrichmentOf(payload)?.fromMeta === true;
}

function inboxLabelOf(sourceLabel: string | null, payload: unknown): string | null {
  const fromPayload = enrichmentOf(payload)?.inbox?.label?.trim();
  if (fromPayload) return fromPayload;
  if (!sourceLabel) return null;
  const known = ['Web', 'WA CA', 'WA EP', 'WA XP'];
  for (const label of known) {
    if (sourceLabel.includes(`· ${label}`) || sourceLabel.endsWith(label)) return label;
  }
  return null;
}

export type OpportunityListItem = {
  id: string;
  channel: string;
  external_id: string;
  source_label: string | null;
  /** Prospectia con atribución anuncio Meta (ctwa_*). */
  from_meta: boolean;
  /** Inbox Prospectia corto: Web | WA CA | WA EP | WA XP */
  prospectia_inbox: string | null;
  /** Alias honesto de came_with_inbound: hay conversación en Prospectia/Chatwoot. */
  has_prospectia_chat: boolean;
  /** Puente a mali-whatsapp; no define solo contacto. */
  linked_wa: boolean;
  category: string;
  stage_slug: string;
  advisor_email: string | null;
  prospectia_status: string | null;
  interest_course: string | null;
  lead_score: number | null;
  /** @deprecated Prefer has_prospectia_chat (mismo valor). */
  came_with_inbound: boolean;
  wa_cycle_id: number | null;
  wa_contact_id: number | null;
  requires_review: boolean;
  first_seen_at: string;
  last_interaction_at: string | null;
  closed_at: string | null;
  classification: string;
  assigned_user_label: string | null;
  person: {
    id: string;
    phone: string | null;
    email: string | null;
    name: string | null;
    last_name: string | null;
  };
  /** Shape compatible con EducationLead del historial WA */
  contacts: {
    name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  };
};

@Injectable()
export class EducacionOpportunityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    categoria?: string;
    channel?: string;
    q?: string;
    view?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const where = this.buildWhere(params);
    const [total, rows] = await Promise.all([
      this.prisma.educacionOpportunity.count({ where }),
      this.prisma.educacionOpportunity.findMany({
        where,
        include: { person: true },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => this.toListItem(row)),
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listSoloContacto(params: {
    categoria?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    return this.list({
      ...params,
      channel: 'prospectia',
      view: 'solo_contacto',
    });
  }

  async findOpenByPhone(phone: string) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) return null;
    const e164 = digits.startsWith('+') ? digits : `+${digits}`;
    const variants = [...new Set([e164, `+${digits}`, digits])];
    return this.prisma.educacionOpportunity.findFirst({
      where: {
        closedAt: null,
        channel: 'prospectia',
        person: { phone: { in: variants } },
      },
      include: { person: true },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findOpenByEmail(email: string) {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized) return null;
    return this.prisma.educacionOpportunity.findFirst({
      where: {
        closedAt: null,
        channel: 'prospectia',
        person: { email: normalized },
      },
      include: { person: true },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async linkCycle(input: {
    waCycleId: number;
    waContactId?: number;
    phone?: string;
    email?: string;
    markInbound?: boolean;
  }) {
    if (!Number.isInteger(input.waCycleId) || input.waCycleId < 1) {
      throw new BadRequestException('waCycleId inválido');
    }
    let opportunity =
      (input.phone ? await this.findOpenByPhone(input.phone) : null) ??
      (input.email ? await this.findOpenByEmail(input.email) : null);

    if (!opportunity) {
      opportunity = await this.prisma.educacionOpportunity.findFirst({
        where: { waCycleId: input.waCycleId },
        include: { person: true },
      });
    }
    if (!opportunity) {
      return { linked: false as const, reason: 'not_found' as const, opportunity: null };
    }

    // cameWithInbound es verdad Prospectia (Chatwoot); el puente WA no la pisa.
    const updated = await this.prisma.educacionOpportunity.update({
      where: { id: opportunity.id },
      data: {
        waCycleId: input.waCycleId,
        waContactId: input.waContactId ?? opportunity.waContactId,
        lastInteractionAt: new Date(),
      },
      include: { person: true },
    });

    if (input.waContactId) {
      await this.prisma.educacionPerson.update({
        where: { id: updated.personId },
        data: { waContactId: input.waContactId },
      });
    }

    return {
      linked: true as const,
      reason: null,
      opportunity: this.toListItem(updated),
    };
  }

  async getById(id: string) {
    const row = await this.prisma.educacionOpportunity.findUnique({
      where: { id },
      include: { person: true },
    });
    if (!row) throw new NotFoundException('Oportunidad no encontrada');
    return this.toListItem(row);
  }

  private buildWhere(params: {
    categoria?: string;
    channel?: string;
    q?: string;
    view?: string;
  }): Prisma.EducacionOpportunityWhereInput {
    const where: Prisma.EducacionOpportunityWhereInput = {};
    if (params.channel) where.channel = params.channel;
    const cat = String(params.categoria ?? 'all').trim().toLowerCase();
    if (cat && cat !== 'all') {
      where.category = cat === 'general' ? 'general' : cat;
    }
    const view = String(params.view ?? '').trim().toLowerCase();
    if (view === 'solo_contacto') {
      // Prospectia-first: sin conversación Chatwoot. Independiente de mali-whatsapp.
      where.cameWithInbound = false;
      where.closedAt = null;
    } else if (view === 'open') {
      where.closedAt = null;
    } else if (view === 'closed') {
      where.closedAt = { not: null };
    } else if (view === 'unassigned') {
      where.closedAt = null;
      where.OR = [{ advisorEmail: null }, { advisorEmail: '' }];
    }
    const q = String(params.q ?? '').trim();
    if (q) {
      where.person = {
        OR: [
          { phone: { contains: q.replace(/\D/g, '') || q } },
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      };
    }
    return where;
  }

  private toListItem(row: {
    id: string;
    channel: string;
    externalId: string;
    sourceLabel: string | null;
    payload?: unknown;
    category: string;
    stageSlug: string;
    advisorEmail: string | null;
    prospectiaStatus: string | null;
    interestCourse: string | null;
    leadScore: number | null;
    cameWithInbound: boolean;
    waCycleId: number | null;
    waContactId: number | null;
    requiresReview: boolean;
    createdAt: Date;
    lastInteractionAt: Date | null;
    closedAt: Date | null;
    person: {
      id: string;
      phone: string | null;
      email: string | null;
      name: string | null;
      lastName: string | null;
    };
  }): OpportunityListItem {
    return {
      id: row.id,
      channel: row.channel,
      external_id: row.externalId,
      source_label: row.sourceLabel,
      from_meta: fromMetaFlag(row.sourceLabel, row.payload),
      prospectia_inbox: inboxLabelOf(row.sourceLabel, row.payload),
      has_prospectia_chat: row.cameWithInbound,
      linked_wa: row.waCycleId != null,
      category: row.category,
      stage_slug: row.stageSlug,
      advisor_email: row.advisorEmail,
      prospectia_status: row.prospectiaStatus,
      interest_course: row.interestCourse,
      lead_score: row.leadScore,
      came_with_inbound: row.cameWithInbound,
      wa_cycle_id: row.waCycleId,
      wa_contact_id: row.waContactId,
      requires_review: row.requiresReview,
      first_seen_at: row.createdAt.toISOString(),
      last_interaction_at: row.lastInteractionAt?.toISOString() ?? null,
      closed_at: row.closedAt?.toISOString() ?? null,
      classification: row.cameWithInbound ? 'con_chat' : 'solo_contacto',
      assigned_user_label: row.advisorEmail,
      person: {
        id: row.person.id,
        phone: row.person.phone,
        email: row.person.email,
        name: row.person.name,
        last_name: row.person.lastName,
      },
      contacts: {
        name: row.person.name,
        last_name: row.person.lastName,
        phone: row.person.phone,
        email: row.person.email,
      },
    };
  }
}
