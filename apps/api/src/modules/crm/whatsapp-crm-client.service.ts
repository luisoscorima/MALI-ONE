import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PamRegistration } from '@prisma/client';

export type CrmSyncPayload = {
  area?: string;
  name: string;
  last_name?: string;
  phone: string;
  email?: string;
  dni?: string | null;
  opt_in?: boolean;
  opt_in_email?: boolean;
  attributes?: Record<string, string>;
  external_id?: string;
};

export type CrmAttributeDefinition = {
  id: number;
  segment_slug: string | null;
  slug: string;
  label: string;
  field_type: string;
  sort_order: number;
  required: boolean;
  active: boolean;
};

export type CrmContactRow = {
  contact_id: number;
  name: string;
  last_name: string;
  phone: string;
  email: string | null;
  dni: string | null;
  opt_in: boolean;
  opt_in_email: boolean;
  active: boolean;
  segment_slugs: string[];
  attributes: Record<string, string>;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class WhatsappCrmClientService {
  private readonly logger = new Logger(WhatsappCrmClientService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return String(this.config.get('WHATSAPP_CRM_BASE_URL') ?? '')
      .trim()
      .replace(/\/$/, '');
  }

  private get token(): string {
    return String(this.config.get('WHATSAPP_CRM_SERVICE_TOKEN') ?? '').trim();
  }

  get configured(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  /** Fire-and-forget sync of a PamRegistration to WhatsApp CRM. */
  syncPamRegistration(reg: PamRegistration): void {
    void this.syncPamRegistrationAsync(reg).catch((err) => {
      this.logger.warn(
        `CRM sync failed for PamRegistration ${reg.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  async syncPamRegistrationAsync(reg: PamRegistration): Promise<void> {
    if (!this.configured) {
      this.logger.debug('WhatsApp CRM no configurado; omitiendo sync');
      return;
    }

    const phone = this.toE164Pe(reg.celular);
    if (!phone) {
      this.logger.warn(
        `CRM sync omitido: teléfono inválido en registro ${reg.id}`,
      );
      return;
    }

    // Persona (columnas) + demografía (atributos) + copia operativa de membresía.
    // Ledger ONE (checkout, privacidad, welcome SMTP) NO se replica al CRM.
    const attributes: Record<string, string> = {
      source: 'pam_widget',
      payment_id: reg.id,
      plan: reg.plan,
      frecuencia: reg.frecuencia,
    };

    this.setAttr(attributes, 'direccion', reg.direccion);
    this.setAttr(attributes, 'ciudad', reg.ciudad);
    this.setAttr(attributes, 'distrito', reg.distrito);
    this.setAttr(attributes, 'genero', reg.genero);
    this.setAttr(attributes, 'fecha_nacimiento', reg.fechaNacimiento);
    this.setAttr(attributes, 'como_te_enteraste', reg.comoTeEnteraste);
    if (reg.mpStatus) attributes.mp_status = reg.mpStatus;
    if (reg.expiryDate) {
      attributes.expiry = reg.expiryDate.toISOString().slice(0, 10);
    }

    await this.syncContact({
      area: 'pam',
      name: reg.nombres,
      last_name: reg.apellidos,
      phone,
      email: reg.correo,
      dni: reg.dni,
      opt_in: true,
      opt_in_email: true,
      attributes,
      external_id: reg.id,
    });
  }

  private setAttr(
    attrs: Record<string, string>,
    key: string,
    value: string | null | undefined,
  ) {
    const v = String(value ?? '').trim();
    if (v) attrs[key] = v;
  }

  async syncContact(payload: CrmSyncPayload): Promise<unknown> {
    return this.request('POST', '/api/crm/sync', payload);
  }

  async patchContact(
    contactId: number,
    body: {
      name?: string;
      last_name?: string;
      email?: string | null;
      dni?: string | null;
      opt_in?: boolean;
      opt_in_email?: boolean;
      segment_slugs?: string[];
      attributes?: Record<string, string>;
    },
    area = 'pam',
  ): Promise<CrmContactRow> {
    const qs = new URLSearchParams({ area });
    return this.request(
      'PATCH',
      `/api/crm/contacts/${contactId}?${qs.toString()}`,
      body,
    );
  }

  async fetchAttributeDefinitions(
    area = 'pam',
  ): Promise<CrmAttributeDefinition[]> {
    const qs = new URLSearchParams({ area });
    return this.request(
      'GET',
      `/api/crm/attribute-definitions?${qs.toString()}`,
    );
  }

  async fetchSegments(
    area = 'pam',
  ): Promise<Array<{ slug: string; label: string; color_key?: string }>> {
    const qs = new URLSearchParams({ area });
    return this.request('GET', `/api/crm/segments?${qs.toString()}`);
  }

  async createAttributeDefinition(body: {
    area?: string;
    scope: 'area' | 'segment';
    segment_slug?: string;
    slug: string;
    label: string;
    field_type?: string;
    sort_order?: number;
    required?: boolean;
  }): Promise<CrmAttributeDefinition> {
    return this.request('POST', '/api/crm/attribute-definitions', {
      area: body.area ?? 'pam',
      ...body,
    });
  }

  async updateAttributeDefinition(
    id: number,
    body: {
      label: string;
      field_type?: string;
      sort_order?: number;
      required?: boolean;
      active?: boolean;
    },
    area = 'pam',
  ): Promise<CrmAttributeDefinition> {
    const qs = new URLSearchParams({ area });
    return this.request(
      'PATCH',
      `/api/crm/attribute-definitions/${id}?${qs.toString()}`,
      body,
    );
  }

  async fetchAudience(params: {
    area?: string;
    segment?: string;
    attr_key?: string;
    attr_value?: string;
    page?: number;
    limit?: number;
    opt_in_email?: boolean;
  }): Promise<{
    items: Array<{
      contact_id: number;
      email: string;
      name: string;
      last_name: string;
      phone: string;
      attributes: Record<string, string>;
    }>;
    total: number;
    page: number;
    limit: number;
    pages: number;
    area: string;
  }> {
    const qs = new URLSearchParams();
    qs.set('area', params.area ?? 'pam');
    if (params.segment) qs.set('segment', params.segment);
    if (params.attr_key) qs.set('attr_key', params.attr_key);
    if (params.attr_value !== undefined) qs.set('attr_value', params.attr_value);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.opt_in_email !== undefined) {
      qs.set('opt_in_email', String(params.opt_in_email));
    }

    return this.request('GET', `/api/crm/audience?${qs.toString()}`);
  }

  async fetchContacts(params: {
    area?: string;
    q?: string;
    segment?: string;
    has_email?: boolean;
    opt_in_email?: boolean;
    attr_key?: string;
    attr_value?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: CrmContactRow[];
    total: number;
    page: number;
    limit: number;
    pages: number;
    area: string;
  }> {
    const qs = new URLSearchParams();
    qs.set('area', params.area ?? 'pam');
    if (params.q) qs.set('q', params.q);
    if (params.segment) qs.set('segment', params.segment);
    if (params.attr_key) qs.set('attr_key', params.attr_key);
    if (params.attr_value !== undefined) qs.set('attr_value', params.attr_value);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.has_email !== undefined) qs.set('has_email', String(params.has_email));
    if (params.opt_in_email !== undefined) {
      qs.set('opt_in_email', String(params.opt_in_email));
    }

    return this.request('GET', `/api/crm/contacts?${qs.toString()}`);
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!this.configured) {
      throw new Error('WhatsApp CRM no configurado');
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Crm-Service-Token': this.token,
      },
      body:
        method === 'POST' || method === 'PATCH'
          ? JSON.stringify(body ?? {})
          : undefined,
    });

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      data?: T;
      message?: string;
    };

    if (!res.ok || json.ok === false) {
      throw new Error(
        json.message || `CRM HTTP ${res.status} en ${method} ${path}`,
      );
    }

    return (json.data ?? json) as T;
  }

  /** Normalize Peruvian mobile to E.164 without +. */
  toE164Pe(raw: string): string | null {
    const digits = String(raw ?? '').replace(/\D/g, '');
    if (!digits) return null;
    if (/^51[1-9]\d{7,11}$/.test(digits)) return digits;
    if (/^9\d{8}$/.test(digits)) return `51${digits}`;
    if (/^[1-9]\d{7,14}$/.test(digits)) return digits;
    return null;
  }
}
