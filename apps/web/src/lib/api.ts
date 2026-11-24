import type { AppModule, AppUserDto, AuthUser } from '@mali-one/shared';

/** Área canónica de ficha Educación (WhatsApp). */
export type EducationArea = 'educacion';
/** Filtro de listados CRM: categoría, no tenant. */
export type EducationCategoryScope = 'all' | 'general' | 'ca' | 'ep';
/**
 * Alias histórico aún usado por Catálogo Educación / captura (follow-up).
 * No usar en CRM Educación.
 */
export type EducationAreaAlias = 'educacion' | 'educacion_ca' | 'educacion_ep';
export type EducationLeadStatusDefinition = {
  id: number;
  area: EducationAreaAlias | string;
  slug: string;
  label: string;
  sort_order: number;
  is_default: boolean;
  is_terminal: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type ProspectiaMatch = 'exists' | 'missing' | 'unverified';
export type EducationContact = {
  contact_id: number;
  area: EducationArea | string;
  name: string;
  last_name: string;
  phone: string | null;
  whatsapp_user_id: string | null;
  wa_username: string | null;
  email: string | null;
  dni: string | null;
  opt_in: boolean;
  opt_in_email: boolean;
  segment_slugs: string[];
  attributes: Record<string, string>;
  categorias?: string[];
  lead_id?: number | null;
  categoria?: string | null;
  assigned_user_id?: number | null;
  assigned_user_label?: string | null;
  requires_review?: boolean;
  lead_status_id?: number | null;
  lead_status_label?: string | null;
};
export type EducationLead = {
  id: number;
  area: EducationArea | string;
  channel: string;
  source_key: string | null;
  source_label: string | null;
  phone: string | null;
  whatsapp_user_id: string | null;
  wa_username: string | null;
  email: string | null;
  contact_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  contacts: {
    id: number;
    name: string;
    last_name: string;
    phone: string | null;
    whatsapp_user_id: string | null;
    wa_username: string | null;
    email: string | null;
    lead_status: { label: string } | null;
  } | null;
  classification: 'new' | 'duplicate' | 'conflict' | 'dismissed';
  assignment_rule: 'new_number' | 'same_advisor' | 'reassignable' | 'conflict';
  conflict_reason: string | null;
  previous_assigned_user_id: number | null;
  previous_advisor_label: string | null;
  previous_status_label: string | null;
  previous_interaction_at: string | null;
  reviewed_at: string | null;
  cycle_id: number | null;
  is_current_cycle: boolean;
  assigned_user_id: number | null;
  assigned_user_label: string | null;
  requires_review: boolean;
  lead_status_id: number | null;
};
export type EducationLeadCounts = {
  recent: number; new_number: number; duplicate: number; reassignable: number; conflict: number;
  in_progress: number; unassigned: number; eligible: number;
};
export type EducationCycleView =
  | 'open' | 'closed' | 'review' | 'unassigned' | 'stale' | 'solo_contacto';
export type EducationPaymentLink = {
  saleId: string;
  waCycleId: number | null;
  opportunityId?: string | null;
  status: 'reportado' | 'parcial' | 'pagado' | 'revertido';
  code: string | null;
};

export type EducationCycle = {
  id: number;
  area: EducationArea | string;
  contact_id: number;
  person_id: number;
  categoria: string | null;
  categoria_label: string | null;
  curso_interes: string;
  channel: string | null;
  source_label: string | null;
  assignment_rule: EducationLead['assignment_rule'] | null;
  classification: EducationLead['classification'] | null;
  latest_capture_at: string | null;
  started_at: string;
  last_interaction_at: string;
  closed_at: string | null;
  promise_at?: string | null;
  lost_reason?: string | null;
  assigned_user_id: number | null;
  assigned_user_label: string | null;
  lead_status_id: number | null;
  lead_status: { id: number; label: string; slug: string } | null;
  lead_score: number | null;
  requires_review: boolean;
  conversation_id: number | null;
  /** Identificador pago↔ciclo (EducacionSale). */
  payment_link?: EducationPaymentLink | null;
  contacts: {
    id: number;
    person_id: number;
    name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    whatsapp_user_id: string | null;
    wa_username: string | null;
  };
};
export type EducationCycleCounts = {
  open: number;
  closed: number;
  review: number;
  unassigned: number;
  stale?: number;
  solo_contacto?: number;
};
export type EducationSlaReport = {
  summary: {
    answered_count: number;
    met_count: number;
    sla_met_pct: number;
    avg_first_response_minutes: number;
    unanswered_open_count: number;
    sla_minutes: number;
  };
  by_advisor: Array<{
    assigned_user_id: number | null;
    advisor_label: string;
    answered_count: number;
    met_count: number;
    sla_met_pct: number;
    avg_first_response_minutes: number;
  }>;
  filters: { from: string; to: string; category: string[] | null };
  note: string;
};
export type EducationManagementCatalog = {
  advisors: Array<{ id: number; label: string; areas: string[] }>;
  statuses: Array<{ id: number; area: string; slug: string; label: string; is_default: boolean }>;
};
export type EducationCatalog = {
  attributes: Array<{
    id: number; area: EducationArea | string; segment_slug: string | null;
    slug: string; label: string; sort_order: number; active: boolean;
  }>;
  segments: Array<{
    area: EducationArea | string; slug: string; label: string; color_key?: string;
  }>;
};

const API_BASE = '';

async function downloadTreasuryXlsx(path: string, fallbackName: string) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    const message = error.message;
    const text = Array.isArray(message)
      ? message.join(', ')
      : typeof message === 'string'
        ? message
        : res.statusText;
    throw new Error(text || 'No se pudo exportar');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly missing_fields?: string[];
  readonly contact_id?: number;
  readonly cycle_id?: number | null;
  readonly assigned_user_label?: string | null;
  readonly lead_status_label?: string | null;

  constructor(message: string, opts: {
    status: number;
    code?: string;
    missing_fields?: string[];
    contact_id?: number;
    cycle_id?: number | null;
    assigned_user_label?: string | null;
    lead_status_label?: string | null;
  }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = opts.status;
    this.code = opts.code;
    this.missing_fields = opts.missing_fields;
    this.contact_id = opts.contact_id;
    this.cycle_id = opts.cycle_id;
    this.assigned_user_label = opts.assigned_user_label;
    this.lead_status_label = opts.lead_status_label;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 504 || res.status === 502 || res.status === 524) {
      throw new Error(
        'La solicitud tardó demasiado. Inténtalo de nuevo en unos segundos.',
      );
    }
    const error = await res.json().catch(() => ({ message: res.statusText })) as {
      message?: string | {
        code?: string;
        message?: string;
        missing_fields?: string[];
        contact_id?: number;
        cycle_id?: number | null;
        assigned_user_label?: string | null;
        lead_status_label?: string | null;
      };
      code?: string;
      missing_fields?: string[];
      contact_id?: number;
      cycle_id?: number | null;
      assigned_user_label?: string | null;
      lead_status_label?: string | null;
    };
    const nested = typeof error.message === 'object' && error.message ? error.message : null;
    const code = nested?.code ?? error.code;
    const missing = nested?.missing_fields ?? error.missing_fields;
    const message = nested?.message
      ?? (Array.isArray(error.message) ? error.message.join(', ') : null)
      ?? (typeof error.message === 'string' ? error.message : null)
      ?? res.statusText;
    throw new ApiRequestError(message || `Error de solicitud (${res.status})`, {
      status: res.status,
      code,
      missing_fields: Array.isArray(missing) ? missing : undefined,
      contact_id: nested?.contact_id ?? error.contact_id,
      cycle_id: nested?.cycle_id ?? error.cycle_id,
      assigned_user_label: nested?.assigned_user_label ?? error.assigned_user_label,
      lead_status_label: nested?.lead_status_label ?? error.lead_status_label,
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }

  return res as unknown as T;
}

type EducacionOfertaDto = {
  id: string;
  nombre: string;
  precio: number | null;
  descuento: string | null;
  horario: string | null;
  activo: boolean;
  sortOrder: number;
  areaId: string | null;
  area: { id: string; nombre: string; parentNombre: string | null } | null;
  cursos?: { id: string; nombre: string }[];
};

type EducacionOfertaInput = {
  nombre: string;
  precio?: number | null;
  descuento?: string | null;
  horario?: string | null;
  activo?: boolean;
  sortOrder?: number;
  areaId?: string | null;
  cursoIds?: string[];
};

type EducacionAreaDto = {
  id: string;
  slug: string;
  nombre: string;
  parentId: string | null;
  whatsappArea: string | null;
  activo: boolean;
  sortOrder: number;
  lineas: number;
  cursos: number;
};

type EducacionAreaInput = {
  nombre: string;
  parentId?: string | null;
  whatsappArea?: string | null;
  activo?: boolean;
  sortOrder?: number;
};

type EducacionCatalogSedeDto = {
  id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  brochureUrl: string | null;
  icon: string;
  horarioHtml: string | null;
  lat: number | null;
  lng: number | null;
  districtId: string | null;
  distrito: { id: string; nombre: string } | null;
  showOnSelector: boolean;
  showOnMap: boolean;
  activo: boolean;
  sortOrder: number;
};

type EducacionSedeInput = {
  nombre: string;
  direccion?: string | null;
  brochureUrl?: string | null;
  icon?: string | null;
  horarioHtml?: string | null;
  lat?: number | null;
  lng?: number | null;
  districtId?: string | null;
  showOnSelector?: boolean;
  showOnMap?: boolean;
  activo?: boolean;
  sortOrder?: number;
};

type EducacionDistritoDto = {
  id: string;
  nombre: string;
  slug: string;
  brochureUrl: string | null;
  sortOrder: number;
  sedes: number;
};

export const api = {
  getMalichimpStats: () =>
    request<import('@mali-one/shared').MalichimpStatsDto>('/api/malichimp/stats'),

  listEmailSenders: (scope?: import('@mali-one/shared').EmailSenderScope) => {
    const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
    return request<import('@mali-one/shared').EmailSenderDto[]>(
      `/api/email-delivery/senders${query}`,
    );
  },

  createEmailSender: (
    email: string,
    scope: import('@mali-one/shared').EmailSenderScope = 'shared',
  ) =>
    request<import('@mali-one/shared').EmailSenderDto>('/api/email-delivery/senders', {
      method: 'POST',
      body: JSON.stringify({ email, scope }),
    }),

  updateEmailSender: (id: string, email: string) =>
    request<import('@mali-one/shared').EmailSenderDto>(
      `/api/email-delivery/senders/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ email }) },
    ),

  deleteEmailSender: (id: string) =>
    request<{ ok: true }>(`/api/email-delivery/senders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listNewsletterCampaignRegistry: () =>
    request<
      Array<{
        id: string;
        name: string;
        status: string;
        audienceArea: string;
        fromEmail: string | null;
        subjectSnapshot: string;
        totalRecipients: number;
        sentCount: number;
        openCount: number;
        clickCount: number;
        errorCount: number;
        scheduledAt: string | null;
        createdAt: string;
        updatedAt: string;
        newsletter: {
          id: string;
          title: string;
          scope: string;
          slug: string;
        };
        createdBy: { name: string; email: string } | null;
      }>
    >('/api/newsletters/campaigns'),

  listMalichimpSenders: () =>
    request<import('@mali-one/shared').EmailSenderDto[]>('/api/malichimp/senders'),

  createMalichimpSender: (email: string) =>
    request<import('@mali-one/shared').EmailSenderDto>('/api/malichimp/senders', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  updateMalichimpSender: (id: string, email: string) =>
    request<import('@mali-one/shared').EmailSenderDto>(
      `/api/malichimp/senders/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ email }) },
    ),

  deleteMalichimpSender: (id: string) =>
    request<{ ok: true }>(`/api/malichimp/senders/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  listMalichimpTags: () =>
    request<import('@mali-one/shared').MalichimpTagDto[]>('/api/malichimp/tags'),

  listMalichimpGroups: () =>
    request<import('@mali-one/shared').MalichimpGroupDto[]>('/api/malichimp/groups'),

  listMalichimpContacts: (filters: {
    q?: string;
    status?: import('@mali-one/shared').MalichimpContactStatus;
    groupOptionId?: string;
    tagId?: string;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.groupOptionId) params.set('groupOptionId', filters.groupOptionId);
    if (filters.tagId) params.set('tagId', filters.tagId);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    return request<{
      items: import('@mali-one/shared').MalichimpContactDto[];
      total: number;
      page: number;
      pageSize: number;
      pages: number;
    }>(`/api/malichimp/contacts?${params}`);
  },

  previewMalichimpImport: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<import('@mali-one/shared').MalichimpImportPreviewDto>(
      '/api/malichimp/imports/preview',
      { method: 'POST', body },
    );
  },

  applyMalichimpImport: (previewId: string) =>
    request<import('@mali-one/shared').MalichimpImportJobDto>(
      `/api/malichimp/imports/${encodeURIComponent(previewId)}/apply`,
      { method: 'POST', body: '{}' },
    ),

  getMalichimpImportJob: (jobId: string) =>
    request<import('@mali-one/shared').MalichimpImportJobDto>(
      `/api/malichimp/imports/jobs/${encodeURIComponent(jobId)}`,
    ),

  previewMalichimpXlsxImport: (
    file: File,
    groupOptionIds: string[],
    consentConfirmed: boolean,
  ) => {
    const body = new FormData();
    body.append('file', file);
    body.append('groupOptionIds', JSON.stringify(groupOptionIds));
    body.append('consentConfirmed', consentConfirmed ? 'true' : 'false');
    return request<import('@mali-one/shared').MalichimpXlsxImportPreviewDto>(
      '/api/malichimp/imports/xlsx/preview',
      { method: 'POST', body },
    );
  },

  applyMalichimpXlsxImport: (previewId: string) =>
    request<import('@mali-one/shared').MalichimpXlsxImportResultDto>(
      `/api/malichimp/imports/xlsx/${encodeURIComponent(previewId)}/apply`,
      { method: 'POST', body: '{}' },
    ),

  listMalichimpNewsletters: () =>
    request<import('@mali-one/shared').NewsletterDto[]>(
      '/api/malichimp/newsletters/library',
    ),

  listMalichimpContent: () =>
    request<
      Array<{
        id: string;
        title: string;
        subject: string;
        brand: import('@mali-one/shared').NewsletterBrand | null;
        updatedAt: string;
        contentRevision: string;
        usedInCampaigns: number;
        editable: boolean;
      }>
    >('/api/malichimp/content'),

  getMalichimpContent: (id: string) =>
    request<
      import('@mali-one/shared').NewsletterDto & {
        contentRevisionToken: string;
        editable: boolean;
        workingForCampaign?: { id: string; name: string; status: string } | null;
      }
    >(`/api/malichimp/content/${encodeURIComponent(id)}`),

  createMalichimpContent: (body: {
    title: string;
    subject: string;
    htmlBody: string;
    designJson?: string | null;
    brand?: import('@mali-one/shared').NewsletterBrand | null;
  }) =>
    request<import('@mali-one/shared').NewsletterDto>(
      '/api/malichimp/content',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateMalichimpContent: (
    id: string,
    body: {
      title?: string;
      subject?: string;
      htmlBody?: string;
      designJson?: string | null;
      brand?: import('@mali-one/shared').NewsletterBrand | null;
      contentRevision: string;
    },
  ) =>
    request<
      import('@mali-one/shared').NewsletterDto & {
        contentRevisionToken: string;
        editable: boolean;
      }
    >(`/api/malichimp/content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  duplicateMalichimpContent: (id: string) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/malichimp/content/${encodeURIComponent(id)}/duplicate`,
      { method: 'POST', body: '{}' },
    ),

  deleteMalichimpContent: (id: string) =>
    request<{ ok: boolean }>(
      `/api/malichimp/content/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  listMalichimpCampaigns: () =>
    request<import('@mali-one/shared').MalichimpCampaignDto[]>(
      '/api/malichimp/campaigns',
    ),

  getMalichimpCampaign: (id: string) =>
    request<import('@mali-one/shared').MalichimpCampaignDetailDto>(
      `/api/malichimp/campaigns/${encodeURIComponent(id)}`,
    ),

  getMalichimpCampaignStats: (
    id: string,
    days = 30,
    scope: import('@mali-one/shared').MalichimpSendScope = 'production',
  ) => {
    const query = new URLSearchParams({
      days: String(days),
      scope,
    });
    return request<import('@mali-one/shared').MalichimpCampaignStatsDto>(
      `/api/malichimp/campaigns/${encodeURIComponent(id)}/stats?${query}`,
    );
  },

  listMalichimpCampaignSends: (
    id: string,
    params: {
      event?: import('@mali-one/shared').MalichimpCampaignSendEvent;
      scope?: import('@mali-one/shared').MalichimpSendScope;
      q?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.event) query.set('event', params.event);
    if (params.scope) query.set('scope', params.scope);
    if (params.q) query.set('q', params.q);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    const suffix = query.toString() ? `?${query}` : '';
    return request<import('@mali-one/shared').MalichimpCampaignSendsPageDto>(
      `/api/malichimp/campaigns/${encodeURIComponent(id)}/sends${suffix}`,
    );
  },

  listMalichimpTestRecipients: (q?: string) => {
    const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return request<import('@mali-one/shared').MalichimpTestRecipientDto[]>(
      `/api/malichimp/test-recipients${query}`,
    );
  },

  sendMalichimpTestCampaign: (
    body: import('@mali-one/shared').SendMalichimpTestDto,
  ) =>
    request<import('@mali-one/shared').SendMalichimpTestResultDto>(
      '/api/malichimp/campaigns/test-send',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  exportMalichimpCampaigns: async (campaignIds?: string[]) => {
    const res = await fetch(`${API_BASE}/api/malichimp/campaigns/export`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignIds: campaignIds?.length ? campaignIds : undefined }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const message = error.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : res.statusText;
      throw new Error(text || 'No se pudo exportar');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? 'malichimp-campanas.xlsx';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  updateMalichimpContact: (
    id: string,
    body: import('@mali-one/shared').UpdateMalichimpContactDto,
  ) =>
    request<import('@mali-one/shared').MalichimpContactDto>(
      `/api/malichimp/contacts/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  duplicateMalichimpCampaign: (id: string) =>
    request<import('@mali-one/shared').MalichimpCampaignDetailDto>(
      `/api/malichimp/campaigns/${encodeURIComponent(id)}/duplicate`,
      { method: 'POST', body: '{}' },
    ),

  deleteMalichimpCampaign: (id: string) =>
    request<{ ok: boolean }>(
      `/api/malichimp/campaigns/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  previewMalichimpAudience: (
    body: import('@mali-one/shared').MalichimpAudiencePreviewRequestDto,
  ) => request<import('@mali-one/shared').MalichimpAudiencePreviewDto>(
    '/api/malichimp/campaigns/preview',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  createMalichimpCampaign: (
    body: import('@mali-one/shared').CreateMalichimpCampaignDto,
  ) => request<{ id: string; status: string; totalRecipients: number; scheduledAt: string | null }>(
    '/api/malichimp/campaigns',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  sendMalichimpDraftCampaign: (
    id: string,
    body: import('@mali-one/shared').CreateMalichimpCampaignDto,
  ) => request<{ id: string; status: string; totalRecipients: number; scheduledAt: string | null }>(
    `/api/malichimp/campaigns/${encodeURIComponent(id)}/send`,
    { method: 'POST', body: JSON.stringify(body) },
  ),
    niubizStatus: () => request<import('@mali-one/shared').NiubizSyncStatusDto>('/api/treasury/niubiz/status'),
    syncNiubiz: (range: { from?: string; to?: string }) => request<{ runId: string }>('/api/treasury/niubiz/sync', { method: 'POST', body: JSON.stringify(range) }),
  niubizPayCashStatus: () => request<import('@mali-one/shared').NiubizPayCashSyncStatusDto>('/api/treasury/niubiz/paycash/status'),
  syncNiubizPayCash: () => request<{ runId: string }>('/api/treasury/niubiz/paycash/sync', { method: 'POST', body: '{}' }),
  niubizPayCashPayments: (params: URLSearchParams) => request<import('@mali-one/shared').NiubizPayCashPaymentsDto>(`/api/treasury/niubiz/paycash/payments?${params}`),
  exportNiubizPayCashPayments: (params: URLSearchParams) =>
    downloadTreasuryXlsx(`/api/treasury/niubiz/paycash/payments/export?${params}`, 'niubiz-pagoefectivo.xlsx'),
  treasuryPayments: (params: URLSearchParams) => request<import('@mali-one/shared').TreasuryPaymentsDto>(`/api/treasury/payments?${params}`),
  exportTreasuryPayments: (params: URLSearchParams) =>
    downloadTreasuryXlsx(`/api/treasury/payments/export?${params}`, 'niubiz-ventas.xlsx'),
  mercadoPagoStatus: (sourceId: string) => request<import('@mali-one/shared').MercadoPagoSyncStatusDto>(`/api/treasury/mercadopago/${encodeURIComponent(sourceId)}/status`),
  syncMercadoPago: (sourceId: string, range: { from?: string; to?: string }) => request<{ runId: string }>(`/api/treasury/mercadopago/${encodeURIComponent(sourceId)}/sync`, { method: 'POST', body: JSON.stringify(range) }),
  mercadoPagoPayments: (sourceId: string, params: URLSearchParams) => request<import('@mali-one/shared').MercadoPagoPaymentsDto>(`/api/treasury/mercadopago/${encodeURIComponent(sourceId)}/payments?${params}`),
  exportMercadoPagoPayments: (sourceId: string, params: URLSearchParams) =>
    downloadTreasuryXlsx(
      `/api/treasury/mercadopago/${encodeURIComponent(sourceId)}/payments/export?${params}`,
      'mercadopago.xlsx',
    ),
  treasuryOverview: () => request<import('@mali-one/shared').TreasuryOverviewDto>('/api/treasury'),
  saveTreasurySource: (body: import('@mali-one/shared').TreasurySourceInput, id?: string) =>
    request<{ id: string }>(`/api/treasury/sources${id ? `/${encodeURIComponent(id)}` : ''}`, {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(body),
    }),
  saveTreasuryTarget: (sourceId: string, body: import('@mali-one/shared').TreasuryTargetInput, id?: string) =>
    request<{ id: string }>(`/api/treasury/sources/${encodeURIComponent(sourceId)}/targets${id ? `/${encodeURIComponent(id)}` : ''}`, {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(body),
    }),
  checkCrmEducationProspectia: (subjects: Array<{ key: string; phone?: string | null; username?: string | null; whatsapp_user_id?: string | null }>) =>
    request<{ enabled: boolean; matches: Record<string, ProspectiaMatch> }>(
      '/api/crm-educacion/prospectia/check',
      { method: 'POST', body: JSON.stringify({ subjects }) },
    ),
  startCrmEducationProspectiaIngest: (body?: { mode?: 'incremental' | 'backfill'; maxPages?: number }) =>
    request<{ started: boolean; reason?: string }>(
      '/api/crm-educacion/prospectia/ingest',
      { method: 'POST', body: JSON.stringify(body ?? {}) },
    ),
  getCrmEducationProspectiaIngest: () =>
    request<{
      enabled: boolean;
      running: boolean;
      lastPolledAt: string | null;
      lastPage: number;
      lastRunStatus: string;
      lastRunAt: string | null;
      lastError: string | null;
      processedTotal: number;
      lastRunCreated: number;
      lastRunUpdated: number;
      lastRunSkipped: number;
    }>('/api/crm-educacion/prospectia/ingest'),
  importCrmEducationProspectia: (body: {
    phone?: string;
    username?: string;
    whatsapp_user_id?: string;
    category?: 'ca' | 'ep' | 'general';
    name?: string;
    last_name?: string;
    email?: string;
  }) =>
    request<{
      ok: boolean;
      match: string;
      opportunity: {
        id: string;
        channel: string;
        external_id: string;
        contacts: { name: string | null; last_name: string | null; phone: string | null; email: string | null };
        assigned_user_label: string | null;
      } | null;
    }>('/api/crm-educacion/prospectia/import', {
      method: 'POST', body: JSON.stringify(body),
    }),
  listCrmEducationOpportunities: (params: {
    categoria?: EducationCategoryScope; channel?: string; q?: string;
    view?: 'recent' | 'solo_contacto' | 'open' | 'closed' | 'unassigned' | 'all';
    page?: number; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    return request<{
      items: Array<{
        id: string;
        channel: string;
        external_id: string;
        source_label: string | null;
        from_meta?: boolean;
        prospectia_inbox?: string | null;
        has_prospectia_chat?: boolean;
        linked_wa?: boolean;
        category: string;
        stage_slug: string;
        first_seen_at: string;
        classification: string;
        assigned_user_label: string | null;
        prospectia_status: string | null;
        interest_course: string | null;
        lead_score: number | null;
        came_with_inbound: boolean;
        wa_cycle_id: number | null;
        contacts: {
          name: string | null; last_name: string | null;
          phone: string | null; email: string | null;
        };
      }>;
      total: number; page: number; limit: number; pages: number;
    }>(`/api/crm-educacion/opportunities?${qs}`);
  },
  listCrmEducationContacts: (params: {
    categoria?: EducationCategoryScope; q?: string; segment?: string;
    attr_key?: string; attr_value?: string; page?: number; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    return request<{ items: EducationContact[]; total: number; page: number; limit: number; pages: number }>(
      `/api/crm-educacion/contacts?${qs}`,
    );
  },
  patchCrmEducationContact: (
    id: number,
    body: { area: EducationArea; name?: string; last_name?: string;
      email?: string | null; dni?: string | null; opt_in_email?: boolean;
      segment_slugs?: string[];
      attributes?: Record<string, string> },
  ) => request<EducationContact>(`/api/crm-educacion/contacts/${id}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  getCrmEducationCatalogs: () =>
    request<EducationCatalog>('/api/crm-educacion/catalogs'),
  listCrmEducationLeads: (params: {
    categoria?: EducationCategoryScope; channel?: string; q?: string;
    view?: 'recent' | 'new_number' | 'duplicate' | 'reassignable' | 'conflict' | 'in_progress' | 'all';
    unassigned?: boolean;
    page?: number; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    return request<{ items: EducationLead[]; counts: EducationLeadCounts;
      total: number; page: number; limit: number; pages: number }>(
      `/api/crm-educacion/leads?${qs}`,
    );
  },
  listCrmEducationCycles: (params: {
    categoria?: EducationCategoryScope; channel?: string; q?: string;
    view?: EducationCycleView; page?: number; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    return request<{ items: EducationCycle[]; counts: EducationCycleCounts;
      total: number; page: number; limit: number; pages: number }>(
      `/api/crm-educacion/cycles?${qs}`,
    );
  },
  getCrmEducationSla: (params: {
    categoria?: EducationCategoryScope; from?: string; to?: string;
  }) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    return request<EducationSlaReport>(`/api/crm-educacion/sla?${qs}`);
  },
  getCrmEducationManagementCatalogs: () =>
    request<EducationManagementCatalog>('/api/crm-educacion/management-catalogs'),
  patchCrmEducationManagement: (id: number, body: {
    area: EducationArea; assigned_user_id?: number | null; lead_status_id?: number | null;
    lead_id?: number;
    promise_at?: string | null;
    lost_reason?: string | null;
  }) => request(`/api/crm-educacion/contacts/${id}/management`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  lookupCrmEducationPayment: (code: string, provider?: string) => {
    const qs = new URLSearchParams({ code });
    if (provider && provider !== 'all') qs.set('provider', provider);
    return request<{ hits: Array<{
      provider: string; providerPaymentId: string; transactionCode: string;
      amount: number; currency: string; status: string;
      settlementKind?: 'positive' | 'authorized' | 'in_progress' | 'negative' | 'unknown';
      customerName: string | null; customerEmail: string | null; transactedAt: string | null;
    }> }>(`/api/crm-educacion/payments/lookup?${qs}`);
  },
  associateCrmEducationPayment: (body: {
    waCycleId: number; waContactId?: number; transactionCode: string;
    amountAgreed?: number; itemLabel?: string;
  }) => request<{
    sale: unknown;
    candidate: unknown;
    settlementKind: 'positive' | 'authorized' | 'in_progress' | 'negative' | 'unknown';
    closesCycle: boolean;
  }>('/api/crm-educacion/payments/associate', {
    method: 'POST', body: JSON.stringify(body),
  }),
  applyCrmEducationPayment: (body: {
    saleId: string; provider: 'niubiz' | 'paycash' | 'mercadopago';
    providerPaymentId: string; transactionCode: string; amountApplied: number;
    currency?: string;
  }) => request('/api/crm-educacion/payments/apply', {
    method: 'POST', body: JSON.stringify(body),
  }),
  patchCrmEducationSaleBilling: (saleId: string, body: {
    billingStatus: 'pending' | 'obs' | 'obs_asesor' | 'boleteado';
    billingNote?: string; enrollmentRef?: string;
  }) => request(`/api/crm-educacion/sales/${saleId}/billing`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  getCrmEducationSaleByCycle: (waCycleId: number) =>
    request<{
      id: string; waCycleId: number; amountAgreed: string | number;
      paymentStatus: string; billingStatus: string; reportedTxnCode: string | null;
      enrollmentRef: string | null; billingNote: string | null;
      applications: Array<{
        id: string; provider: string; providerPaymentId: string;
        transactionCode: string; amountApplied: string | number; reversedAt: string | null;
      }>;
    } | null>(`/api/crm-educacion/sales/by-cycle/${waCycleId}`),
  getCrmEducationCommercialAuthority: () =>
    request<{
      authority: 'wa' | 'one'; messaging: string; note: string;
      per_opportunity?: boolean; wa_ux?: string; wa_channels_pending?: string[];
    }>('/api/crm-educacion/commercial-authority'),
  getCrmEducationCommercialStages: () =>
    request<{
      source: string; mirror_while_wa_writes: boolean;
      stages: Array<{ slug: string; label: string; terminal: boolean; opens_sale_flow?: boolean }>;
      note?: string;
    }>('/api/crm-educacion/commercial-stages'),
  listCrmEducationBandeja: (params?: {
    categoria?: string; q?: string; view?: string; page?: number; limit?: number; includeWa?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.categoria) qs.set('categoria', params.categoria);
    if (params?.q) qs.set('q', params.q);
    if (params?.view) qs.set('view', params.view);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.includeWa === false) qs.set('includeWa', 'false');
    return request<{
      items: Array<{
        id: string; origin: 'one' | 'wa'; commercial_authority: 'one' | 'wa';
        channel: string; category: string; stage_slug: string;
        advisor_email: string | null; assigned_user_label: string | null;
        source_label: string | null; from_meta: boolean;
        prospectia_inbox: string | null; has_prospectia_chat: boolean | null;
        linked_wa: boolean; prospectia_status: string | null; interest_course: string | null;
        wa_cycle_id: number | null; opportunity_id: string | null;
        first_seen_at: string; last_interaction_at: string | null; closed_at: string | null;
        payment_link: string | null; last_call_at: string | null; last_call_result: string | null;
        contacts: { name: string | null; last_name: string | null; phone: string | null; email: string | null };
        badges: string[];
      }>;
      total: number; page: number; limit: number; pages: number; note?: string;
    }>(`/api/crm-educacion/bandeja?${qs}`);
  },
  getCrmEducationBandejaFicha: (id: string) =>
    request<{
      found: boolean;
      origin?: 'one' | 'wa';
      commercial_authority?: 'one' | 'wa';
      wa_cycle_id?: number | null;
      opportunity?: Record<string, unknown> | null;
      timeline?: Array<{
        id: string; channel: string; direction: string; result: string;
        occurred_at: string; notes: string | null; external_system: string | null;
        external_ref: string | null; payload?: unknown;
      }>;
      sale?: unknown;
      deep_links?: {
        wa_cycle_id: number | null;
        wa_chat_hint?: string | null;
        prospectia: string | null;
        prospectia_hint?: string | null;
      };
      note?: string;
      venta_ready?: boolean;
    }>(`/api/crm-educacion/bandeja/${encodeURIComponent(id)}`),
  patchCrmEducationOpportunity: (id: string, body: {
    stage_slug?: string; advisor_email?: string | null;
    interest_course?: string | null; close?: boolean;
  }) => request(`/api/crm-educacion/opportunities/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),
  createCrmEducationOpportunity: (body: {
    channel: 'manual' | 'widget' | 'anura';
    category: 'ca' | 'ep' | 'general';
    name?: string; last_name?: string; phone?: string; email?: string;
    interest_course?: string; advisor_email?: string; source_label?: string; stage_slug?: string;
  }) => request('/api/crm-educacion/opportunities', {
    method: 'POST', body: JSON.stringify(body),
  }),
  listCrmEducationActivities: (waCycleId?: number, opportunityId?: string) => {
    const qs = new URLSearchParams();
    if (waCycleId) qs.set('waCycleId', String(waCycleId));
    if (opportunityId) qs.set('opportunityId', opportunityId);
    return request<Array<{
      id: string; channel: string; direction: string; occurredAt: string;
      result: string; notes: string | null; actorEmail: string | null;
    }>>(`/api/crm-educacion/activities?${qs}`);
  },
  createCrmEducationActivity: (body: {
    waCycleId?: number; opportunityId?: string; waContactId?: number;
    channel: string; direction?: string;
    occurredAt: string; result: string; notes?: string;
  }) => request('/api/crm-educacion/activities', {
    method: 'POST', body: JSON.stringify(body),
  }),
  getAnuraContractSpike: () => request<{
    status: string; expected_fields: string[]; mapping: Record<string, string>; note: string;
    runtime?: { enabled: boolean; running: boolean; apiBase: string };
  }>('/api/crm-educacion/activities/anura-contract'),
  listAnuraActivitiesRecent: (opts?: { page?: number; pageSize?: number }) => {
    const page = opts?.page ?? 1;
    const pageSize = opts?.pageSize ?? 25;
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    return request<{
      items: Array<{
        id: string; channel: string; direction: string; result: string; occurredAt: string;
        notes: string | null; payload?: unknown; waCycleId: number | null;
        externalRef: string | null; externalSystem: string | null;
        contactName?: string | null; phone?: string | null; agentName?: string | null;
        agentRaw?: string | null; extension?: string | null;
        durationSeconds?: number | null; talkSeconds?: number | null; summary?: string;
        originLabel?: string | null; originNumber?: string | null;
        destinationLabel?: string | null; destinationNumber?: string | null;
        disposition?: string | null;
        advisorId?: number | null; advisorMatched?: boolean;
      }>;
      total: number;
      page: number;
      pageSize: number;
      pages: number;
    }>(`/api/crm-educacion/activities/anura/recent?${qs}`);
  },
  importAnuraActivities: (body?: { hours?: number; limit?: number }) =>
    request<{
      started: boolean; reason?: string; hours?: number; cdrs?: number;
      created?: number; skipped?: number; unmatched?: number;
      items?: Array<{ externalRef: string; waCycleId: number; result: string }>;
    }>('/api/crm-educacion/activities/anura/import', {
      method: 'POST', body: JSON.stringify(body ?? { hours: 24, limit: 40 }),
    }),
  distributeCrmEducation: (params: { categoria: EducationCategoryScope; channel?: string; q?: string }) =>
    request<{ assigned: number; by_area: Array<{ area: string; assigned: number }> }>(
      '/api/crm-educacion/distribute', { method: 'POST', body: JSON.stringify(params) }),
  reviewCrmEducationLead: (id: number, body: { area: EducationArea;
    action: 'open_new' | 'keep_existing' | 'dismiss' }) =>
    request(`/api/crm-educacion/leads/${id}/review`, {
      method: 'PATCH', body: JSON.stringify(body),
    }),
  createCrmEducationManualLead: (body: {
    source_key: 'manual_call' | 'manual_historical' | 'manual_organic';
    categoria: 'ca' | 'ep';
    name: string;
    last_name?: string;
    phone?: string;
    email?: string;
    dni?: string;
    curso?: string;
  }) => request<{
    contact_id: number;
    origin_id: number;
    cycle_id: number | null;
    created: true;
  }>('/api/crm-educacion/leads/manual', {
    method: 'POST', body: JSON.stringify(body),
  }),
  getMe: () => request<AuthUser>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  googleLoginUrl: () => '/api/auth/google',
  updateAccentTheme: (accentTheme: string) =>
    request<AuthUser>('/api/auth/me/accent-theme', {
      method: 'PUT',
      body: JSON.stringify({ accentTheme }),
    }),

  listWorkspaceUsers: (q?: string, pageToken?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (pageToken) params.set('pageToken', pageToken);
    const qs = params.toString();
    return request<{ users: import('@mali-one/shared').GoogleWorkspaceUser[]; nextPageToken: string | null }>(
      `/api/admin/users${qs ? `?${qs}` : ''}`,
    );
  },

  createWorkspaceUser: (body: import('@mali-one/shared').CreateWorkspaceUserDto) =>
    request<import('@mali-one/shared').GoogleWorkspaceUser>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  generateWorkspacePassword: () =>
    request<{ password: string }>('/api/admin/users/generate-password'),

  getGoogleAdminHealth: () =>
    request<{ ok: boolean; error?: string }>('/api/health/google-admin'),

  updateWorkspaceUser: (
    email: string,
    body: import('@mali-one/shared').UpdateWorkspaceUserDto,
  ) =>
    request<import('@mali-one/shared').GoogleWorkspaceUser>(
      `/api/admin/users/${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    ),

  resetWorkspacePassword: (
    email: string,
    options: import('@mali-one/shared').ResetWorkspacePasswordDto = {},
  ) =>
    request<import('@mali-one/shared').ResetWorkspacePasswordResult>(
      `/api/admin/users/${encodeURIComponent(email)}/reset-password`,
      {
        method: 'POST',
        body: JSON.stringify(options),
      },
    ),

  signOutWorkspaceUser: (email: string) =>
    request<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(email)}/sign-out`,
      { method: 'POST' },
    ),

  suspendWorkspaceUser: (email: string) =>
    request(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    }),

  listAppUsers: () => request<AppUserDto[]>('/api/admin/app-users'),

  listAdminAuditLogs: (cursor?: string) => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return request<{
      logs: import('@mali-one/shared').AdminAuditLogDto[];
      nextCursor: string | null;
    }>(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },

  updateAppUserModules: (id: string, modules: AppModule[]) =>
    request<AppUserDto>(`/api/admin/app-users/${id}/modules`, {
      method: 'PATCH',
      body: JSON.stringify({ modules }),
    }),

  shortenUrl: (url: string, customSlug?: string, tags?: string[]) =>
    request<import('@mali-one/shared').ShortLinkDto>('/api/links/shorten', {
      method: 'POST',
      body: JSON.stringify({ url, customSlug, tags }),
    }),

  createWhatsappLink: (
    phone: string,
    text?: string,
    customSlug?: string,
    tags?: string[],
    catalog?: {
      catalogCursoId?: string | null;
      catalogProgramaId?: string | null;
      catalogSedeId?: string | null;
    },
  ) =>
    request<import('@mali-one/shared').ShortLinkDto>('/api/links/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ phone, text, customSlug, tags, ...catalog }),
    }),

  whatsappCatalogOptions: () =>
    request<{
      cursos: Array<{ id: string; nombre: string }>;
      programas: Array<{ id: string; nombre: string }>;
      sedes: Array<{ id: string; nombre: string }>;
    }>('/api/links/whatsapp-catalog-options'),

  listEducacionCatalogAreas: () => request<EducacionAreaDto[]>('/api/educacion-catalog/areas'),
  createEducacionCatalogArea: (body: EducacionAreaInput) =>
    request<EducacionAreaDto>('/api/educacion-catalog/areas', { method: 'POST', body: JSON.stringify(body) }),
  updateEducacionCatalogArea: (id: string, body: EducacionAreaInput) =>
    request<EducacionAreaDto>(`/api/educacion-catalog/areas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEducacionCatalogArea: (id: string) =>
    request(`/api/educacion-catalog/areas/${id}`, { method: 'DELETE' }),
  listEducacionCatalogCursos: () => request<EducacionOfertaDto[]>('/api/educacion-catalog/cursos'),
  createEducacionCatalogCurso: (body: EducacionOfertaInput) =>
    request<EducacionOfertaDto>('/api/educacion-catalog/cursos', { method: 'POST', body: JSON.stringify(body) }),
  updateEducacionCatalogCurso: (id: string, body: EducacionOfertaInput) =>
    request<EducacionOfertaDto>(`/api/educacion-catalog/cursos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEducacionCatalogCurso: (id: string) =>
    request(`/api/educacion-catalog/cursos/${id}`, { method: 'DELETE' }),
  listEducacionCatalogProgramas: () => request<EducacionOfertaDto[]>('/api/educacion-catalog/programas'),
  createEducacionCatalogPrograma: (body: EducacionOfertaInput) =>
    request<EducacionOfertaDto>('/api/educacion-catalog/programas', { method: 'POST', body: JSON.stringify(body) }),
  updateEducacionCatalogPrograma: (id: string, body: EducacionOfertaInput) =>
    request<EducacionOfertaDto>(`/api/educacion-catalog/programas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEducacionCatalogPrograma: (id: string) =>
    request(`/api/educacion-catalog/programas/${id}`, { method: 'DELETE' }),
  listEducacionCatalogDistritos: () =>
    request<EducacionDistritoDto[]>('/api/educacion-catalog/distritos'),
  createEducacionCatalogDistrito: (body: { nombre: string; brochureUrl?: string | null; sortOrder?: number }) =>
    request<EducacionDistritoDto>('/api/educacion-catalog/distritos', { method: 'POST', body: JSON.stringify(body) }),
  updateEducacionCatalogDistrito: (id: string, body: { nombre: string; brochureUrl?: string | null; sortOrder?: number }) =>
    request<EducacionDistritoDto>(`/api/educacion-catalog/distritos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEducacionCatalogDistrito: (id: string) =>
    request(`/api/educacion-catalog/distritos/${id}`, { method: 'DELETE' }),
  listEducacionCatalogSedes: () => request<EducacionCatalogSedeDto[]>('/api/educacion-catalog/sedes'),
  createEducacionCatalogSede: (body: EducacionSedeInput) =>
    request<EducacionCatalogSedeDto>('/api/educacion-catalog/sedes', { method: 'POST', body: JSON.stringify(body) }),
  updateEducacionCatalogSede: (id: string, body: EducacionSedeInput) =>
    request<EducacionCatalogSedeDto>(`/api/educacion-catalog/sedes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteEducacionCatalogSede: (id: string) =>
    request(`/api/educacion-catalog/sedes/${id}`, { method: 'DELETE' }),
  listEducacionLeadStatuses: () =>
    request<EducationLeadStatusDefinition[]>('/api/educacion-catalog/estados-lead'),
  createEducacionLeadStatus: (body: {
    area: EducationAreaAlias | string; slug: string; label: string; sort_order?: number;
    is_default?: boolean; is_terminal?: boolean;
  }) => request<EducationLeadStatusDefinition>('/api/educacion-catalog/estados-lead', {
    method: 'POST', body: JSON.stringify(body),
  }),
  updateEducacionLeadStatus: (id: number, body: {
    area: EducationAreaAlias | string; label?: string; sort_order?: number;
    is_default?: boolean; is_terminal?: boolean; active?: boolean;
  }) => request<EducationLeadStatusDefinition>(`/api/educacion-catalog/estados-lead/${id}`, {
    method: 'PATCH', body: JSON.stringify(body),
  }),

  uploadFile: (file: File, customSlug?: string, tags?: string[]) => {
    const form = new FormData();
    form.append('file', file);
    if (customSlug) form.append('customSlug', customSlug);
    if (tags?.length) form.append('tags', tags.join(','));
    return request<import('@mali-one/shared').ShortLinkDto>('/api/links/upload', {
      method: 'POST',
      body: form,
    });
  },

  bulkShorten: (
    items: Array<{ url: string; customSlug?: string; tags?: string[] }>,
  ) =>
    request<import('@mali-one/shared').BulkLinksResultDto>(
      '/api/links/bulk/shorten',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    ),

  bulkWhatsapp: (
    items: Array<{
      phone: string;
      text?: string;
      customSlug?: string;
      tags?: string[];
    }>,
  ) =>
    request<import('@mali-one/shared').BulkLinksResultDto>(
      '/api/links/bulk/whatsapp',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    ),

  bulkUpload: (files: File[]) => {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    return request<import('@mali-one/shared').BulkLinksResultDto>(
      '/api/links/bulk/upload',
      {
        method: 'POST',
        body: form,
      },
    );
  },

  listLinks: (options: {
    page?: number;
    pageSize?: number;
    search?: string;
    tag?: string;
    type?: string;
    createdFrom?: string;
    createdTo?: string;
    includeArchived?: boolean;
  } = {}) => {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));
    if (options.search) params.set('search', options.search);
    if (options.tag) params.set('tag', options.tag);
    if (options.type && options.type !== 'all') params.set('type', options.type);
    if (options.createdFrom) params.set('createdFrom', options.createdFrom);
    if (options.createdTo) params.set('createdTo', options.createdTo);
    if (options.includeArchived) params.set('includeArchived', '1');
    const qs = params.toString();
    return request<import('@mali-one/shared').ShortLinksPageDto>(
      `/api/links${qs ? `?${qs}` : ''}`,
    );
  },

  updateLink: (id: string, body: import('@mali-one/shared').UpdateShortLinkDto) =>
    request<import('@mali-one/shared').ShortLinkDto>(`/api/links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  setLinkArchived: (id: string, archived: boolean) =>
    request<import('@mali-one/shared').ShortLinkDto>(
      `/api/links/${id}/archive`,
      {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      },
    ),

  deleteLink: (id: string) =>
    request(`/api/links/${id}`, { method: 'DELETE' }),

  getQrDefaultStyle: () =>
    request<import('@mali-one/shared').QrStyleDto>(
      '/api/links/me/qr-default-style',
    ),

  saveQrDefaultStyle: (style: import('@mali-one/shared').QrStyleDto) =>
    request<import('@mali-one/shared').QrStyleDto>(
      '/api/links/me/qr-default-style',
      { method: 'PUT', body: JSON.stringify(style) },
    ),

  updateLinkQrStyle: (
    id: string,
    style: import('@mali-one/shared').QrStyleDto & {
      clearCustomLogo?: boolean;
    },
    logoFile?: File,
    saveAsDefault = false,
  ) => {
    const params = new URLSearchParams();
    if (saveAsDefault) params.set('saveAsDefault', 'true');
    const qs = params.toString();
    if (logoFile) {
      const form = new FormData();
      form.append('payload', JSON.stringify(style));
      form.append('logo', logoFile);
      return request<import('@mali-one/shared').ShortLinkDto>(
        `/api/links/${id}/qr-style${qs ? `?${qs}` : ''}`,
        { method: 'PATCH', body: form },
      );
    }
    return request<import('@mali-one/shared').ShortLinkDto>(
      `/api/links/${id}/qr-style${qs ? `?${qs}` : ''}`,
      { method: 'PATCH', body: JSON.stringify(style) },
    );
  },

  removeLinkQrLogo: (id: string) =>
    request<import('@mali-one/shared').ShortLinkDto>(
      `/api/links/${id}/qr-logo`,
      { method: 'DELETE' },
    ),

  getLinkStats: (id: string, days = 30) =>
    request<import('@mali-one/shared').LinkStatsDto>(
      `/api/links/${id}/stats?days=${days}`,
    ),

  qrUrl: (id: string, format: 'png' | 'svg' | 'eps' = 'png', width?: number) => {
    const params = new URLSearchParams({ format });
    if (width) params.set('width', String(width));
    return `/api/links/${id}/qr?${params.toString()}`;
  },

  downloadQrBulk: async (
    ids: string[],
    format: 'png' | 'svg' = 'png',
    width?: number,
  ) => {
    const res = await fetch(`${API_BASE}/api/links/qr/bulk`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, format, width }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const message = error.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : res.statusText;
      throw new Error(text || 'Error al descargar QR');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = match?.[1] ?? `qrs-${format}-${stamp}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async fetchQrPreview(
    data: string,
    style: import('@mali-one/shared').QrStyleDto,
    options?: {
      linkId?: string;
      logoFile?: File;
      clearCustomLogo?: boolean;
      signal?: AbortSignal;
      width?: number;
    },
  ): Promise<Blob> {
    const form = new FormData();
    form.append(
      'payload',
      JSON.stringify({
        data,
        style: {
          ...style,
          ...(options?.clearCustomLogo ? { clearCustomLogo: true } : {}),
        },
        linkId: options?.linkId,
      }),
    );
    if (options?.logoFile) {
      form.append('logo', options.logoFile);
    }
    const params = new URLSearchParams();
    if (options?.width) params.set('width', String(options.width));
    const qs = params.toString();
    const res = await fetch(
      `${API_BASE}/api/links/qr-preview${qs ? `?${qs}` : ''}`,
      {
        method: 'POST',
        body: form,
        credentials: 'include',
        signal: options?.signal,
      },
    );
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const message = error.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : res.statusText;
      throw new Error(text || 'Error al generar vista previa');
    }
    return res.blob();
  },

  async fetchLinkQrObjectUrl(id: string): Promise<string> {
    const blob = await api.fetchLinkQrBlob(id);
    return URL.createObjectURL(blob);
  },

  async fetchLinkQrBlob(
    id: string,
    options?: { width?: number; signal?: AbortSignal },
  ): Promise<Blob> {
    const params = new URLSearchParams({ format: 'png' });
    if (options?.width) params.set('width', String(options.width));
    const res = await fetch(`${API_BASE}/api/links/${id}/qr?${params}`, {
      credentials: 'include',
      signal: options?.signal,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(
        typeof error.message === 'string' ? error.message : 'No se pudo generar el QR',
      );
    }
    return res.blob();
  },

  listS3Buckets: () =>
    request<import('@mali-one/shared').S3BucketInfo[]>('/api/s3-manager/buckets'),

  listS3Objects: (
    bucket: string,
    prefix?: string,
    continuationToken?: string,
  ) => {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    if (continuationToken) params.set('continuationToken', continuationToken);
    const qs = params.toString();
    return request<import('@mali-one/shared').S3ListObjectsResult>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/objects${qs ? `?${qs}` : ''}`,
    );
  },

  getS3DownloadUrl: (bucket: string, key: string) =>
    request<{ url: string; expiresIn: number }>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/download?key=${encodeURIComponent(key)}`,
    ),

  getS3PublicUrl: (bucket: string, key: string) =>
    request<import('@mali-one/shared').S3PublicUrlResult>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/public-url?key=${encodeURIComponent(key)}`,
    ),

  deleteS3Object: (bucket: string, key: string) =>
    request<{ ok: boolean }>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/objects?key=${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    ),

  getEducacionWidgetAdmin: () =>
    request<import('@mali-one/shared').EducacionAdminStateDto>(
      '/api/widgets/educacion/admin',
    ),

  updateEducacionWidgetSettings: (
    body: Partial<import('@mali-one/shared').EducacionWidgetSettingsDto>,
  ) =>
    request('/api/widgets/educacion/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  createEducacionSede: (body: Record<string, unknown>) =>
    request('/api/widgets/educacion/sedes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateEducacionSede: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/educacion/sedes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteEducacionSede: (id: string) =>
    request(`/api/widgets/educacion/sedes/${id}`, { method: 'DELETE' }),

  createEducacionSelectorSede: (body: Record<string, unknown>) =>
    request('/api/widgets/educacion/selector/sedes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateEducacionSelectorSede: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/educacion/selector/sedes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteEducacionSelectorSede: (id: string) =>
    request(`/api/widgets/educacion/selector/sedes/${id}`, { method: 'DELETE' }),

  updateEducacionPopup: (
    body: Partial<import('@mali-one/shared').EducacionPopupSettingsDto>,
  ) =>
    request('/api/widgets/educacion/popup', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  updateMuseoPopup: (
    body: Partial<import('@mali-one/shared').MuseoPopupSettingsDto>,
  ) =>
    request('/api/widgets/museo/popup', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  createEducacionAliado: (body: Record<string, unknown>) =>
    request('/api/widgets/educacion/aliados', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  importEducacionAliados: (items: Record<string, unknown>[], replace = true) =>
    request<{ upserted: number; total: number }>(
      '/api/widgets/educacion/aliados/import',
      {
        method: 'POST',
        body: JSON.stringify({ items, replace }),
      },
    ),

  updateEducacionAliado: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/educacion/aliados/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteEducacionAliado: (id: string) =>
    request(`/api/widgets/educacion/aliados/${id}`, { method: 'DELETE' }),

  listBibliotecaCarouselAdmin: () =>
    request<import('@mali-one/shared').BibliotecaCarouselItemDto[]>(
      '/api/widgets/biblioteca/carousel/admin',
    ),

  getBibliotecaCarouselSettings: () =>
    request<import('@mali-one/shared').BibliotecaCarouselSettingsDto>(
      '/api/widgets/biblioteca/carousel/settings',
    ),

  updateBibliotecaCarouselSettings: (body: {
    headerTitle: string;
    headerColor: string;
  }) =>
    request<import('@mali-one/shared').BibliotecaCarouselSettingsDto>(
      '/api/widgets/biblioteca/carousel/settings',
      { method: 'PUT', body: JSON.stringify(body) },
    ),

  createBibliotecaCarouselItem: (body: Record<string, unknown>) =>
    request('/api/widgets/biblioteca/carousel', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateBibliotecaCarouselItem: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/biblioteca/carousel/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteBibliotecaCarouselItem: (id: string) =>
    request(`/api/widgets/biblioteca/carousel/${id}`, { method: 'DELETE' }),

  getPamSettings: () =>
    request<{ id: string; benefits: string[]; notes: string[] }>(
      '/api/pam/settings',
    ),

  getPamPlans: () =>
    request<import('@mali-one/shared').PamPlanDto[]>('/api/pam/plans'),

  updatePamSettings: (body: { benefits: string[]; notes: string[] }) =>
    request('/api/pam/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  updatePamPlan: (id: string, body: Record<string, unknown>) =>
    request(`/api/pam/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listPamRegistrations: () =>
    request<import('@mali-one/shared').PamRegistrationDto[]>(
      '/api/pam/registrations',
    ),

  updatePamRegistration: (
    id: string,
    body: import('@mali-one/shared').UpdatePamRegistrationDto,
  ) =>
    request<import('@mali-one/shared').PamRegistrationDto>(
      `/api/pam/registrations/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  resendPamWelcome: (id: string) =>
    request<import('@mali-one/shared').PamRegistrationDto>(
      `/api/pam/registrations/${id}/resend-welcome`,
      { method: 'POST' },
    ),

  resendPamWelcomeWhatsapp: (id: string) =>
    request<import('@mali-one/shared').PamRegistrationDto>(
      `/api/pam/registrations/${id}/resend-welcome-whatsapp`,
      { method: 'POST' },
    ),

  previewPamExpiryNotices: () =>
    request<{
      diasAntes: number;
      autoEnabled: boolean;
      windowFrom: string;
      windowTo: string;
      total: number;
      candidates: Array<{
        id: string;
        nombres: string;
        apellidos: string;
        correo: string;
        plan: string;
        frecuencia: string;
        mpStatus: string | null;
        expiryDate: string;
      }>;
    }>('/api/pam/expiry-notices/preview'),

  sendPamExpiryNotices: () =>
    request<{
      total: number;
      sent: number;
      errors: number;
      skipped: number;
    }>('/api/pam/expiry-notices/send', { method: 'POST' }),

  getMuseoPopup: () =>
    request<import('@mali-one/shared').MuseoPopupSettingsDto>(
      '/api/widgets/museo/popup',
    ),

  // --- Screen Cast ---

  listScreenCastPlaylists: () =>
    request<
      (import('@mali-one/shared').ScreenCastPlaylistDto & {
        _count?: { monitors: number; items: number };
      })[]
    >('/api/screen-cast/playlists'),

  getScreenCastPlaylist: (id: string) =>
    request<
      import('@mali-one/shared').ScreenCastPlaylistDto & {
        items: import('@mali-one/shared').ScreenCastPlaylistItemDto[];
        _count?: { monitors: number };
      }
    >(`/api/screen-cast/playlists/${id}`),

  createScreenCastPlaylist: (body: {
    name: string;
    activo?: boolean;
    crossfade?: boolean;
    kenBurns?: boolean;
  }) =>
    request<import('@mali-one/shared').ScreenCastPlaylistDto>(
      '/api/screen-cast/playlists',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateScreenCastPlaylist: (
    id: string,
    body: {
      name?: string;
      activo?: boolean;
      crossfade?: boolean;
      kenBurns?: boolean;
    },
  ) =>
    request<import('@mali-one/shared').ScreenCastPlaylistDto>(
      `/api/screen-cast/playlists/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteScreenCastPlaylist: (id: string) =>
    request<{ ok: boolean }>(`/api/screen-cast/playlists/${id}`, {
      method: 'DELETE',
    }),

  duplicateScreenCastPlaylist: (id: string) =>
    request<
      import('@mali-one/shared').ScreenCastPlaylistDto & {
        items?: import('@mali-one/shared').ScreenCastPlaylistItemDto[];
        _count?: { monitors: number; items: number };
      }
    >(`/api/screen-cast/playlists/${id}/duplicate`, { method: 'POST' }),

  createScreenCastPlaylistItem: (
    playlistId: string,
    body: {
      mediaUrl: string;
      mediaType: import('@mali-one/shared').ScreenCastMediaType;
      durationMs?: number;
      sortOrder?: number;
      activo?: boolean;
    },
  ) =>
    request<import('@mali-one/shared').ScreenCastPlaylistItemDto>(
      `/api/screen-cast/playlists/${playlistId}/items`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  reorderScreenCastPlaylistItems: (
    playlistId: string,
    orderedIds: string[],
  ) =>
    request<import('@mali-one/shared').ScreenCastPlaylistItemDto[]>(
      `/api/screen-cast/playlists/${playlistId}/items/reorder`,
      { method: 'POST', body: JSON.stringify({ orderedIds }) },
    ),

  duplicateScreenCastPlaylistItem: (id: string) =>
    request<import('@mali-one/shared').ScreenCastPlaylistItemDto>(
      `/api/screen-cast/items/${id}/duplicate`,
      { method: 'POST' },
    ),

  updateScreenCastPlaylistItem: (
    id: string,
    body: Partial<{
      mediaUrl: string;
      mediaType: import('@mali-one/shared').ScreenCastMediaType;
      durationMs: number;
      sortOrder: number;
      activo: boolean;
    }>,
  ) =>
    request<import('@mali-one/shared').ScreenCastPlaylistItemDto>(
      `/api/screen-cast/items/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteScreenCastPlaylistItem: (id: string) =>
    request<{ ok: boolean }>(`/api/screen-cast/items/${id}`, {
      method: 'DELETE',
    }),

  listScreenCastMonitors: () =>
    request<import('@mali-one/shared').ScreenCastMonitorDto[]>(
      '/api/screen-cast/monitors',
    ),

  getScreenCastMonitor: (id: string) =>
    request<import('@mali-one/shared').ScreenCastMonitorDto>(
      `/api/screen-cast/monitors/${id}`,
    ),

  createScreenCastMonitor: (body: {
    screenKey: string;
    name: string;
    location?: string;
    orientation?: import('@mali-one/shared').ScreenCastOrientation;
    playlistId?: string | null;
    photoUrl?: string | null;
  }) =>
    request<import('@mali-one/shared').ScreenCastMonitorDto>(
      '/api/screen-cast/monitors',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateScreenCastMonitor: (
    id: string,
    body: Partial<{
      screenKey: string;
      name: string;
      location: string | null;
      orientation: import('@mali-one/shared').ScreenCastOrientation;
      playlistId: string | null;
      photoUrl: string | null;
    }>,
  ) =>
    request<import('@mali-one/shared').ScreenCastMonitorDto>(
      `/api/screen-cast/monitors/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteScreenCastMonitor: (id: string) =>
    request<{ ok: boolean }>(`/api/screen-cast/monitors/${id}`, {
      method: 'DELETE',
    }),

  listScreenCastScheduleOverrides: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to });
    return request<import('@mali-one/shared').ScreenCastScheduleOverrideDto[]>(
      `/api/screen-cast/schedule-overrides?${params.toString()}`,
    );
  },

  createScreenCastScheduleOverride: (body: {
    monitorId: string;
    playlistId: string;
    startsAt: string;
    endsAt: string;
  }) =>
    request<import('@mali-one/shared').ScreenCastScheduleOverrideDto>(
      '/api/screen-cast/schedule-overrides',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateScreenCastScheduleOverride: (
    id: string,
    body: Partial<{
      monitorId: string;
      playlistId: string;
      startsAt: string;
      endsAt: string;
    }>,
  ) =>
    request<import('@mali-one/shared').ScreenCastScheduleOverrideDto>(
      `/api/screen-cast/schedule-overrides/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteScreenCastScheduleOverride: (id: string) =>
    request<{ ok: boolean }>(`/api/screen-cast/schedule-overrides/${id}`, {
      method: 'DELETE',
    }),

  syncAllScreenCastMonitors: () =>
    request<{ ok: boolean; notified: number }>(
      '/api/screen-cast/monitors/sync',
      { method: 'POST' },
    ),

  syncScreenCastMonitor: (id: string) =>
    request<{ ok: boolean; notified: number; screenKey: string }>(
      `/api/screen-cast/monitors/${id}/sync`,
      { method: 'POST' },
    ),

  getScreenCastPublicConfig: (screenKey: string) =>
    request<import('@mali-one/shared').ScreenCastPublicConfigDto>(
      `/api/screen-cast/screens/${encodeURIComponent(screenKey)}/config`,
    ),

  listScreenCastS3Buckets: () =>
    request<import('@mali-one/shared').S3BucketInfo[]>(
      '/api/screen-cast/s3/buckets',
    ),

  getScreenCastS3PickerConfig: () =>
    request<import('@mali-one/shared').S3ScreenCastPickerConfigDto>(
      '/api/screen-cast/s3/config',
    ),

  listScreenCastS3Objects: (
    bucket: string,
    prefix?: string,
    continuationToken?: string,
  ) => {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    if (continuationToken) params.set('continuationToken', continuationToken);
    const qs = params.toString();
    return request<import('@mali-one/shared').S3ListObjectsResult>(
      `/api/screen-cast/s3/buckets/${encodeURIComponent(bucket)}/objects${qs ? `?${qs}` : ''}`,
    );
  },

  getScreenCastS3PublicUrl: (bucket: string, key: string) =>
    request<import('@mali-one/shared').S3PublicUrlResult>(
      `/api/screen-cast/s3/buckets/${encodeURIComponent(bucket)}/public-url?key=${encodeURIComponent(key)}`,
    ),

  uploadScreenCastMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<import('@mali-one/shared').ScreenCastUploadResultDto>(
      '/api/screen-cast/s3/upload',
      {
        method: 'POST',
        body: form,
      },
    );
  },

  getBsaleOffices: () =>
    request<import('@mali-one/shared').BsaleOfficeDto[]>('/api/bsale/offices'),

  getBsaleKardex: (body: import('@mali-one/shared').BsaleKardexQueryDto) =>
    request<import('@mali-one/shared').BsaleKardexJobDto>(
      '/api/bsale/kardex',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  exportBsaleKardex: async (
    body: import('@mali-one/shared').BsaleKardexExportDto,
  ) => {
    const res = await fetch(`${API_BASE}/api/bsale/kardex/export`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const message = error.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : res.statusText;
      throw new Error(text || 'Error al exportar');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename =
      match?.[1] ??
      `kardex_bsale_${body.from}_${body.to}.${body.format === 'xlsx' ? 'xlsx' : 'csv'}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  listNewsletters: () =>
    request<import('@mali-one/shared').NewsletterDto[]>('/api/newsletters'),

  getNewsletter: (id: string) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/newsletters/${id}`,
    ),

  createNewsletter: (body: import('@mali-one/shared').CreateNewsletterDto) =>
    request<import('@mali-one/shared').NewsletterDto>('/api/newsletters', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateNewsletter: (
    id: string,
    body: import('@mali-one/shared').UpdateNewsletterDto,
  ) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/newsletters/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteNewsletter: (id: string) =>
    request<{ ok: boolean }>(`/api/newsletters/${id}`, {
      method: 'DELETE',
    }),

  duplicateNewsletter: (id: string) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/newsletters/${encodeURIComponent(id)}/duplicate`,
      { method: 'POST' },
    ),

  getInternalAudience: (activeDays = 30) =>
    request<import('@mali-one/shared').InternalAudienceDto>(
      `/api/internal-communications/audience?activeDays=${activeDays}`,
    ),

  previewInternalAudience: (body: {
    activeDays?: number;
    orgUnitPaths?: string[];
    excludeOrgUnitPaths?: string[];
  }) =>
    request<import('@mali-one/shared').InternalAudienceDto>(
      '/api/internal-communications/audience/preview',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  listInternalNewsletters: () =>
    request<import('@mali-one/shared').NewsletterDto[]>(
      '/api/internal-communications/newsletters',
    ),

  getInternalNewsletter: (id: string) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/internal-communications/newsletters/${encodeURIComponent(id)}`,
    ),

  createInternalNewsletterDraft: (
    body: import('@mali-one/shared').CreateInternalNewsletterDraftDto,
  ) =>
    request<import('@mali-one/shared').NewsletterDto>(
      '/api/internal-communications/newsletters/draft',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  listInternalContent: () =>
    request<
      Array<{
        id: string;
        title: string;
        subject: string;
        brand: import('@mali-one/shared').NewsletterBrand | null;
        status: import('@mali-one/shared').NewsletterStatus;
        updatedAt: string;
        contentRevision: string;
        usedInCampaigns: number;
        editable: boolean;
      }>
    >('/api/internal-communications/content'),

  getInternalContent: (id: string) =>
    request<
      import('@mali-one/shared').NewsletterDto & {
        contentRevisionToken: string;
        editable: boolean;
      }
    >(`/api/internal-communications/content/${encodeURIComponent(id)}`),

  createInternalContent: (body: {
    title: string;
    subject: string;
    htmlBody: string;
    designJson?: string | null;
    brand?: import('@mali-one/shared').NewsletterBrand | null;
  }) =>
    request<import('@mali-one/shared').NewsletterDto>(
      '/api/internal-communications/content',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateInternalContent: (
    id: string,
    body: {
      title?: string;
      subject?: string;
      htmlBody?: string;
      designJson?: string | null;
      brand?: import('@mali-one/shared').NewsletterBrand | null;
      contentRevision: string;
    },
  ) =>
    request<
      import('@mali-one/shared').NewsletterDto & {
        contentRevisionToken: string;
        editable: boolean;
      }
    >(`/api/internal-communications/content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  duplicateInternalContent: (id: string) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/internal-communications/content/${encodeURIComponent(id)}/duplicate`,
      { method: 'POST', body: '{}' },
    ),

  deleteInternalContent: (id: string) =>
    request<{ ok: boolean }>(
      `/api/internal-communications/content/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  listInternalCampaigns: () =>
    request<import('@mali-one/shared').InternalCampaignDto[]>(
      '/api/internal-communications/campaigns',
    ),

  getInternalCampaign: (id: string) =>
    request<import('@mali-one/shared').InternalCampaignDetailDto>(
      `/api/internal-communications/campaigns/${encodeURIComponent(id)}`,
    ),

  getInternalCampaignStats: (id: string, days = 30) =>
    request<import('@mali-one/shared').MalichimpCampaignStatsDto>(
      `/api/internal-communications/campaigns/${encodeURIComponent(id)}/stats?days=${encodeURIComponent(String(days))}`,
    ),

  duplicateInternalCampaign: (id: string) =>
    request<import('@mali-one/shared').InternalCampaignDetailDto>(
      `/api/internal-communications/campaigns/${encodeURIComponent(id)}/duplicate`,
      { method: 'POST', body: '{}' },
    ),

  deleteInternalCampaign: (id: string) =>
    request<{ ok: boolean }>(
      `/api/internal-communications/campaigns/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),

  createInternalCampaign: (
    body: import('@mali-one/shared').CreateInternalCampaignDto,
  ) =>
    request<{ id: string; status: string; totalRecipients: number; scheduledAt: string | null }>(
      '/api/internal-communications/campaigns',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  sendInternalDraftCampaign: (
    id: string,
    body: import('@mali-one/shared').CreateInternalCampaignDto,
  ) =>
    request<{ id: string; status: string; totalRecipients: number; scheduledAt: string | null }>(
      `/api/internal-communications/campaigns/${encodeURIComponent(id)}/send`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  listLandings: () =>
    request<import('@mali-one/shared').LandingPageDto[]>('/api/landings'),

  getLanding: (id: string) =>
    request<import('@mali-one/shared').LandingPageDto>(`/api/landings/${id}`),

  createLanding: (body: import('@mali-one/shared').CreateLandingPageDto) =>
    request<import('@mali-one/shared').LandingPageDto>('/api/landings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateLanding: (
    id: string,
    body: import('@mali-one/shared').UpdateLandingPageDto,
  ) =>
    request<import('@mali-one/shared').LandingPageDto>(`/api/landings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  previewLanding: (body: import('@mali-one/shared').LandingPreviewDto) =>
    request<{ html: string }>('/api/landings/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  publishLanding: (id: string) =>
    request<import('@mali-one/shared').LandingPageDto>(
      `/api/landings/${id}/publish`,
      { method: 'POST', body: '{}' },
    ),

  unpublishLanding: (id: string) =>
    request<import('@mali-one/shared').LandingPageDto>(
      `/api/landings/${id}/unpublish`,
      { method: 'POST', body: '{}' },
    ),

  deleteLanding: (id: string) =>
    request<{ ok: boolean }>(`/api/landings/${id}`, { method: 'DELETE' }),

  listCrmPamContacts: (params?: {
    q?: string;
    segment?: string;
    attr_key?: string;
    attr_value?: string;
    has_email?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.segment) qs.set('segment', params.segment);
    if (params?.attr_key) qs.set('attr_key', params.attr_key);
    if (params?.attr_value !== undefined) {
      qs.set('attr_value', params.attr_value);
    }
    if (params?.has_email !== undefined) {
      qs.set('has_email', String(params.has_email));
    }
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<{
      area: string;
      total: number;
      page: number;
      limit: number;
      pages: number;
      items: Array<{
        contact_id: number;
        name: string;
        last_name: string;
        phone: string | null;
        whatsapp_user_id: string | null;
        wa_username: string | null;
        email: string | null;
        dni: string | null;
        opt_in: boolean;
        opt_in_email: boolean;
        active: boolean;
        segment_slugs: string[];
        attributes: Record<string, string>;
        created_at: string;
        updated_at: string;
      }>;
    }>(`/api/crm-pam/contacts${q ? `?${q}` : ''}`);
  },

  patchCrmPamContact: (
    id: number,
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
  ) =>
    request(`/api/crm-pam/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listCrmPamAttributeDefinitions: () =>
    request<
      Array<{
        id: number;
        segment_slug: string | null;
        slug: string;
        label: string;
        field_type: string;
        sort_order: number;
        required: boolean;
        active: boolean;
      }>
    >('/api/crm-pam/attribute-definitions'),

  listCrmPamSegments: () =>
    request<Array<{ slug: string; label: string; color_key?: string }>>(
      '/api/crm-pam/segments',
    ),

  createCrmPamAttributeDefinition: (body: {
    scope: 'area' | 'segment';
    segment_slug?: string;
    slug: string;
    label: string;
    field_type?: string;
    sort_order?: number;
    required?: boolean;
  }) =>
    request('/api/crm-pam/attribute-definitions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCrmPamAttributeDefinition: (
    id: number,
    body: {
      label: string;
      field_type?: string;
      sort_order?: number;
      required?: boolean;
      active?: boolean;
    },
  ) =>
    request(`/api/crm-pam/attribute-definitions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listCrmPamPayments: () =>
    request<import('@mali-one/shared').PamRegistrationDto[]>(
      '/api/crm-pam/payments',
    ),

  listCrmPamPaymentMethods: () =>
    request<import('@mali-one/shared').PamPaymentMethodDto[]>(
      '/api/crm-pam/payment-methods',
    ),

  createCrmPamPaymentMethod: (
    body: import('@mali-one/shared').CreatePamPaymentMethodDto,
  ) =>
    request<import('@mali-one/shared').PamPaymentMethodDto>(
      '/api/crm-pam/payment-methods',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateCrmPamPaymentMethod: (
    id: string,
    body: import('@mali-one/shared').UpdatePamPaymentMethodDto,
  ) =>
    request<import('@mali-one/shared').PamPaymentMethodDto>(
      `/api/crm-pam/payment-methods/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteCrmPamPaymentMethod: (id: string) =>
    request<{ ok: boolean }>(`/api/crm-pam/payment-methods/${id}`, {
      method: 'DELETE',
    }),

  createCrmPamPayment: (
    body: import('@mali-one/shared').CreatePamPaymentDto,
  ) =>
    request<import('@mali-one/shared').PamRegistrationDto>(
      '/api/crm-pam/payments',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  linkCrmPamPayment: (id: string) =>
    request<{ ok: boolean; paymentId: string; phone: string }>(
      `/api/crm-pam/payments/${id}/link-contact`,
      { method: 'POST' },
    ),

  linkCrmPamPaymentsByPhone: () =>
    request<{
      ok: boolean;
      linked: number;
      phones: number;
      errors: Array<{ paymentId: string; error: string }>;
    }>('/api/crm-pam/payments/link-by-phone', { method: 'POST' }),

  getTodoMeta: () =>
    request<import('@mali-one/shared').TodoMetaDto>('/api/todos/meta'),

  getPortfolioMeta: () =>
    request<import('@mali-one/shared').PortfolioMetaDto>('/api/portfolio/meta'),

  getPortfolioDashboard: (ownerId?: string) => {
    const qs = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
    return request<import('@mali-one/shared').PortfolioDashboardDto>(
      `/api/portfolio/dashboard${qs}`,
    );
  },

  listProjects: (params?: import('@mali-one/shared').ListProjectsQuery) => {
    const qs = new URLSearchParams();
    if (params?.ownerId) qs.set('ownerId', params.ownerId);
    if (params?.statusId) qs.set('statusId', params.statusId);
    if (params?.area) qs.set('area', params.area);
    if (params?.includeArchived !== undefined) {
      qs.set('includeArchived', String(params.includeArchived));
    }
    if (params?.includeClosed !== undefined) {
      qs.set('includeClosed', String(params.includeClosed));
    }
    const query = qs.toString();
    return request<import('@mali-one/shared').PortfolioProjectDto[]>(
      `/api/portfolio/projects${query ? `?${query}` : ''}`,
    );
  },

  createProject: (body: import('@mali-one/shared').CreatePortfolioProjectDto) =>
    request<import('@mali-one/shared').PortfolioProjectDto>(
      '/api/portfolio/projects',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateProject: (
    id: string,
    body: import('@mali-one/shared').UpdatePortfolioProjectDto,
  ) =>
    request<import('@mali-one/shared').PortfolioProjectDto>(
      `/api/portfolio/projects/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  reorderProjects: (body: import('@mali-one/shared').ReorderProjectsDto) =>
    request<{ ok: boolean }>('/api/portfolio/projects/reorder', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteProject: (id: string) =>
    request<{ ok: boolean }>(`/api/portfolio/projects/${id}`, {
      method: 'DELETE',
    }),

  listOperationalServices: (ownerId?: string) => {
    const qs = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
    return request<import('@mali-one/shared').OperationalServiceDto[]>(
      `/api/portfolio/services${qs}`,
    );
  },

  createOperationalService: (
    body: import('@mali-one/shared').CreateOperationalServiceDto,
  ) =>
    request<import('@mali-one/shared').OperationalServiceDto>(
      '/api/portfolio/services',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateOperationalService: (
    id: string,
    body: import('@mali-one/shared').UpdateOperationalServiceDto,
  ) =>
    request<import('@mali-one/shared').OperationalServiceDto>(
      `/api/portfolio/services/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteOperationalService: (id: string) =>
    request<{ ok: boolean }>(`/api/portfolio/services/${id}`, {
      method: 'DELETE',
    }),

  listTodos: (params?: import('@mali-one/shared').ListTodosQuery) => {
    const qs = new URLSearchParams();
    if (params?.ownerId) qs.set('ownerId', params.ownerId);
    if (params?.statusId) qs.set('statusId', params.statusId);
    if (params?.typeId) qs.set('typeId', params.typeId);
    if (params?.projectId) qs.set('projectId', params.projectId);
    if (params?.area) qs.set('area', params.area);
    if (params?.origin) qs.set('origin', params.origin);
    if (params?.priority) qs.set('priority', params.priority);
    if (params?.includeDone !== undefined) {
      qs.set('includeDone', String(params.includeDone));
    }
    if (params?.includeArchived !== undefined) {
      qs.set('includeArchived', String(params.includeArchived));
    }
    if (params?.dueBefore) qs.set('dueBefore', params.dueBefore);
    if (params?.dueAfter) qs.set('dueAfter', params.dueAfter);
    const query = qs.toString();
    return request<import('@mali-one/shared').TodoItemDto[]>(
      `/api/todos${query ? `?${query}` : ''}`,
    );
  },

  createTodo: (body: import('@mali-one/shared').CreateTodoItemDto) =>
    request<import('@mali-one/shared').TodoItemDto>('/api/todos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTodo: (
    id: string,
    body: import('@mali-one/shared').UpdateTodoItemDto,
  ) =>
    request<import('@mali-one/shared').TodoItemDto>(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  reorderTodos: (body: import('@mali-one/shared').ReorderTodosDto) =>
    request<{ ok: boolean }>('/api/todos/reorder', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  addTodoTime: (id: string, minutes: number) =>
    request<import('@mali-one/shared').TodoItemDto>(`/api/todos/${id}/time`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),

  deleteTodo: (id: string) =>
    request<{ ok: boolean }>(`/api/todos/${id}`, { method: 'DELETE' }),

  createTodoType: (body: import('@mali-one/shared').CreateTodoTypeDto) =>
    request<import('@mali-one/shared').TodoTypeDto>('/api/todos/meta/types', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateTodoType: (
    id: string,
    body: import('@mali-one/shared').UpdateTodoTypeDto,
  ) =>
    request<import('@mali-one/shared').TodoTypeDto>(
      `/api/todos/meta/types/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteTodoType: (id: string) =>
    request<{ ok: boolean }>(`/api/todos/meta/types/${id}`, {
      method: 'DELETE',
    }),

  createTodoStatus: (body: import('@mali-one/shared').CreateTodoStatusDto) =>
    request<import('@mali-one/shared').TodoStatusDto>(
      '/api/todos/meta/statuses',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateTodoStatus: (
    id: string,
    body: import('@mali-one/shared').UpdateTodoStatusDto,
  ) =>
    request<import('@mali-one/shared').TodoStatusDto>(
      `/api/todos/meta/statuses/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteTodoStatus: (id: string) =>
    request<{ ok: boolean }>(`/api/todos/meta/statuses/${id}`, {
      method: 'DELETE',
    }),

  listFiles: (path?: string) => {
    const qs = path ? `?path=${encodeURIComponent(path)}` : '';
    return request<import('@mali-one/shared').FilesListResultDto>(
      `/api/files${qs}`,
    );
  },

  filesConfig: () =>
    request<import('@mali-one/shared').FilesConfigDto>('/api/files/config'),

  listTrashFiles: (path?: string) => {
    const qs = path ? `?path=${encodeURIComponent(path)}` : '';
    return request<import('@mali-one/shared').FilesListResultDto>(
      `/api/files/trash${qs}`,
    );
  },

  mkdirFile: (path: string) =>
    request<{ ok: boolean; path: string }>('/api/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  renameFile: (from: string, to: string) =>
    request<{ ok: boolean }>('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    }),

  copyFile: (from: string, to: string) =>
    request<{ ok: boolean; path: string }>('/api/files/copy', {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    }),

  restoreFile: (path: string) =>
    request<{ ok: boolean; path: string }>('/api/files/restore', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  deleteFile: (path: string, isFolder: boolean) => {
    const params = new URLSearchParams({
      path,
      isFolder: isFolder ? 'true' : 'false',
    });
    return request<{ ok: boolean }>(`/api/files?${params}`, {
      method: 'DELETE',
    });
  },

  uploadDiskFile: async (dirPath: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const qs = `?path=${encodeURIComponent(dirPath || '/')}`;
    return request<{ ok: boolean; path: string }>(`/api/files/upload${qs}`, {
      method: 'POST',
      body: form,
    });
  },

  downloadDiskFileUrl: (path: string) =>
    `/api/files/download?path=${encodeURIComponent(path)}`,

  previewDiskFileUrl: (path: string) =>
    `/api/files/preview?path=${encodeURIComponent(path)}`,
};
