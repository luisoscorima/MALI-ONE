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
      running: this.running,
      apiBase: process.env.ANURA_API_BASE ?? 'https://api.anura.com.pe',
    };
  }

  async importHours(hours = 24, limit = 50) {
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
      let created = 0;
      let skipped = 0;
      let unmatched = 0;
      const items: Array<{ externalRef: string; waCycleId: number; result: string }> = [];

      for (const cdr of sorted) {
        if (items.length >= limit) break;
        const externalRef = String(cdr.id ?? '');
        if (!externalRef) {
          skipped += 1;
          continue;
        }
        const existing = await this.prisma.educacionCrmActivity.findFirst({
          where: { externalSystem: 'anura', externalRef },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        const phone = partyPhone(cdr);
        if (!phone) {
          unmatched += 1;
          continue;
        }
        const match = await this.matchWaCycle(phone);
        if (!match) {
          unmatched += 1;
          continue;
        }
        const occurredAt = new Date(cdr.dialTime ?? Date.now());
        const account = cdr.account?.name ?? 'Anura';
        const notes = [
          `Anura CDR ${externalRef}`,
          cdr.direction,
          cdr.status,
          `${cdr.calling ?? ''}→${cdr.called ?? ''}`,
          account,
          cdr.duration != null ? `${cdr.duration}s` : null,
        ].filter(Boolean).join(' · ').slice(0, 2000);

        await this.prisma.educacionCrmActivity.create({
          data: {
            waCycleId: match.waCycleId,
            waContactId: match.waContactId,
            opportunityId: match.opportunityId,
            channel: 'call',
            direction: String(cdr.direction ?? '').toUpperCase() === 'IN' ? 'inbound' : 'outbound',
            occurredAt,
            result: mapResult(cdr.status),
            notes,
            externalRef,
            externalSystem: 'anura',
          },
        });
        created += 1;
        items.push({
          externalRef,
          waCycleId: match.waCycleId,
          result: mapResult(cdr.status),
        });
      }

      this.logger.log(
        `Anura import ${hours}h: created=${created} skipped=${skipped} unmatched=${unmatched} cdrs=${cdrs.length}`,
      );
      return {
        started: true as const,
        hours,
        cdrs: cdrs.length,
        created,
        skipped,
        unmatched,
        items,
      };
    } finally {
      this.running = false;
    }
  }

  listRecent(limit = 30) {
    return this.prisma.educacionCrmActivity.findMany({
      where: { externalSystem: 'anura' },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(100, Math.max(1, limit)),
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
