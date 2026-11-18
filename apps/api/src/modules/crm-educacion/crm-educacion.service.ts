import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  WhatsAppCrmClientError,
  WhatsappCrmClientService,
} from '../crm/whatsapp-crm-client.service';
import { EDUCATION_WRITE_AREA, toWhatsAppAreaQuery } from './education-scope';
import { EducacionSaleService } from './educacion-sale.service';
import { ProspectiaClientService } from './prospectia/prospectia-client.service';

function pageNumber(raw: string | undefined, fallback: number, maximum: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new BadRequestException('Paginación inválida');
  }
  return value;
}

@Injectable()
export class CrmEducacionService {
  constructor(
    private readonly crm: WhatsappCrmClientService,
    private readonly sales: EducacionSaleService,
    private readonly prospectia: ProspectiaClientService,
  ) {}

  private ensureConfigured() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
  }

  contacts(query: {
    categoria?: string; q?: string; segment?: string; attr_key?: string;
    attr_value?: string; page?: string; limit?: string;
  }) {
    this.ensureConfigured();
    return this.crm.fetchEducationContacts({
      area: toWhatsAppAreaQuery(query.categoria),
      q: query.q,
      segment: query.segment,
      attr_key: query.attr_key,
      attr_value: query.attr_value,
      page: pageNumber(query.page, 1, 1000000),
      limit: pageNumber(query.limit, 50, 2000),
    });
  }

  patchContact(id: number, body: {
    area: string; name?: string; last_name?: string; email?: string | null;
    dni?: string | null; opt_in?: boolean; opt_in_email?: boolean;
    segment_slugs?: string[];
    attributes?: Record<string, string>;
  }) {
    this.ensureConfigured();
    if (body.area !== EDUCATION_WRITE_AREA) {
      throw new BadRequestException('Área de educación inválida');
    }
    const { area, ...changes } = body;
    return this.crm.patchContact(id, changes, area);
  }

  async catalogs() {
    this.ensureConfigured();
    const area = EDUCATION_WRITE_AREA;
    const [attributes, segments] = await Promise.all([
      this.crm.fetchAttributeDefinitions(area),
      this.crm.fetchSegments(area),
    ]);
    return {
      attributes: attributes.map((item) => ({ ...item, area })),
      segments: segments.map((item) => ({ ...item, area })),
    };
  }

  leads(query: { categoria?: string; channel?: string; q?: string; view?: string;
    unassigned?: string; page?: string; limit?: string }) {
    this.ensureConfigured();
    return this.crm.fetchEducationLeads({
      area: toWhatsAppAreaQuery(query.categoria),
      channel: query.channel,
      q: query.q,
      view: query.view,
      unassigned: query.unassigned === 'true',
      page: pageNumber(query.page, 1, 1000000),
      limit: pageNumber(query.limit, 50, 200),
    });
  }

  async cycles(query: { categoria?: string; channel?: string; q?: string; view?: string;
    page?: string; limit?: string }) {
    this.ensureConfigured();
    const payload = await this.crm.fetchEducationCycles({
      area: toWhatsAppAreaQuery(query.categoria),
      channel: query.channel,
      q: query.q,
      view: query.view,
      page: pageNumber(query.page, 1, 1000000),
      limit: pageNumber(query.limit, 50, 200),
    });
    const base =
      payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>)
        : {};
    const rawItems = base.items;
    const items = Array.isArray(rawItems)
      ? (rawItems as Array<Record<string, unknown> & { id?: number }>)
      : [];
    const links = await this.sales.linksByCycleIds(
      items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0),
    );
    return {
      ...base,
      items: items.map((item) => ({
        ...item,
        payment_link: links.get(Number(item.id)) ?? null,
      })),
    };
  }

  sla(query: { categoria?: string; from?: string; to?: string }) {
    this.ensureConfigured();
    return this.crm.fetchEducationSla({
      area: toWhatsAppAreaQuery(query.categoria),
      from: query.from,
      to: query.to,
    });
  }

  managementCatalogs() {
    this.ensureConfigured();
    return this.crm.fetchEducationManagementCatalogs();
  }

  async checkProspectia(subjects: Array<{ key: string; phone?: string | null; username?: string | null; whatsapp_user_id?: string | null }>) {
    const unverified = () => ({
      enabled: false,
      matches: Object.fromEntries(subjects.map((subject) => [subject.key, 'unverified' as const])),
    });
    if (!this.prospectia.enabled) return unverified();
    try {
      return await this.prospectia.checkSubjects(subjects);
    } catch {
      return unverified();
    }
  }

  async management(id: number, body: {
    area: string; assigned_user_id?: number | null; lead_status_id?: number | null;
    lead_id?: number;
    promise_at?: string | null;
    lost_reason?: string | null;
  }, actorEmail: string) {
    this.ensureConfigured();
    if (body.area !== EDUCATION_WRITE_AREA) {
      throw new BadRequestException('Área de educación inválida');
    }
    const { area, ...changes } = body;
    try {
      return await this.crm.patchEducationManagement(id, area, {
        ...changes, actor_email: actorEmail,
      });
    } catch (error) {
      if (error instanceof WhatsAppCrmClientError && error.code === 'missing_fields') {
        throw new HttpException({
          code: 'missing_fields',
          message: error.message,
          missing_fields: error.missing_fields ?? [],
        }, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }

  async createManualLead(body: {
    source_key: string;
    categoria: string;
    name: string;
    last_name?: string;
    phone?: string;
    email?: string;
    dni?: string;
    curso?: string;
  }, actorEmail: string) {
    this.ensureConfigured();
    try {
      return await this.crm.createManualEducationLead({
        ...body,
        actor_email: actorEmail,
      });
    } catch (error) {
      if (error instanceof WhatsAppCrmClientError && error.code === 'already_exists') {
        throw new HttpException({
          code: 'already_exists',
          message: error.message,
          contact_id: error.contact_id,
          cycle_id: error.cycle_id ?? null,
          assigned_user_label: error.assigned_user_label ?? null,
          lead_status_label: error.lead_status_label ?? null,
        }, HttpStatus.CONFLICT);
      }
      if (error instanceof WhatsAppCrmClientError && error.status >= 400 && error.status < 500) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  distribute(params: { categoria: string; channel?: string; q?: string }, actorEmail: string) {
    this.ensureConfigured();
    return this.crm.distributeEducation({
      area: toWhatsAppAreaQuery(params.categoria),
      channel: params.channel,
      q: params.q,
      actor_email: actorEmail,
    });
  }

  review(id: number, body: {
    area: string; action: 'open_new' | 'keep_existing' | 'dismiss';
  }, actorEmail: string) {
    this.ensureConfigured();
    if (body.area !== EDUCATION_WRITE_AREA) {
      throw new BadRequestException('Área de educación inválida');
    }
    return this.crm.reviewEducationEntry(id, body.area, body.action, actorEmail);
  }
}
