import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CrmEducacionService } from './crm-educacion.service';
import { EducacionOpportunityService } from './prospectia/educacion-opportunity.service';

export type BandejaItem = {
  id: string;
  origin: 'one' | 'wa';
  commercial_authority: 'one' | 'wa';
  channel: string;
  category: string;
  stage_slug: string;
  advisor_email: string | null;
  assigned_user_label: string | null;
  source_label: string | null;
  from_meta: boolean;
  prospectia_inbox: string | null;
  has_prospectia_chat: boolean | null;
  linked_wa: boolean;
  prospectia_status: string | null;
  interest_course: string | null;
  wa_cycle_id: number | null;
  opportunity_id: string | null;
  first_seen_at: string;
  last_interaction_at: string | null;
  closed_at: string | null;
  payment_link: string | null;
  last_call_at: string | null;
  last_call_result: string | null;
  contacts: {
    name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  };
  badges: string[];
};

/**
 * Bandeja comercial unificada: oportunidades ONE + ciclos WA no enlazados.
 * Un escritor de etapa por fila (commercial_authority); sin dual-write.
 */
@Injectable()
export class EducacionBandejaService {
  private readonly logger = new Logger(EducacionBandejaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly opportunities: EducacionOpportunityService,
    private readonly crm: CrmEducacionService,
  ) {}

