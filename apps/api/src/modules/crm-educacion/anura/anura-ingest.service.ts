import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { WhatsappCrmClientService } from '../../crm/whatsapp-crm-client.service';
import { AnuraClientService, type AnuraCdr } from './anura-client.service';

function digits(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

function partyPhone(cdr: AnuraCdr): string | null {
  const raw = String(cdr.direction ?? '').toUpperCase() === 'IN' ? cdr.calling : cdr.called;
  let d = digits(raw);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9) d = `51${d}`;
  return d.length >= 10 ? d : null;
}

function mapResult(status: string | undefined): 'reached' | 'no_answer' | 'attempted' | 'other' {
  const s = String(status ?? '').toUpperCase();
  if (s === 'ANSWER') return 'reached';
  if (s === 'NOANSWER' || s === 'BUSY') return 'no_answer';
  if (s === 'CANCEL' || s === 'CONGESTION') return 'attempted';
  return 'other';
}

function formatPhoneDisplay(raw: string | null | undefined): string | null {
  let d = digits(raw);
  if (d.startsWith('00')) d = d.slice(2);
  if (!d) return null;
  if (d.startsWith('51') && d.length >= 11) return `+${d}`;
  if (d.length === 9) return `+51${d}`;
  return d;
}

/**
 * Anura no trae el nombre del lead: `calledName`/`callingName` son etiqueta de ruta
 * ("PERU - RESTO - MOVIL") o del ramal ("Karol-108"). El nombre humano sale de ONE/WA.
 * Agente legible: "Karol-108" → "Karol".
 */
export function agentDisplayName(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const stripped = value.replace(/[-_ ]?\d{2,4}$/, '').trim();
  return stripped || value;
}

export type AnuraCallFields = {
  phone: string | null;
  agentName: string | null;
  agentRaw: string | null;
  durationSeconds: number | null;
  talkSeconds: number | null;
  extension: string | null;
};

export function fieldsFromCdr(cdr: AnuraCdr): AnuraCallFields {
  const inbound = String(cdr.direction ?? '').toUpperCase() === 'IN';
  const agentRaw = String(cdr.account?.name ?? cdr.callingName ?? cdr.calledName ?? '').trim() || null;
  const talk = cdr.billSeconds != null ? Number(cdr.billSeconds) : null;
  const ring = cdr.duration != null ? Number(cdr.duration) : null;
  return {
    phone: formatPhoneDisplay(inbound ? cdr.calling : cdr.called),
    agentName: agentDisplayName(agentRaw),
    agentRaw,
    durationSeconds: talk != null && talk > 0 ? talk : ring,
    talkSeconds: talk,
    extension: inbound
      ? (digits(cdr.called).length <= 4 ? digits(cdr.called) : null)
      : (digits(cdr.calling).length <= 4 ? digits(cdr.calling) : null),
  };
}

/** Nota corta de respaldo (filas viejas sin payload). */
export function anuraCdrNote(cdr: AnuraCdr): string {
  const fields = fieldsFromCdr(cdr);
  return [fields.phone, fields.agentRaw, fields.durationSeconds != null ? `${fields.durationSeconds}s` : null]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 500);
}

/** Tolera notas viejas ("200 → +51… · agente · 44s") y nuevas ("+51… · agente · 44s"). */
export function parseAnuraNote(notes: string | null | undefined): AnuraCallFields {
  if (!notes?.trim()) {
    return { phone: null, agentName: null, agentRaw: null, durationSeconds: null, talkSeconds: null, extension: null };
  }
  let text = notes.trim();
  text = text.replace(/^Anura CDR\s+\d+\s*·\s*/i, '');
  text = text.replace(/^(IN|OUT)\s*·\s*/i, '');
  text = text.replace(/^(ANSWER|CANCEL|NOANSWER|BUSY|CONGESTION)\s*·\s*/i, '');
  const chunks = text.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
  let phone: string | null = null;
  let agentRaw: string | null = null;
  let durationSeconds: number | null = null;
  let extension: string | null = null;
  for (const chunk of chunks) {
    const dur = chunk.match(/^(\d+)\s*s$/i);
    if (dur) {
      durationSeconds = Number(dur[1]);
      continue;
    }
    if (/→/.test(chunk)) {
      const [left, right] = chunk.split(/\s*→\s*/);
      if (digits(left).length <= 4) extension = digits(left) || null;
      phone = formatPhoneDisplay(right) || right || null;
      continue;
    }
    if (/^ramal\s+/i.test(chunk) || /^ext\s+/i.test(chunk)) {
      extension = digits(chunk) || null;
      continue;
    }
    const asPhone = formatPhoneDisplay(chunk);
    if (asPhone && digits(chunk).length >= 9) {
      phone = asPhone;
      continue;
    }
    if (!agentRaw) agentRaw = chunk;
  }
  return {
    phone,
    agentName: agentDisplayName(agentRaw),
    agentRaw,
    durationSeconds,
    talkSeconds: durationSeconds,
    extension,
  };
}

