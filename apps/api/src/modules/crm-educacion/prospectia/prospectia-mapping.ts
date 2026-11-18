/**
 * Mapeo Prospectia → CRM Educación ONE.
 * Prospectia es Chatwoot (https://www.chatwoot.com/), account 21 en AttachMedia.
 * Fuente: API live 2026-11-18 (labels + custom_attribute_definitions + conversación muestra).
 */

export const PROSPECTIA_LABELS = [
  'agendamiento',
  'alumno_matriculado',
  'mql_cursos_de_arte',
  'mql_ep',
  'mql_experiencias',
  'no_contesta',
  'no_vent_cliente',
  'no_vent_horario',
  'no_vent_sede',
  'obj_precio',
  'sin_respuesta',
  'sql_cursos_de_arte',
  'sql_ep',
  'sql_experiencias',
  'venta_exitosa_arte',
  'venta_exitosa_ep',
] as const;

export type ProspectiaLabel = (typeof PROSPECTIA_LABELS)[number];

/** Prioridad al elegir etiqueta “estado” (mayor = más fuerte). */
const LABEL_PRIORITY: Record<string, number> = {
  venta_exitosa_arte: 100,
  venta_exitosa_ep: 100,
  alumno_matriculado: 90,
  sql_cursos_de_arte: 80,
  sql_ep: 80,
  sql_experiencias: 80,
  agendamiento: 70,
  mql_cursos_de_arte: 60,
  mql_ep: 60,
  mql_experiencias: 60,
  no_vent_cliente: 50,
  no_vent_horario: 50,
  no_vent_sede: 50,
  obj_precio: 50,
  no_contesta: 40,
  sin_respuesta: 40,
};

/** Etiqueta Prospectia → etapa CRM Educación (slug aproximado). */
const LABEL_TO_STAGE: Record<string, string> = {
  venta_exitosa_arte: 'venta_exitosa',
  venta_exitosa_ep: 'venta_exitosa',
  alumno_matriculado: 'venta_exitosa',
  sql_cursos_de_arte: 'negociacion',
  sql_ep: 'negociacion',
  sql_experiencias: 'negociacion',
  agendamiento: 'seguimiento',
  mql_cursos_de_arte: 'por_contactar',
  mql_ep: 'por_contactar',
  mql_experiencias: 'por_contactar',
  no_contesta: 'seguimiento',
  sin_respuesta: 'seguimiento',
  no_vent_cliente: 'perdido',
  no_vent_horario: 'perdido',
  no_vent_sede: 'perdido',
  obj_precio: 'perdido',
};

/** Custom attrs Chatwoot/Prospectia de anuncio Meta (CTWA). UI: ID/URL/Título/Cuerpo del anuncio Meta. */
export const PROSPECTIA_META_CTWA_KEYS = [
  'ctwa_source_id',
  'ctwa_source_url',
  'ctwa_headline',
  'ctwa_body',
  'ctwa_clid',
  'ctwa_media_url',
  'ctwa_media_type',
  'ctwa_source_type',
] as const;

/** Inboxes Prospectia (Chatwoot account 21). No son mali-whatsapp. */
export const PROSPECTIA_INBOXES: Record<
  number,
  { kind: 'web' | 'whatsapp'; label: string; categoryHint?: 'ca' | 'ep' | 'general' }
> = {
  39: { kind: 'web', label: 'Web' },
  27: { kind: 'whatsapp', label: 'WA CA', categoryHint: 'ca' },
  26: { kind: 'whatsapp', label: 'WA EP', categoryHint: 'ep' },
  28: { kind: 'whatsapp', label: 'WA XP', categoryHint: 'general' },
};

export type ProspectiaInboxInfo = {
  id: number;
  kind: 'web' | 'whatsapp';
  label: string;
};

export function resolveProspectiaInbox(
  inboxId: number | null | undefined,
): ProspectiaInboxInfo | null {
  if (inboxId == null || !Number.isFinite(Number(inboxId))) return null;
  const id = Number(inboxId);
  const known = PROSPECTIA_INBOXES[id];
  if (!known) return { id, kind: 'whatsapp', label: `Inbox ${id}` };
  return { id, kind: known.kind, label: known.label };
}

export type ProspectiaEnrichment = {
  category: 'ca' | 'ep' | 'general';
  stageSlug: string;
  prospectiaStatus: string | null;
  interestCourse: string | null;
  leadScore: number | null;
  advisorEmail: string | null;
  teamName: string | null;
  labels: string[];
  /** Badge binario: llegó con atribución de anuncio Meta (attrs ctwa_*). */
  fromMeta: boolean;
  inbox: ProspectiaInboxInfo | null;
};

/** True si hay al menos un attr CTWA/Meta no vacío. */
export function isMetaAdFromAttrs(
  ...bags: Array<Record<string, unknown> | null | undefined>
): boolean {
  for (const bag of bags) {
    if (!bag) continue;
    for (const key of PROSPECTIA_META_CTWA_KEYS) {
      const value = bag[key];
      if (value != null && String(value).trim() !== '') return true;
    }
  }
  return false;
}

