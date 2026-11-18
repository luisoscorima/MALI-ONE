import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente HTTP de Prospectia = Chatwoot (https://www.chatwoot.com/).
 * Host: prospectia.attachmedia.com — mismos endpoints `/api/v1/accounts/:id/...`.
 * Docs API: https://www.chatwoot.com/developers/api/
 */
export type ProspectiaMatch = 'exists' | 'missing' | 'unverified';
export type ProspectiaSubject = {
  key: string;
  phone?: string | null;
  username?: string | null;
  whatsapp_user_id?: string | null;
};

export type ProspectiaContact = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  whatsapp_user_id?: string | null;
  identifier?: string | null;
  last_activity_at?: number | null;
  created_at?: number | null;
  /** Labels a nivel contacto (Chatwoot); el estado comercial suele estar en la conversación. */
  labels?: string[] | null;
  /** Score agregado Chatwoot/Prospectia (puede coexistir con custom_attributes.lead_scoring). */
  last_lead_scoring?: number | null;
  additional_attributes?: Record<string, unknown> | null;
  custom_attributes?: Record<string, unknown> | null;
};

export type ProspectiaConversation = {
  id?: number;
  status?: string;
  inbox_id?: number;
  labels?: string[] | null;
  custom_attributes?: Record<string, unknown> | null;
  additional_attributes?: Record<string, unknown> | null;
  last_activity_at?: number;
  created_at?: number;
  meta?: {
    assignee?: { id?: number; email?: string | null; name?: string | null } | null;
    team?: { id?: number; name?: string | null } | null;
  };
};

type Conversation = ProspectiaConversation;

type SearchOutcome =
  | { kind: 'unverified' }
  | { kind: 'missing' }
  | { kind: 'exists'; id: number; complete: boolean };

function normalizePhone(raw: string): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

function normalizeIdentity(raw: string): string | null {
  const value = String(raw ?? '').trim().replace(/^@+/, '').toLowerCase();
  return /^[a-z0-9._]{3,128}$/.test(value) ? value : null;
}

function splitName(raw: string | null | undefined): { name: string | null; lastName: string | null } {
  const full = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (!full) return { name: null, lastName: null };
  const parts = full.split(' ');
  if (parts.length === 1) return { name: parts[0], lastName: null };
  return { name: parts[0], lastName: parts.slice(1).join(' ') };
}

@Injectable()
export class ProspectiaClientService {
  private readonly logger = new Logger(ProspectiaClientService.name);

  get enabled(): boolean {
    return Boolean(process.env.PROSPECTIA_API_ACCESS_TOKEN?.trim());
  }

  normalizePhone(raw: string): string | null {
    return normalizePhone(raw);
  }

  splitName(raw: string | null | undefined) {
    return splitName(raw);
  }

  async checkSubjects(
    subjects: ProspectiaSubject[],
  ): Promise<{ enabled: boolean; matches: Record<string, ProspectiaMatch> }> {
    const matches: Record<string, ProspectiaMatch> = {};
    const unique = [...new Map(subjects.map((s) => [s.key, s])).values()];
    for (let i = 0; i < unique.length; i += 5) {
      const batch = unique.slice(i, i + 5);
      const values = await Promise.all(batch.map((s) => this.matchSubject(s)));
      batch.forEach((s, index) => {
        matches[s.key] = values[index];
      });
    }
    return { enabled: this.enabled, matches };
  }

  async lookup(
    subject: ProspectiaSubject,
  ): Promise<{ match: ProspectiaMatch; advisorEmail: string | null; contact: ProspectiaContact | null }> {
    if (!this.enabled) return { match: 'unverified', advisorEmail: null, contact: null };
    const found = await this.resolve(subject);
    if (found.kind !== 'exists') return { match: found.kind, advisorEmail: null, contact: null };
    const contact = await this.getContact(found.id);
    if (!found.complete) {
      return { match: 'exists', advisorEmail: null, contact };
    }
    return {
      match: 'exists',
      advisorEmail: await this.advisorEmailFor(found.id),
      contact,
    };
  }

