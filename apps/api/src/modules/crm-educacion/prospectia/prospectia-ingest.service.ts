import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  ProspectiaClientService,
  type ProspectiaContact,
} from './prospectia-client.service';
import { enrichFromProspectiaConversation } from './prospectia-mapping';

const CURSOR_ID = 'default';
const CHANNEL = 'prospectia';
const PAGE_DELAY_MS = 600;
const MAX_PAGES_PER_RUN = 20;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ProspectiaIngestService {
  private readonly logger = new Logger(ProspectiaIngestService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly prospectia: ProspectiaClientService,
  ) {}

  async status() {
    const cursor = await this.ensureCursor();
    return {
      enabled: this.prospectia.enabled,
      running: this.running || cursor.lastRunStatus === 'running',
      lastPolledAt: cursor.lastPolledAt?.toISOString() ?? null,
      lastPage: cursor.lastPage,
      lastSeenExternalId: cursor.lastSeenExternalId,
      lastRunStatus: cursor.lastRunStatus,
      lastRunAt: cursor.lastRunAt?.toISOString() ?? null,
      lastError: cursor.lastError,
      processedTotal: cursor.processedTotal,
      lastRunCreated: cursor.lastRunCreated,
      lastRunUpdated: cursor.lastRunUpdated,
      lastRunSkipped: cursor.lastRunSkipped,
    };
  }

  /** Cron cada 10 min (Lima). Sin token no corre. */
  @Cron('0 */10 * * * *', { timeZone: 'America/Lima' })
  async cronIngest() {
    if (!this.prospectia.enabled) return;
    await this.run({ mode: 'incremental', maxPages: MAX_PAGES_PER_RUN });
  }

  async start(opts?: { mode?: 'incremental' | 'backfill'; maxPages?: number }) {
    if (!this.prospectia.enabled) {
      return { started: false, reason: 'no_token' as const };
    }
    if (this.running) {
      return { started: false, reason: 'already_running' as const };
    }
    void this.run({
      mode: opts?.mode ?? 'incremental',
      maxPages: opts?.maxPages ?? MAX_PAGES_PER_RUN,
    });
    return { started: true as const };
  }

  async run(opts: { mode: 'incremental' | 'backfill'; maxPages: number }) {
    if (this.running) return;
    this.running = true;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    try {
      await this.prisma.educacionProspectiaCursor.upsert({
        where: { id: CURSOR_ID },
        create: {
          id: CURSOR_ID,
          lastRunStatus: 'running',
          lastRunAt: new Date(),
          lastError: null,
        },
        update: {
          lastRunStatus: 'running',
          lastRunAt: new Date(),
          lastError: null,
          lastRunCreated: 0,
          lastRunUpdated: 0,
          lastRunSkipped: 0,
        },
      });

      const cursor = await this.ensureCursor();
      let page =
        opts.mode === 'backfill'
          ? 1
          : Math.max(1, cursor.lastPage || 1);
      let pagesDone = 0;
      let lastSeen: string | null = cursor.lastSeenExternalId;

      while (pagesDone < opts.maxPages) {
        const listed = await this.prospectia.listContactsPage(page);
        if (!listed.contacts.length) break;

        for (const contact of listed.contacts) {
          const result = await this.upsertFromProspectiaContact(contact);
          if (result === 'created') created += 1;
          else if (result === 'updated') updated += 1;
          else skipped += 1;
          if (contact.id) lastSeen = String(contact.id);
          await sleep(PAGE_DELAY_MS);
        }

        pagesDone += 1;
        const nextPage = page + 1;
        await this.prisma.educacionProspectiaCursor.update({
          where: { id: CURSOR_ID },
          data: {
            lastPage: listed.hasMore ? nextPage : page,
            lastSeenExternalId: lastSeen,
            lastPolledAt: new Date(),
            lastRunCreated: created,
            lastRunUpdated: updated,
            lastRunSkipped: skipped,
            processedTotal: { increment: listed.contacts.length },
          },
        });

        if (!listed.hasMore) break;
        page = nextPage;
      }

      await this.prisma.educacionProspectiaCursor.update({
        where: { id: CURSOR_ID },
        data: {
          lastRunStatus: 'ok',
          lastRunAt: new Date(),
          lastError: null,
          lastRunCreated: created,
          lastRunUpdated: updated,
          lastRunSkipped: skipped,
        },
      });
      this.logger.log(
        `Prospectia ingest ${opts.mode}: created=${created} updated=${updated} skipped=${skipped}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Prospectia ingest falló: ${message}`);
      await this.prisma.educacionProspectiaCursor.update({
        where: { id: CURSOR_ID },
        data: {
          lastRunStatus: 'error',
          lastRunAt: new Date(),
          lastError: message.slice(0, 500),
          lastRunCreated: created,
          lastRunUpdated: updated,
          lastRunSkipped: skipped,
        },
      }).catch(() => undefined);
    } finally {
      this.running = false;
    }
  }

  async upsertFromProspectiaContact(
    contact: ProspectiaContact,
    extras?: { advisorEmail?: string | null; category?: string },
  ): Promise<'created' | 'updated' | 'skipped'> {
    if (!contact?.id) return 'skipped';
    const phone = contact.phone_number
      ? this.prospectia.normalizePhone(contact.phone_number)
      : null;
    const email = contact.email?.trim().toLowerCase() || null;
    if (!phone && !email) return 'skipped';

    const { name, lastName } = this.prospectia.splitName(contact.name);
    const conversation = await this.prospectia.primaryConversation(contact.id);
    const enrichment = {
      ...enrichFromProspectiaConversation({
        labels: conversation?.labels ?? contact.labels ?? [],
        customAttributes: conversation?.custom_attributes ?? null,
        contactAttributes: contact.custom_attributes ?? null,
        contactLeadScore: contact.last_lead_scoring ?? null,
        assigneeEmail:
          extras?.advisorEmail !== undefined
            ? extras.advisorEmail
            : conversation?.meta?.assignee?.email ?? null,
        teamName: conversation?.meta?.team?.name ?? null,
      }),
    };
    if (extras?.category === 'ca' || extras?.category === 'ep' || extras?.category === 'general') {
      enrichment.category = extras.category;
    }
    const externalId = String(contact.id);
    const lastInteractionAt = contact.last_activity_at
      ? new Date(contact.last_activity_at * 1000)
      : contact.created_at
        ? new Date(contact.created_at * 1000)
        : new Date();

    const payload = {
      contact,
      conversation: conversation
        ? {
            id: conversation.id,
            status: conversation.status,
            inbox_id: conversation.inbox_id,
            labels: conversation.labels,
            custom_attributes: conversation.custom_attributes,
            additional_attributes: conversation.additional_attributes,
            meta: conversation.meta,
            last_activity_at: conversation.last_activity_at,
            created_at: conversation.created_at,
          }
        : null,
      enrichment,
    } as unknown as Prisma.InputJsonValue;

    const existing = await this.prisma.educacionOpportunity.findUnique({
      where: { channel_externalId: { channel: CHANNEL, externalId } },
      include: { person: true },
    });

    const opportunityData = {
      category: enrichment.category,
      stageSlug: enrichment.stageSlug,
      advisorEmail: enrichment.advisorEmail,
      prospectiaStatus: enrichment.prospectiaStatus,
      interestCourse: enrichment.interestCourse,
      leadScore: enrichment.leadScore,
      lastInteractionAt,
      sourceLabel: enrichment.interestCourse
        ? `Prospectia · ${enrichment.interestCourse}`
        : 'Prospectia',
      payload,
    };

    if (existing) {
      await this.prisma.educacionPerson.update({
        where: { id: existing.personId },
        data: {
          phone: phone ?? existing.person.phone,
          email: email ?? existing.person.email,
          name: name ?? existing.person.name,
          lastName: lastName ?? existing.person.lastName,
        },
      });
      await this.prisma.educacionOpportunity.update({
        where: { id: existing.id },
        data: opportunityData,
      });
      return 'updated';
    }

    const person = await this.findOrCreatePerson({ phone, email, name, lastName });
    await this.prisma.educacionOpportunity.create({
      data: {
        personId: person.id,
        channel: CHANNEL,
        externalId,
        cameWithInbound: false,
        ...opportunityData,
      },
    });
    return 'created';
  }

  /** Alta asistida: lookup por teléfono/username y crear oportunidad nativa. */
  async importByLookup(input: {
    phone?: string;
    username?: string;
    whatsapp_user_id?: string;
    category?: 'ca' | 'ep' | 'general';
    name?: string;
    lastName?: string;
    email?: string;
  }) {
    const result = await this.prospectia.lookup({
      key: 'manual-import',
      phone: input.phone,
      username: input.username,
      whatsapp_user_id: input.whatsapp_user_id,
    });
    if (result.match !== 'exists' || !result.contact?.id) {
      return {
        ok: false as const,
        match: result.match,
        opportunity: null,
      };
    }
    const contact: ProspectiaContact = {
      ...result.contact,
      name: input.name || result.contact.name,
      email: input.email || result.contact.email,
      phone_number: input.phone || result.contact.phone_number,
    };
    await this.upsertFromProspectiaContact(contact, {
      advisorEmail: result.advisorEmail,
      category: input.category ?? 'general',
    });
    const opportunity = await this.prisma.educacionOpportunity.findUnique({
      where: {
        channel_externalId: {
          channel: CHANNEL,
          externalId: String(result.contact.id),
        },
      },
      include: { person: true },
    });
    return { ok: true as const, match: result.match, opportunity };
  }

  private async findOrCreatePerson(input: {
    phone: string | null;
    email: string | null;
    name: string | null;
    lastName: string | null;
  }) {
    if (input.phone) {
      const byPhone = await this.prisma.educacionPerson.findFirst({
        where: { phone: input.phone },
      });
      if (byPhone) {
        return this.prisma.educacionPerson.update({
          where: { id: byPhone.id },
          data: {
            email: input.email ?? byPhone.email,
            name: input.name ?? byPhone.name,
            lastName: input.lastName ?? byPhone.lastName,
          },
        });
      }
    }
    if (input.email) {
      const byEmail = await this.prisma.educacionPerson.findFirst({
        where: { email: input.email },
      });
      if (byEmail) {
        return this.prisma.educacionPerson.update({
          where: { id: byEmail.id },
          data: {
            phone: input.phone ?? byEmail.phone,
            name: input.name ?? byEmail.name,
            lastName: input.lastName ?? byEmail.lastName,
          },
        });
      }
    }
    return this.prisma.educacionPerson.create({
      data: {
        phone: input.phone,
        email: input.email,
        name: input.name,
        lastName: input.lastName,
      },
    });
  }

  private async ensureCursor() {
    return this.prisma.educacionProspectiaCursor.upsert({
      where: { id: CURSOR_ID },
      create: { id: CURSOR_ID },
      update: {},
    });
  }
}