export function pickPrimaryLabel(labels: string[]): string | null {
  const ranked = labels
    .map((l) => String(l ?? '').trim().toLowerCase())
    .filter(Boolean)
    .sort((a, b) => (LABEL_PRIORITY[b] ?? 0) - (LABEL_PRIORITY[a] ?? 0));
  return ranked[0] ?? null;
}

export function categoryFromProspectia(input: {
  labels: string[];
  teamName?: string | null;
  conversationAttrs?: Record<string, unknown> | null;
  contactAttrs?: Record<string, unknown> | null;
  inboxId?: number | null;
}): 'ca' | 'ep' | 'general' {
  const labels = input.labels.map((l) => l.toLowerCase());
  if (labels.some((l) => l.includes('_arte') || l === 'mql_cursos_de_arte' || l === 'sql_cursos_de_arte' || l === 'venta_exitosa_arte')) {
    return 'ca';
  }
  if (labels.some((l) => l.endsWith('_ep') || l === 'mql_ep' || l === 'sql_ep' || l === 'venta_exitosa_ep')) {
    return 'ep';
  }
  const team = String(input.teamName ?? '').toLowerCase();
  if (team.includes('arte')) return 'ca';
  if (team.includes('ep') || team.includes('profesional') || team.includes('extensi')) return 'ep';
  const attrs = {
    ...(input.contactAttrs ?? {}),
    ...(input.conversationAttrs ?? {}),
  };
  if (attrs.cursos_arte_y_taller || attrs.curso_arte) return 'ca';
  if (attrs.cursos_ext_profesional || attrs.curso_profesional) return 'ep';
  const categoria = String(attrs.categoria ?? '').toLowerCase();
  if (categoria.includes('arte') || categoria.includes('taller')) return 'ca';
  if (categoria.includes('profesional') || categoria.includes('ext')) return 'ep';
  const inboxHint = input.inboxId != null
    ? PROSPECTIA_INBOXES[Number(input.inboxId)]?.categoryHint
    : undefined;
  if (inboxHint) return inboxHint;
  return 'general';
}

export function interestFromAttrs(
  conversationAttrs?: Record<string, unknown> | null,
  contactAttrs?: Record<string, unknown> | null,
): string | null {
  const c = conversationAttrs ?? {};
  const p = contactAttrs ?? {};
  const raw =
    c.cursos_arte_y_taller ??
    c.cursos_ext_profesional ??
    c.cursos_acelera ??
    p.curso_arte ??
    p.curso_profesional ??
    null;
  const value = String(raw ?? '').trim();
  return value || null;
}

export function enrichFromProspectiaConversation(input: {
  labels?: string[] | null;
  customAttributes?: Record<string, unknown> | null;
  contactAttributes?: Record<string, unknown> | null;
  /** Fallback Chatwoot: contact.last_lead_scoring */
  contactLeadScore?: number | null;
  assigneeEmail?: string | null;
  teamName?: string | null;
  inboxId?: number | null;
}): ProspectiaEnrichment {
  const labels = (input.labels ?? []).map((l) => String(l).trim()).filter(Boolean);
  const prospectiaStatus = pickPrimaryLabel(labels);
  const stageSlug = prospectiaStatus
    ? (LABEL_TO_STAGE[prospectiaStatus] ?? 'por_contactar')
    : 'por_contactar';
  const inbox = resolveProspectiaInbox(input.inboxId);
  const category = categoryFromProspectia({
    labels,
    teamName: input.teamName,
    conversationAttrs: input.customAttributes,
    contactAttrs: input.contactAttributes,
    inboxId: input.inboxId,
  });
  const interestCourse = interestFromAttrs(
    input.customAttributes,
    input.contactAttributes,
  );
  const scoreRaw = input.customAttributes?.lead_scoring ?? input.contactLeadScore;
  const leadScore =
    typeof scoreRaw === 'number'
      ? scoreRaw
      : scoreRaw != null && String(scoreRaw).trim() !== '' && !Number.isNaN(Number(scoreRaw))
        ? Number(scoreRaw)
        : null;
  const advisorEmail = String(input.assigneeEmail ?? '')
    .trim()
    .toLowerCase();
  const fromMeta = isMetaAdFromAttrs(input.customAttributes, input.contactAttributes);
  return {
    category,
    stageSlug,
    prospectiaStatus,
    interestCourse,
    leadScore,
    advisorEmail: advisorEmail && advisorEmail.includes('@') ? advisorEmail : null,
    teamName: input.teamName ?? null,
    labels,
    fromMeta,
    inbox,
  };
}

/**
 * Fuente corta: Prospectia · [Web|WA CA|WA EP|WA XP] · [Meta] · [curso].
 * Sin saturar: inbox + Meta + un interés.
 */
export function prospectiaSourceLabel(input: {
  fromMeta: boolean;
  interestCourse: string | null;
  inboxLabel?: string | null;
}): string {
  const parts = [
    'Prospectia',
    input.inboxLabel?.trim() || null,
    input.fromMeta ? 'Meta' : null,
    input.interestCourse?.trim() || null,
  ].filter(Boolean);
  return parts.join(' · ');
}