  /** Listado paginado estilo Chatwoot/Prospectia. */
  async listContactsPage(page = 1): Promise<{
    contacts: ProspectiaContact[];
    page: number;
    hasMore: boolean;
    count: number;
  }> {
    const token = process.env.PROSPECTIA_API_ACCESS_TOKEN?.trim();
    const accountId = process.env.PROSPECTIA_ACCOUNT_ID?.trim() || '21';
    if (!token || !/^\d+$/.test(accountId)) {
      return { contacts: [], page, hasMore: false, count: 0 };
    }
    const url = new URL(
      `https://prospectia.attachmedia.com/api/v1/accounts/${accountId}/contacts`,
    );
    url.searchParams.set('page', String(Math.max(1, page)));
    try {
      const result = await this.get<{
        payload?: ProspectiaContact[] | { contacts?: ProspectiaContact[] };
        meta?: { count?: number; current_page?: number };
      }>(url, token);
      const payload = result.payload;
      const contacts = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.contacts)
          ? payload.contacts
          : [];
      const count = Number(result.meta?.count ?? contacts.length);
      const hasMore = contacts.length > 0 && page * contacts.length < count;
      return { contacts, page, hasMore, count };
    } catch (err) {
      this.logger.warn(
        `Prospectia listContacts page=${page} falló: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }
  }

  async getContact(contactId: number): Promise<ProspectiaContact | null> {
    const token = process.env.PROSPECTIA_API_ACCESS_TOKEN?.trim();
    const accountId = process.env.PROSPECTIA_ACCOUNT_ID?.trim() || '21';
    if (!token || !/^\d+$/.test(accountId)) return null;
    try {
      const result = await this.get<{
        payload?: ProspectiaContact | { contact?: ProspectiaContact };
      }>(
        new URL(
          `https://prospectia.attachmedia.com/api/v1/accounts/${accountId}/contacts/${contactId}`,
        ),
        token,
      );
      const payload = result.payload;
      if (!payload) return null;
      if ('id' in payload && typeof payload.id === 'number') return payload;
      if ('contact' in payload && payload.contact) return payload.contact;
      return null;
    } catch {
      return null;
    }
  }

  async listConversations(contactId: number): Promise<ProspectiaConversation[]> {
    const token = process.env.PROSPECTIA_API_ACCESS_TOKEN?.trim();
    const accountId = process.env.PROSPECTIA_ACCOUNT_ID?.trim() || '21';
    if (!token || !/^\d+$/.test(accountId)) return [];
    try {
      const conversations = await this.get<{ payload?: ProspectiaConversation[] }>(
        new URL(
          `https://prospectia.attachmedia.com/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
        ),
        token,
      );
      return Array.isArray(conversations.payload) ? conversations.payload : [];
    } catch {
      return [];
    }
  }

  /** Conversación abierta/pendiente más reciente; si no hay, la última por actividad. */
  async primaryConversation(contactId: number): Promise<ProspectiaConversation | null> {
    const list = await this.listConversations(contactId);
    if (!list.length) return null;
    const sorted = [...list].sort(
      (a, b) =>
        (b.last_activity_at ?? b.created_at ?? 0) -
        (a.last_activity_at ?? a.created_at ?? 0),
    );
    return (
      sorted.find((item) => item.status === 'open' || item.status === 'pending') ??
      sorted[0] ??
      null
    );
  }

  async advisorEmailFor(contactId: number): Promise<string | null> {
    const conversation = await this.primaryConversation(contactId);
    const email = conversation?.meta?.assignee?.email?.trim().toLowerCase();
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }

  private async resolve(subject: ProspectiaSubject): Promise<SearchOutcome> {
    const phone = subject.phone ? normalizePhone(subject.phone) : null;
    const identities = [
      ...new Set(
        [subject.username, subject.whatsapp_user_id]
          .map((value) => (value ? normalizeIdentity(value) : null))
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    if (!phone && !identities.length) return { kind: 'unverified' };
    let failed = false;
    if (phone) {
      const found = await this.findContact(phone, (item) =>
        Boolean(
          item.id &&
            item.phone_number &&
            normalizePhone(item.phone_number) === phone,
        ),
      );
      if (found.kind === 'exists') return found;
      if (found.kind === 'unverified') failed = true;
    }
    for (const identity of identities) {
      const found = await this.findUsername(identity);
      if (found.kind === 'exists') return found;
      if (found.kind === 'unverified') failed = true;
    }
    return failed ? { kind: 'unverified' } : { kind: 'missing' };
  }

  private async matchSubject(subject: ProspectiaSubject): Promise<ProspectiaMatch> {
    const found = await this.resolve(subject);
    return found.kind === 'exists' ? 'exists' : found.kind;
  }

  private async findUsername(username: string): Promise<SearchOutcome> {
    const searched = await this.findContact(username, (item) =>
      Boolean(item.id && normalizeIdentity(item.whatsapp_user_id ?? '') === username),
    );
    if (searched.kind !== 'missing') return searched;
    try {
      return await this.filterUsername(username);
    } catch {
      return searched;
    }
  }

  private async filterUsername(username: string): Promise<SearchOutcome> {
    const token = process.env.PROSPECTIA_API_ACCESS_TOKEN?.trim();
    const accountId = process.env.PROSPECTIA_ACCOUNT_ID?.trim() || '21';
    if (!token || !/^\d+$/.test(accountId)) return { kind: 'unverified' };
    const response = await fetch(
      `https://prospectia.attachmedia.com/api/v1/accounts/${accountId}/contacts/filter`,
      {
        method: 'POST',
        headers: {
          api_access_token: token,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: [
            {
              attribute_key: 'whatsapp_user_id',
              filter_operator: 'equal_to',
              values: [username],
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error(`Prospectia HTTP ${response.status}`);
    const result = (await response.json()) as {
      meta?: { count?: number };
      payload?: ProspectiaContact[];
    };
    if (!Array.isArray(result.payload)) return { kind: 'unverified' };
    const matches = result.payload.filter(
      (item) => item.id && normalizeIdentity(item.whatsapp_user_id ?? '') === username,
    );
    const count = Number(result.meta?.count ?? result.payload.length);
    const complete = !(count > result.payload.length);
    if (matches.length === 1) return { kind: 'exists', id: matches[0].id!, complete };
    if (matches.length === 0 && complete) return { kind: 'missing' };
    return { kind: 'unverified' };
  }

  private async findContact(
    query: string,
    accepts: (item: ProspectiaContact) => boolean,
  ): Promise<SearchOutcome> {
    const token = process.env.PROSPECTIA_API_ACCESS_TOKEN?.trim();
    const accountId = process.env.PROSPECTIA_ACCOUNT_ID?.trim() || '21';
    if (!token || !query || !/^\d+$/.test(accountId)) return { kind: 'unverified' };
    const search = new URL(
      `https://prospectia.attachmedia.com/api/v1/accounts/${accountId}/contacts/search`,
    );
    search.searchParams.set('q', query);
    try {
      const result = await this.get<{
        meta?: { count?: number };
        payload?: ProspectiaContact[];
      }>(search, token);
      if (!Array.isArray(result.payload)) return { kind: 'unverified' };
      const matches = result.payload.filter(accepts);
      const count = Number(result.meta?.count ?? result.payload.length);
      const complete = !(count > result.payload.length);
      if (matches.length === 1) return { kind: 'exists', id: matches[0].id!, complete };
      if (matches.length === 0 && complete) return { kind: 'missing' };
      return { kind: 'unverified' };
    } catch {
      return { kind: 'unverified' };
    }
  }

  private async get<T>(url: URL, token: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: { api_access_token: token, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Prospectia HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
}