  async list(params: {
    categoria?: string;
    q?: string;
    view?: string;
    page?: number;
    limit?: number;
    includeWa?: boolean;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const includeWa = params.includeWa !== false;

    const onePage = await this.opportunities.list({
      categoria: params.categoria,
      q: params.q,
      view: params.view === 'solo_contacto' ? 'solo_contacto'
        : params.view === 'closed' ? 'closed'
          : params.view === 'unassigned' ? 'unassigned'
            : params.view === 'all' ? undefined : 'open',
      page: 1,
      limit: 500,
    });

    const oppIds = onePage.items.map((item) => item.id);
    const cycleIds = onePage.items
      .map((item) => item.wa_cycle_id)
      .filter((id): id is number => id != null);

    const [sales, calls] = await Promise.all([
      oppIds.length || cycleIds.length
        ? this.prisma.educacionSale.findMany({
            where: {
              OR: [
                ...(oppIds.length ? [{ opportunityId: { in: oppIds } }] : []),
                ...(cycleIds.length ? [{ waCycleId: { in: cycleIds } }] : []),
              ],
            },
            select: {
              opportunityId: true,
              waCycleId: true,
              status: true,
              applications: { select: { id: true, reversedAt: true }, take: 5 },
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      oppIds.length || cycleIds.length
        ? this.prisma.educacionCrmActivity.findMany({
            where: {
              externalSystem: 'anura',
              OR: [
                ...(oppIds.length ? [{ opportunityId: { in: oppIds } }] : []),
                ...(cycleIds.length ? [{ waCycleId: { in: cycleIds } }] : []),
              ],
            },
            orderBy: { occurredAt: 'desc' },
            take: 200,
            select: {
              opportunityId: true,
              waCycleId: true,
              occurredAt: true,
              result: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const paymentByOpp = new Map<string, string>();
    const paymentByCycle = new Map<number, string>();
    for (const sale of sales) {
      const activeApps = sale.applications.filter((app) => !app.reversedAt);
      const flag = activeApps.length
        ? (sale.status === 'won' ? 'pagado' : 'reportado')
        : (sale.status === 'open' ? 'asociado' : sale.status);
      if (sale.opportunityId && !paymentByOpp.has(sale.opportunityId)) {
        paymentByOpp.set(sale.opportunityId, flag);
      }
      if (sale.waCycleId != null && !paymentByCycle.has(sale.waCycleId)) {
        paymentByCycle.set(sale.waCycleId, flag);
      }
    }

    const callByOpp = new Map<string, { at: string; result: string }>();
    const callByCycle = new Map<number, { at: string; result: string }>();
    for (const call of calls) {
      const tip = { at: call.occurredAt.toISOString(), result: call.result };
      if (call.opportunityId && !callByOpp.has(call.opportunityId)) callByOpp.set(call.opportunityId, tip);
      if (call.waCycleId != null && !callByCycle.has(call.waCycleId)) callByCycle.set(call.waCycleId, tip);
    }

    const linkedCycles = new Set(cycleIds);
    const oneItems: BandejaItem[] = onePage.items.map((item) => {
      const authority = (item as { commercial_authority?: string }).commercial_authority === 'wa'
        ? 'wa' as const
        : 'one' as const;
      const badges = this.badges({
        channel: item.channel,
        authority,
        linkedWa: item.linked_wa,
        hasProspectiaChat: item.has_prospectia_chat,
        fromMeta: item.from_meta,
        hasCall: Boolean(callByOpp.get(item.id) || (item.wa_cycle_id != null && callByCycle.get(item.wa_cycle_id))),
        payment: paymentByOpp.get(item.id) || (item.wa_cycle_id != null ? paymentByCycle.get(item.wa_cycle_id) : null),
      });
      const call = callByOpp.get(item.id)
        || (item.wa_cycle_id != null ? callByCycle.get(item.wa_cycle_id) : undefined);
      return {
        id: item.id,
        origin: 'one',
        commercial_authority: authority,
        channel: item.channel,
        category: item.category,
        stage_slug: item.stage_slug,
        advisor_email: item.advisor_email,
        assigned_user_label: item.assigned_user_label,
        source_label: item.source_label,
        from_meta: item.from_meta,
        prospectia_inbox: item.prospectia_inbox,
        has_prospectia_chat: item.has_prospectia_chat,
        linked_wa: item.linked_wa,
        prospectia_status: item.prospectia_status,
        interest_course: item.interest_course,
        wa_cycle_id: item.wa_cycle_id,
        opportunity_id: item.id,
        first_seen_at: item.first_seen_at,
        last_interaction_at: item.last_interaction_at,
        closed_at: item.closed_at,
        payment_link: paymentByOpp.get(item.id)
          || (item.wa_cycle_id != null ? paymentByCycle.get(item.wa_cycle_id) ?? null : null),
        last_call_at: call?.at ?? null,
        last_call_result: call?.result ?? null,
        contacts: item.contacts,
        badges,
      };
    });

    let waItems: BandejaItem[] = [];
    if (includeWa) {
      try {
        const cycles = await this.crm.cycles({
          categoria: params.categoria ?? 'all',
          q: params.q,
          view: params.view === 'closed' ? 'closed'
            : params.view === 'unassigned' ? 'unassigned'
              : params.view === 'review' ? 'review' : 'open',
          page: '1',
          limit: '200',
        }) as { items?: Array<Record<string, unknown>> };
        waItems = (cycles.items ?? [])
          .filter((cycle) => {
            const id = Number(cycle.id);
            return Number.isInteger(id) && !linkedCycles.has(id);
          })
          .map((cycle) => {
            const id = Number(cycle.id);
            const call = callByCycle.get(id);
            const payment = paymentByCycle.get(id)
              ?? (typeof cycle.payment_link === 'string' ? cycle.payment_link : null);
            const contacts = (cycle.contacts && typeof cycle.contacts === 'object')
              ? cycle.contacts as Record<string, unknown>
              : {};
            const badges = this.badges({
              channel: 'wa',
              authority: 'wa',
              linkedWa: true,
              hasProspectiaChat: null,
              fromMeta: false,
              hasCall: Boolean(call),
              payment,
            });
            return {
              id: `wa-cycle-${id}`,
              origin: 'wa' as const,
              commercial_authority: 'wa' as const,
              channel: 'wa',
              category: String(cycle.categoria ?? cycle.category ?? 'general'),
              stage_slug: String(cycle.lead_status_slug ?? cycle.stage_slug ?? 'por_contactar'),
              advisor_email: typeof cycle.assigned_user_label === 'string' ? cycle.assigned_user_label : null,
              assigned_user_label: typeof cycle.assigned_user_label === 'string' ? cycle.assigned_user_label : null,
              source_label: String(cycle.source_label ?? cycle.channel ?? 'mali-whatsapp'),
              from_meta: false,
              prospectia_inbox: null,
              has_prospectia_chat: null,
              linked_wa: true,
              prospectia_status: null,
              interest_course: typeof cycle.interest_course === 'string'
                ? cycle.interest_course
                : (typeof cycle.curso === 'string' ? cycle.curso : null),
              wa_cycle_id: id,
              opportunity_id: null,
              first_seen_at: String(cycle.first_seen_at ?? cycle.created_at ?? new Date().toISOString()),
              last_interaction_at: typeof cycle.last_interaction_at === 'string' ? cycle.last_interaction_at : null,
              closed_at: typeof cycle.closed_at === 'string' ? cycle.closed_at : null,
              payment_link: payment,
              last_call_at: call?.at ?? null,
              last_call_result: call?.result ?? null,
              contacts: {
                name: typeof contacts.name === 'string' ? contacts.name : null,
                last_name: typeof contacts.last_name === 'string' ? contacts.last_name : null,
                phone: typeof contacts.phone === 'string' ? contacts.phone : null,
                email: typeof contacts.email === 'string' ? contacts.email : null,
              },
              badges,
            };
          });
      } catch (err) {
        this.logger.warn(`Bandeja WA falló: ${err instanceof Error ? err.message : err}`);
      }
    }

    const merged = [...oneItems, ...waItems].sort(
      (a, b) => new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime(),
    );
    const total = merged.length;
    const start = (page - 1) * limit;
    const items = merged.slice(start, start + limit);
    return {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      note: 'Etapa: un escritor por fila (commercial_authority). WA sin enlazar aparece como origen wa.',
    };
  }

  async getFicha(id: string) {
    if (id.startsWith('wa-cycle-')) {
      const waCycleId = Number(id.replace('wa-cycle-', ''));
      if (!Number.isInteger(waCycleId) || waCycleId < 1) {
        return { found: false as const };
      }
      const [activities, sale] = await Promise.all([
        this.prisma.educacionCrmActivity.findMany({
          where: { waCycleId },
          orderBy: { occurredAt: 'desc' },
          take: 50,
        }),
        this.prisma.educacionSale.findFirst({
          where: { waCycleId },
          include: { applications: true, items: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);
      return {
        found: true as const,
        origin: 'wa' as const,
        commercial_authority: 'wa' as const,
        wa_cycle_id: waCycleId,
        opportunity: null,
        timeline: activities.map((row) => ({
          id: row.id,
          channel: row.channel,
          direction: row.direction,
          result: row.result,
          occurred_at: row.occurredAt.toISOString(),
          notes: row.notes,
          external_system: row.externalSystem,
          external_ref: row.externalRef,
          payload: row.payload,
        })),
        sale,
        deep_links: {
          wa_cycle_id: waCycleId,
          wa_chat_hint: `Ciclo WA #${waCycleId} — abrir en mali-whatsapp (misma UX asesor)`,
          prospectia: null,
          prospectia_hint: null,
        },
      };
    }

    const opportunity = await this.opportunities.getById(id);
    const [activities, sale] = await Promise.all([
      this.prisma.educacionCrmActivity.findMany({
        where: {
          OR: [
            { opportunityId: id },
            ...(opportunity.wa_cycle_id ? [{ waCycleId: opportunity.wa_cycle_id }] : []),
          ],
        },
        orderBy: { occurredAt: 'desc' },
        take: 50,
      }),
      this.prisma.educacionSale.findFirst({
        where: {
          OR: [
            { opportunityId: id },
            ...(opportunity.wa_cycle_id ? [{ waCycleId: opportunity.wa_cycle_id }] : []),
          ],
        },
        include: { applications: true, items: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      found: true as const,
      origin: 'one' as const,
      commercial_authority: (opportunity as { commercial_authority?: string }).commercial_authority === 'wa'
        ? 'wa' as const
        : 'one' as const,
      wa_cycle_id: opportunity.wa_cycle_id,
      opportunity,
      timeline: activities.map((row) => ({
        id: row.id,
        channel: row.channel,
        direction: row.direction,
        result: row.result,
        occurred_at: row.occurredAt.toISOString(),
        notes: row.notes,
        external_system: row.externalSystem,
        external_ref: row.externalRef,
        payload: row.payload,
      })),
      sale,
      deep_links: {
        wa_cycle_id: opportunity.wa_cycle_id,
        wa_chat_hint: opportunity.wa_cycle_id
          ? `Ciclo WA #${opportunity.wa_cycle_id} — chat en mali-whatsapp (facade UX)`
          : null,
        prospectia: opportunity.channel === 'prospectia' ? opportunity.external_id : null,
        prospectia_hint: opportunity.channel === 'prospectia'
          ? `Contacto Prospectia #${opportunity.external_id} (status conversación ≠ etapa)`
          : null,
      },
      note: opportunity.channel === 'prospectia'
        ? 'prospectia_status es solo lectura (conversación); etapa comercial = stage_slug'
        : undefined,
      venta_ready: opportunity.stage_slug === 'venta_exitosa',
    };
  }

  private badges(input: {
    channel: string;
    authority: 'one' | 'wa';
    linkedWa: boolean;
    hasProspectiaChat: boolean | null;
    fromMeta: boolean;
    hasCall: boolean;
    payment: string | null | undefined;
  }): string[] {
    const out: string[] = [];
    if (input.authority === 'one') out.push('ONE');
    else out.push('WA');
    if (input.channel === 'prospectia') out.push('Prospectia');
    if (input.channel === 'wa' || input.linkedWa) out.push('mali-whatsapp');
    if (input.channel === 'manual') out.push('Manual');
    if (input.channel === 'widget') out.push('Widget');
    if (input.fromMeta) out.push('Meta');
    if (input.hasProspectiaChat === false) out.push('Solo contacto');
    if (input.hasProspectiaChat === true) out.push('Con chat');
    if (input.hasCall) out.push('Anura');
    if (input.payment) out.push(`Pago:${input.payment}`);
    return out;
  }
}