export function fieldsFromPayload(payload: unknown): AnuraCallFields | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, unknown>;
  // Webhooks guardan { ...cdr, _source, _hook }; el CDR puede ir anidado o plano.
  if (raw.cdr && typeof raw.cdr === 'object') return fieldsFromCdr(raw.cdr as AnuraCdr);
  return fieldsFromCdr(payload as AnuraCdr);
}

function pickStr(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}

function pickNum(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value == null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Normaliza el JSON del webhook Anura al shape CDR (plantilla flexible). */
export function normalizeWebhookPayload(raw: Record<string, unknown>): AnuraCdr {
  const nested = raw.cdr && typeof raw.cdr === 'object'
    ? raw.cdr as Record<string, unknown>
    : raw;
  const accountRaw = nested.account;
  const accountObj = accountRaw && typeof accountRaw === 'object'
    ? accountRaw as Record<string, unknown>
    : null;
  const accountName = pickStr(nested, 'accountName', 'account_name', 'agentName', 'agent')
    || (accountObj ? pickStr(accountObj, 'name') : undefined);
  const accountId = accountObj ? pickNum(accountObj, 'id') : pickNum(nested, 'accountId', 'account_id');
  let id = pickNum(nested, 'id', 'cdrId', 'cdr_id', 'callId', 'call_id');
  const calling = pickStr(nested, 'calling', 'origin', 'from', 'caller');
  const called = pickStr(nested, 'called', 'destination', 'to', 'callee');
  const dialTime = pickNum(nested, 'dialTime', 'dial_time', 'startedAt', 'start', 'timestamp');
  if (id == null) {
    // Sin id de CDR: huella estable para no duplicar el mismo END.
    const stamp = [dialTime ?? Date.now(), calling ?? '', called ?? ''].join('|');
    id = Math.abs([...stamp].reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) | 0, 0));
  }
  return {
    id,
    direction: pickStr(nested, 'direction', 'dir'),
    status: pickStr(nested, 'status', 'disposition', 'state'),
    calling,
    called,
    callingName: pickStr(nested, 'callingName', 'calling_name'),
    calledName: pickStr(nested, 'calledName', 'called_name'),
    dialTime,
    duration: pickNum(nested, 'duration'),
    billSeconds: pickNum(nested, 'billSeconds', 'bill_seconds', 'talkTime', 'talk_seconds'),
    wasRecorded: nested.wasRecorded === true || nested.wasRecorded === 'true',
    lastAction: pickStr(nested, 'lastAction', 'last_action') ?? null,
    routePriceTypeName: pickStr(nested, 'routePriceTypeName', 'route') ?? null,
    price: pickNum(nested, 'price'),
    account: accountName || accountId != null
      ? { id: accountId, name: accountName ?? null }
      : null,
  };
}

function personLabel(person: { name?: string | null; lastName?: string | null } | null | undefined): string | null {
  if (!person) return null;
  const label = [person.name, person.lastName].filter(Boolean).join(' ').trim();
  return label || null;
}

function resultPhrase(result: string): string {
  if (result === 'reached') return 'contestó';
  if (result === 'no_answer') return 'no contestó';
  if (result === 'attempted') return 'no se completó';
  if (result === 'left_voicemail') return 'dejó buzón';
  if (result === 'bounced') return 'rebotó';
  return result;
}

