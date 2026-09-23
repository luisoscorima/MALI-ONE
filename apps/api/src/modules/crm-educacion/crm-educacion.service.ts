import { BadRequestException, Injectable } from '@nestjs/common';
import { WhatsappCrmClientService } from '../crm/whatsapp-crm-client.service';

const AREAS = ['educacion', 'educacion_ca', 'educacion_ep'] as const;

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
  constructor(private readonly crm: WhatsappCrmClientService) {}

  private ensureConfigured() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
  }

  contacts(query: {
    area?: string; q?: string; segment?: string; attr_key?: string;
    attr_value?: string; page?: string; limit?: string;
  }) {
    this.ensureConfigured();
    return this.crm.fetchEducationContacts({
      ...query,
      page: pageNumber(query.page, 1, 1000000),
      limit: pageNumber(query.limit, 50, 2000),
    });
  }

  patchContact(id: number, body: {
    area: string; name?: string; last_name?: string; email?: string | null;
    dni?: string | null; opt_in?: boolean; opt_in_email?: boolean;
    attributes?: Record<string, string>;
  }) {
    this.ensureConfigured();
    if (!AREAS.includes(body.area as (typeof AREAS)[number])) {
      throw new BadRequestException('Área de educación inválida');
    }
    const { area, ...changes } = body;
    return this.crm.patchContact(id, changes, area);
  }

  async catalogs() {
    this.ensureConfigured();
    const entries = await Promise.all(AREAS.map(async (area) => {
      const [attributes, segments] = await Promise.all([
        this.crm.fetchAttributeDefinitions(area),
        this.crm.fetchSegments(area),
      ]);
      return { area, attributes, segments };
    }));
    return {
      attributes: entries.flatMap(({ area, attributes }) => attributes.map((item) => ({ ...item, area }))),
      segments: entries.flatMap(({ area, segments }) => segments.map((item) => ({ ...item, area }))),
    };
  }

  leads(query: { area?: string; channel?: string; q?: string; page?: string; limit?: string }) {
    this.ensureConfigured();
    return this.crm.fetchEducationLeads({
      ...query,
      page: pageNumber(query.page, 1, 1000000),
      limit: pageNumber(query.limit, 50, 200),
    });
  }
}