/** Ej.: "Juanita llamó a Pepito (+5193…) · contestó · 44 s" */
export function humanAnuraSummary(input: {
  direction: string;
  result: string;
  contactName: string | null;
  phone: string | null;
  agentName: string | null;
  durationSeconds: number | null;
}): string {
  const who = input.contactName || 'un contacto';
  const phone = input.phone ? ` (${input.phone})` : '';
  const agent = input.agentName || 'un asesor';
  const dur = input.durationSeconds != null ? ` · ${input.durationSeconds} s` : '';
  const outcome = resultPhrase(input.result);
  if (input.direction === 'inbound') {
    return `${who}${phone} llamó · atendió ${agent} · ${outcome}${dur}`;
  }
  return `${agent} llamó a ${who}${phone} · ${outcome}${dur}`;
}

@Injectable()
export class AnuraIngestService {
  private readonly logger = new Logger(AnuraIngestService.name);
  private running = false;

  constructor(
    private readonly anura: AnuraClientService,
    private readonly prisma: PrismaService,
    private readonly wa: WhatsappCrmClientService,
  ) {}

  status() {
    return {
      enabled: this.anura.enabled,
      webhookConfigured: Boolean(process.env.ANURA_WEBHOOK_SECRET?.trim()),
      running: this.running,
      apiBase: process.env.ANURA_API_BASE ?? 'https://api.anura.com.pe',
    };
  }

  /**
   * Webhook Anura → actividad. No usa refresh/API poll: Anura empuja el JSON.
   * Persistimos END (o body sin hook). START/TALK se aceptan pero no escriben fila.
   */
  async ingestWebhook(raw: Record<string, unknown>) {
    const hook = String(raw.hook ?? raw.event ?? raw.trigger ?? 'END').trim().toUpperCase();
    if (hook === 'START' || hook === 'TALK') {
      return { accepted: true as const, stored: false as const, reason: 'ignored_non_end' as const, hook };
    }
    const cdr = normalizeWebhookPayload(raw);
    const externalRef = String(cdr.id ?? '').trim();
    if (!externalRef) {
      return { accepted: true as const, stored: false as const, reason: 'missing_id' as const, hook };
    }
    const result = await this.persistCdr(cdr, {
      ...raw,
      _source: 'webhook',
      _hook: hook,
    });
    return { accepted: true as const, hook, ...result };
  }

  /**
   * Backfill histórico por API (poll). Luego el webhook completa en tiempo real.
   * `limit` = tope de CDRs a recorrer (default 2000 cubre un día típico).
   * Guarda también sin match de ciclo (waCycleId null) para armar la tabla completa.
   */
  async importHours(hours = 24, limit = 2000) {
    if (!this.anura.enabled) {
      throw new BadRequestException('Anura no configurado (ANURA_REFRESH_TOKEN o client credentials)');
    }
    if (this.running) return { started: false, reason: 'already_running' as const };
    this.running = true;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - Math.max(1, hours) * 3600_000);
      const cdrs = await this.anura.listCdrs({ start, end });
      const sorted = [...cdrs].sort((a, b) => (b.dialTime ?? 0) - (a.dialTime ?? 0));
      const cap = Math.min(Math.max(1, limit), 5000);
      let created = 0;
      let skipped = 0;
      let unmatched = 0;
      let noPhone = 0;
      const items: Array<{ externalRef: string; waCycleId: number | null; result: string }> = [];

      for (const cdr of sorted.slice(0, cap)) {
        const outcome = await this.persistCdr(cdr, { ...cdr, _source: 'import' }, { requireMatch: false });
        if (outcome.stored) {
          created += 1;
          if (!outcome.waCycleId) unmatched += 1;
          items.push({
            externalRef: outcome.externalRef!,
            waCycleId: outcome.waCycleId ?? null,
            result: outcome.result!,
          });
        } else if (outcome.reason === 'duplicate' || outcome.reason === 'missing_id') {
          skipped += 1;
        } else if (outcome.reason === 'no_phone') {
          noPhone += 1;
        } else {
          unmatched += 1;
        }
      }

      this.logger.log(
        `Anura import ${hours}h: created=${created} skipped=${skipped} unmatched=${unmatched} noPhone=${noPhone} cdrs=${cdrs.length} cap=${cap}`,
      );
      return {
        started: true as const,
        hours,
        cdrs: cdrs.length,
        processed: Math.min(cdrs.length, cap),
        created,
        skipped,
        unmatched,
        noPhone,
        items: items.slice(0, 40),
      };
    } finally {
      this.running = false;
    }
  }

  private async persistCdr(
    cdr: AnuraCdr,
    payload: object,
    opts: { requireMatch?: boolean } = {},
  ): Promise<{
    stored: boolean;
    reason?: 'missing_id' | 'duplicate' | 'no_phone' | 'unmatched';
    id?: string;
    externalRef?: string;
    waCycleId?: number | null;
    result?: string;
  }> {
    const requireMatch = opts.requireMatch === true;
    const externalRef = String(cdr.id ?? '').trim();
    if (!externalRef) return { stored: false, reason: 'missing_id' };

    const existing = await this.prisma.educacionCrmActivity.findFirst({
      where: { externalSystem: 'anura', externalRef },
      select: { id: true },
    });
    if (existing) return { stored: false, reason: 'duplicate', id: existing.id, externalRef };

    const phone = partyPhone(cdr);
    if (!phone) return { stored: false, reason: 'no_phone', externalRef };

    const match = await this.matchWaCycle(phone);
    if (!match && requireMatch) return { stored: false, reason: 'unmatched', externalRef };

    const result = mapResult(cdr.status);
    const created = await this.prisma.educacionCrmActivity.create({
      data: {
        waCycleId: match?.waCycleId ?? null,
        waContactId: match?.waContactId ?? null,
        opportunityId: match?.opportunityId ?? null,
        channel: 'call',
        direction: String(cdr.direction ?? '').toUpperCase() === 'IN' ? 'inbound' : 'outbound',
        occurredAt: new Date(cdr.dialTime ?? Date.now()),
        result,
        notes: anuraCdrNote(cdr),
        payload: payload as object,
        externalRef,
        externalSystem: 'anura',
      },
    });
    return {
      stored: true,
      id: created.id,
      externalRef,
      waCycleId: match?.waCycleId ?? null,
      result,
    };
  }

  async listRecent(limit = 30) {
    const take = Math.min(100, Math.max(1, limit));
    const rows = await this.prisma.educacionCrmActivity.findMany({
      where: { externalSystem: 'anura' },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take,
      include: {
        opportunity: {
          include: {
            person: { select: { name: true, lastName: true, phone: true, waContactId: true } },
          },
        },
      },
    });

    const cycleIds = [...new Set(rows.map((row) => row.waCycleId).filter((id): id is number => id != null))];
    const contactIds = [...new Set(rows.map((row) => row.waContactId).filter((id): id is number => id != null))];
    const parsed = rows.map((row) => fieldsFromPayload(row.payload) ?? parseAnuraNote(row.notes));
    const notePhones = [...new Set(
      parsed.map((part) => part.phone).filter((phone): phone is string => Boolean(phone)),
    )];
    const phoneVariants = [...new Set(notePhones.flatMap((phone) => {
      const d = digits(phone);
      return [phone, d, d.startsWith('51') ? `+${d}` : `+51${d}`, d.startsWith('51') ? d.slice(2) : d];
    }))];

    const [byCycle, byContact, byPhone] = await Promise.all([
      cycleIds.length
        ? this.prisma.educacionOpportunity.findMany({
            where: { waCycleId: { in: cycleIds } },
            include: { person: { select: { name: true, lastName: true, phone: true } } },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      contactIds.length
        ? this.prisma.educacionPerson.findMany({
            where: { waContactId: { in: contactIds } },
            select: { name: true, lastName: true, phone: true, waContactId: true },
          })
        : Promise.resolve([]),
      phoneVariants.length
        ? this.prisma.educacionPerson.findMany({
            where: { phone: { in: phoneVariants } },
            select: { name: true, lastName: true, phone: true },
          })
        : Promise.resolve([]),
    ]);

    const personByCycle = new Map<number, { name: string | null; phone: string | null }>();
    for (const opp of byCycle) {
      if (opp.waCycleId == null || personByCycle.has(opp.waCycleId)) continue;
      personByCycle.set(opp.waCycleId, {
        name: personLabel(opp.person),
        phone: opp.person.phone ? formatPhoneDisplay(opp.person.phone) : null,
      });
    }
    const personByContact = new Map(
      byContact.map((person) => [person.waContactId!, {
        name: personLabel(person),
        phone: person.phone ? formatPhoneDisplay(person.phone) : null,
      }]),
    );
    const personByPhoneDigits = new Map<string, { name: string | null; phone: string | null }>();
    for (const person of byPhone) {
      const key = digits(person.phone).slice(-9);
      if (!key || personByPhoneDigits.has(key)) continue;
      personByPhoneDigits.set(key, {
        name: personLabel(person),
        phone: person.phone ? formatPhoneDisplay(person.phone) : null,
      });
    }

    const missingPhones = notePhones
      .map((phone) => digits(phone).slice(-9))
      .filter((key) => key && !personByPhoneDigits.has(key));
    if (missingPhones.length && this.wa.configured) {
      try {
        const unique = [...new Set(missingPhones)].slice(0, 10);
        await Promise.all(unique.map(async (tail) => {
          const contacts = await this.wa.fetchEducationContacts({ q: tail, page: 1, limit: 10 });
          const hit = contacts.items.find((row) => digits(row.phone).endsWith(tail) || tail.endsWith(digits(row.phone).slice(-9)));
          if (!hit) return;
          const name = [hit.name, hit.last_name].filter(Boolean).join(' ').trim() || null;
          personByPhoneDigits.set(tail, {
            name,
            phone: formatPhoneDisplay(hit.phone),
          });
        }));
      } catch (err) {
        this.logger.warn(`Anura enrich WA falló: ${err instanceof Error ? err.message : err}`);
      }
    }

    return rows.map((row, index) => {
      const fromNote = parsed[index];
      const fromOpp = row.opportunity?.person
        ? {
            name: personLabel(row.opportunity.person),
            phone: row.opportunity.person.phone
              ? formatPhoneDisplay(row.opportunity.person.phone)
              : null,
          }
        : null;
      const fromCycle = row.waCycleId != null ? personByCycle.get(row.waCycleId) : null;
      const fromContact = row.waContactId != null ? personByContact.get(row.waContactId) : null;
      const fromPhone = fromNote.phone
        ? personByPhoneDigits.get(digits(fromNote.phone).slice(-9))
        : null;
      const contactName = fromOpp?.name || fromCycle?.name || fromContact?.name || fromPhone?.name || null;
      const phone = fromOpp?.phone || fromCycle?.phone || fromContact?.phone
        || fromNote.phone || fromPhone?.phone || null;
      const agentName = fromNote.agentName;
      const durationSeconds = fromNote.durationSeconds;
      return {
        id: row.id,
        channel: row.channel,
        direction: row.direction,
        result: row.result,
        occurredAt: row.occurredAt,
        notes: row.notes,
        payload: row.payload,
        waCycleId: row.waCycleId,
        externalRef: row.externalRef,
        externalSystem: row.externalSystem,
        contactName,
        phone,
        agentName,
        agentRaw: fromNote.agentRaw,
        extension: fromNote.extension,
        durationSeconds,
        talkSeconds: fromNote.talkSeconds,
        summary: humanAnuraSummary({
          direction: row.direction,
          result: row.result,
          contactName,
          phone,
          agentName,
          durationSeconds,
        }),
      };
    });
  }

  private async matchWaCycle(phoneDigits: string): Promise<{
    waCycleId: number;
    waContactId: number | null;
    opportunityId: string | null;
  } | null> {
    const variants = [
      phoneDigits,
      `+${phoneDigits}`,
      phoneDigits.startsWith('51') ? phoneDigits.slice(2) : phoneDigits,
    ];
    const person = await this.prisma.educacionPerson.findFirst({
      where: { phone: { in: variants } },
      include: {
        opportunities: {
          where: { closedAt: null },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
    });
    const opportunity = person?.opportunities[0] ?? null;
    if (opportunity?.waCycleId) {
      return {
        waCycleId: opportunity.waCycleId,
        waContactId: opportunity.waContactId ?? person?.waContactId ?? null,
        opportunityId: opportunity.id,
      };
    }

    if (!this.wa.configured) return null;

    try {
      const contacts = await this.wa.fetchEducationContacts({
        q: phoneDigits.slice(-9),
        page: 1,
        limit: 20,
      });
      const hit = contacts.items.find((row) => {
        const d = digits(row.phone);
        return d === phoneDigits
          || d.endsWith(phoneDigits.slice(-9))
          || phoneDigits.endsWith(d.slice(-9));
      });
      const cycleId = hit?.lead_id;
      if (!cycleId) return null;
      return {
        waCycleId: cycleId,
        waContactId: hit?.contact_id ?? null,
        opportunityId: opportunity?.id ?? null,
      };
    } catch (err) {
      this.logger.warn(`Anura match WA falló: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
