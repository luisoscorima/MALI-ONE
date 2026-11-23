import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  EmailCampaignStatus,
  MalichimpContactStatus,
  MalichimpSuppressionReason,
  NewsletterStatus,
  Prisma,
  type MalichimpImportJob,
} from '@prisma/client';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import {
  applyMalichimpFiles,
  inspectMalichimpFiles,
  locateMalichimpFiles,
} from './lib/malichimp-import-runner';
import { extractMailchimpZip } from './lib/mailchimp-zip';
import {
  fingerprintBuffer,
  newPreviewId,
  PREVIEW_TTL_MS,
  readXlsxPreview,
  readZipPreview,
  removePreviewDirectory,
  writeXlsxPreview,
  writeZipPreview,
  xlsxPreviewDirectory,
  ZIP_PREVIEW_PREFIX,
  zipPreviewDirectory,
  type StoredXlsxPreview,
  type StoredZipPreview,
} from './lib/malichimp-preview-store';
import {
  MAX_XLSX_BYTES,
  parseMalichimpContactsXlsx,
  type MalichimpXlsxContactRow,
} from './lib/malichimp-xlsx-import';
import { MalichimpContactsQueryDto } from './dto/malichimp-query.dto';
import {
  CreateMalichimpCampaignDto,
  CreateMalichimpNewsletterDraftDto,
  MalichimpAudienceDto,
  MalichimpCampaignSendsQueryDto,
  UpdateMalichimpContactDto,
  type MalichimpCampaignSendEvent,
} from './dto/malichimp-campaign.dto';
import { NewslettersService } from '../newsletters/newsletters.service';
import {
  buildTreasuryXlsx,
  limaStamp,
} from '../treasury/treasury-xlsx';

type AudienceRecipient = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

const MALI_PE_EMAIL = /^[^@\s]+@mali\.pe$/i;

function duplicateLabel(value: string, maxLength: number): string {
  const suffix = ' — copia';
  return `${value.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
}

function duplicateNewsletterSlug(value: string): string {
  const suffix = `copia-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const base = value
    .slice(0, 80 - suffix.length - 1)
    .replace(/-+$/g, '');
  return `${base}-${suffix}`;
}

function newsletterSlugFromTitle(title: string): string {
  const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80 - suffix.length - 1) || 'boletin';
  return `${base}-${suffix}`;
}

const NEW_NEWSLETTER_PLACEHOLDER_HTML =
  '<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#444">Edita este boletín en <strong>Boletines</strong> antes de enviar la campaña.</p>';

function isBlockedContactStatus(status: MalichimpContactStatus): boolean {
  return (
    status === MalichimpContactStatus.unsubscribed ||
    status === MalichimpContactStatus.cleaned ||
    status === MalichimpContactStatus.nonsubscribed
  );
}

@Injectable()
export class MalichimpService implements OnModuleInit {
  private readonly logger = new Logger(MalichimpService.name);
  private readonly previews = new Map<string, StoredZipPreview>();
  private readonly xlsxPreviews = new Map<string, StoredXlsxPreview>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly emailSenders: EmailSenderService,
    private readonly newsletters: NewslettersService,
  ) {}

  async onModuleInit() {
    void this.cleanupOrphanDirectories();
    await this.prisma.malichimpImportJob.updateMany({
      where: { status: { in: ['queued', 'running'] } },
      data: {
        status: 'failed',
        error: 'La API se reinició durante la importación. Verifica la audiencia antes de volver a importar.',
        completedAt: new Date(),
        processed: 0,
      },
    });
  }

  async stats() {
    const [
      statuses,
      suppressions,
      tags,
      groups,
      groupOptions,
      lastImport,
      eligible,
    ] = await Promise.all([
      this.prisma.malichimpContact.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(DISTINCT email) AS count
        FROM (
          SELECT "email" AS email FROM "MalichimpSuppression"
          UNION ALL
          SELECT "email" AS email FROM "EmailGlobalSuppression"
        ) suppressions
      `),
      this.prisma.malichimpTag.count(),
      this.prisma.malichimpGroup.count(),
      this.prisma.malichimpGroupOption.count(),
      this.prisma.malichimpImportRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          sourceKey: true,
          fileFingerprint: true,
          counts: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM "MalichimpContact" contact
        WHERE contact."status" = 'subscribed'::"MalichimpContactStatus"
          AND NOT EXISTS (
            SELECT 1 FROM "MalichimpSuppression" suppression
            WHERE suppression."email" = contact."email"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "EmailGlobalSuppression" suppression
            WHERE suppression."email" = contact."email"
          )
      `),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(MalichimpContactStatus).map((status) => [status, 0]),
    ) as Record<MalichimpContactStatus, number>;
    for (const row of statuses) byStatus[row.status] = row._count._all;

    return {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      eligible: Number(eligible[0].count),
      byStatus,
      suppressions: Number(suppressions[0].count),
      tags,
      groups,
      groupOptions,
      delivery: this.emailDelivery.status,
      lastImport,
    };
  }

  async listContacts(query: MalichimpContactsQueryDto) {
    const q = query.q?.trim();
    const groupOptionId = query.groupOptionId?.trim();
    const tagId = query.tagId?.trim();
    const where: Prisma.MalichimpContactWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(groupOptionId
        ? { groupOptions: { some: { optionId: groupOptionId } } }
        : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { institutionName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.malichimpContact.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { email: 'asc' }],
        skip,
        take: query.pageSize,
        include: {
          tags: {
            select: { tag: { select: { id: true, name: true, normalizedName: true } } },
            orderBy: { tag: { name: 'asc' } },
          },
          groupOptions: {
            select: {
              option: {
                select: {
                  id: true,
                  name: true,
                  normalizedName: true,
                  group: {
                    select: {
                      id: true,
                      name: true,
                      normalizedName: true,
                      sortOrder: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.malichimpContact.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapContact(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  private mapContact(item: {
    tags: Array<{ tag: { id: string; name: string; normalizedName: string } }>;
    groupOptions: Array<{
      option: {
        id: string;
        name: string;
        normalizedName: string;
        group: {
          id: string;
          name: string;
          normalizedName: string;
          sortOrder: number;
        };
      };
    }>;
    [key: string]: unknown;
  }) {
    const { tags, groupOptions, ...contact } = item;
    return {
      ...contact,
      tags: tags.map((entry) => entry.tag),
      groupOptions: groupOptions
        .map((entry) => entry.option)
        .sort((left, right) =>
          left.group.sortOrder - right.group.sortOrder ||
          left.name.localeCompare(right.name, 'es-PE'))
        .map(({ group, ...option }) => ({
          ...option,
          group: {
            id: group.id,
            name: group.name,
            normalizedName: group.normalizedName,
          },
        })),
    };
  }

  async updateContact(id: string, dto: UpdateMalichimpContactDto) {
    const contact = await this.prisma.malichimpContact.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!contact) throw new NotFoundException('Contacto no encontrado');

    const clean = (value: string | null | undefined, max: number) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, max) : null;
    };

    if (dto.groupOptionIds) {
      const options = await this.prisma.malichimpGroupOption.findMany({
        where: { id: { in: dto.groupOptionIds } },
        select: { id: true },
      });
      if (options.length !== dto.groupOptionIds.length) {
        throw new BadRequestException('Una o más opciones de grupo no existen');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.malichimpContact.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined
            ? { firstName: clean(dto.firstName, 120) }
            : {}),
          ...(dto.lastName !== undefined
            ? { lastName: clean(dto.lastName, 120) }
            : {}),
          ...(dto.phone !== undefined ? { phone: clean(dto.phone, 40) } : {}),
          ...(dto.institutionName !== undefined
            ? { institutionName: clean(dto.institutionName, 200) }
            : {}),
          ...(dto.jobTitle !== undefined
            ? { jobTitle: clean(dto.jobTitle, 160) }
            : {}),
          ...(dto.city !== undefined ? { city: clean(dto.city, 120) } : {}),
          ...(dto.country !== undefined
            ? { country: clean(dto.country, 120) }
            : {}),
          ...(dto.classification !== undefined
            ? { classification: clean(dto.classification, 120) }
            : {}),
        },
      });

      if (dto.groupOptionIds) {
        await tx.malichimpContactGroupOption.deleteMany({
          where: { contactId: id },
        });
        if (dto.groupOptionIds.length) {
          await tx.malichimpContactGroupOption.createMany({
            data: dto.groupOptionIds.map((optionId) => ({
              contactId: id,
              optionId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await this.prisma.malichimpContact.findUniqueOrThrow({
      where: { id },
      include: {
        tags: {
          select: { tag: { select: { id: true, name: true, normalizedName: true } } },
          orderBy: { tag: { name: 'asc' } },
        },
        groupOptions: {
          select: {
            option: {
              select: {
                id: true,
                name: true,
                normalizedName: true,
                group: {
                  select: {
                    id: true,
                    name: true,
                    normalizedName: true,
                    sortOrder: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return this.mapContact(updated);
  }

  async listTags() {
    const tags = await this.prisma.malichimpTag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { contacts: true } } },
    });
    return tags.map(({ _count, ...tag }) => ({ ...tag, contacts: _count.contacts }));
  }

  async listGroups() {
    const eligibleMembership = Prisma.sql`
      contact."status" = 'subscribed'::"MalichimpContactStatus"
      AND NOT EXISTS (
        SELECT 1 FROM "MalichimpSuppression" suppression
        WHERE suppression."email" = contact."email"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "EmailGlobalSuppression" suppression
        WHERE suppression."email" = contact."email"
      )
    `;
    const [groups, groupCounts, optionCounts] = await Promise.all([
      this.prisma.malichimpGroup.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          options: {
            orderBy: { name: 'asc' },
          },
        },
      }),
      this.prisma.$queryRaw<Array<{ groupId: string; contacts: bigint }>>(Prisma.sql`
        SELECT option."groupId" AS "groupId", COUNT(DISTINCT membership."contactId") AS contacts
        FROM "MalichimpContactGroupOption" membership
        JOIN "MalichimpGroupOption" option ON option."id" = membership."optionId"
        JOIN "MalichimpContact" contact ON contact."id" = membership."contactId"
        WHERE ${eligibleMembership}
        GROUP BY option."groupId"
      `),
      this.prisma.$queryRaw<Array<{ optionId: string; contacts: bigint }>>(Prisma.sql`
        SELECT membership."optionId" AS "optionId", COUNT(DISTINCT membership."contactId") AS contacts
        FROM "MalichimpContactGroupOption" membership
        JOIN "MalichimpContact" contact ON contact."id" = membership."contactId"
        WHERE ${eligibleMembership}
        GROUP BY membership."optionId"
      `),
    ]);
    const contactsByGroup = new Map(
      groupCounts.map((row) => [row.groupId, Number(row.contacts)]),
    );
    const contactsByOption = new Map(
      optionCounts.map((row) => [row.optionId, Number(row.contacts)]),
    );
    return groups.map(({ options, ...group }) => ({
      ...group,
      contacts: contactsByGroup.get(group.id) ?? 0,
      options: options.map((option) => ({
        ...option,
        contacts: contactsByOption.get(option.id) ?? 0,
      })),
    }));
  }

  listPublishedNewsletters() {
    return this.newsletters.listPublished();
  }

  async getCampaignNewsletter(id: string) {
    const newsletter = await this.prisma.newsletter.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        subject: true,
        htmlBody: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!newsletter) throw new NotFoundException('Boletín no encontrado');
    return newsletter;
  }

  async createNewsletterDraft(userId: string, dto: CreateMalichimpNewsletterDraftDto) {
    const title = dto.title.trim();
    const subject = (dto.subject?.trim() || title).slice(0, 200);
    try {
      return await this.prisma.newsletter.create({
        data: {
          slug: newsletterSlugFromTitle(title),
          title,
          subject,
          htmlBody: NEW_NEWSLETTER_PLACEHOLDER_HTML,
          designJson: null,
          status: NewsletterStatus.draft,
          createdById: userId,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          subject: true,
          htmlBody: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('No se pudo crear el boletín; vuelve a intentarlo');
      }
      throw error;
    }
  }

  async previewAudience(dto: MalichimpAudienceDto) {
    const filters = await this.normalizeAudience(dto);
    const pageSize = Math.min(Math.max(Math.floor(dto.pageSize ?? 50) || 50, 1), 100);
    const page = Math.max(Math.floor(dto.page ?? 1) || 1, 1);
    const offset = (page - 1) * pageSize;
    const q = (dto.q ?? '').trim().slice(0, 160);
    const includedWhere = this.audienceWhere(filters.groupOptionIds, [], []);
    const baseWhere = this.audienceWhere(
      filters.groupOptionIds,
      filters.excludeGroupOptionIds,
      filters.excludeContactIds,
      filters.includeContactIds,
    );
    const searchWhere = this.audienceSearchWhere(q);
    const listedWhere = Prisma.sql`${baseWhere}${searchWhere}`;
    const [subscribed, included, eligible, matched, recipients] = await Promise.all([
      this.prisma.malichimpContact.count({
        where: { status: MalichimpContactStatus.subscribed },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM "MalichimpContact" contact WHERE ${includedWhere}
      `),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM "MalichimpContact" contact WHERE ${baseWhere}
      `),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM "MalichimpContact" contact WHERE ${listedWhere}
      `),
      this.prisma.$queryRaw<AudienceRecipient[]>(Prisma.sql`
        SELECT contact."id", contact."email", contact."firstName", contact."lastName"
        FROM "MalichimpContact" contact
        WHERE ${listedWhere}
        ORDER BY contact."lastName" NULLS LAST, contact."firstName" NULLS LAST, contact."email"
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
    ]);
    const includedTotal = Number(included[0].count);
    const eligibleTotal = Number(eligible[0].count);
    const matchedTotal = Number(matched[0].count);
    const totalPages = Math.max(1, Math.ceil(matchedTotal / pageSize));
    const mapped = recipients.map((contact) => ({
      id: contact.id,
      email: contact.email,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
    }));
    return {
      subscribed,
      included: includedTotal,
      eligible: eligibleTotal,
      excluded: Math.max(0, includedTotal - eligibleTotal),
      matched: matchedTotal,
      q,
      page,
      pageSize,
      totalPages,
      groupOptionIds: filters.groupOptionIds,
      excludeGroupOptionIds: filters.excludeGroupOptionIds,
      excludeContactIds: filters.excludeContactIds,
      includeContactIds: filters.includeContactIds,
      recipients: mapped,
      sample: mapped,
    };
  }

  async listCampaigns() {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      newsletterId: string;
      newsletterTitle: string;
      subject: string;
      status: EmailCampaignStatus;
      totalRecipients: number;
      sent: number;
      failed: number;
      suppressed: bigint;
      delivered: bigint;
      bounced: bigint;
      complaints: bigint;
      opened: bigint;
      clicked: bigint;
      replied: bigint;
      scheduledAt: Date | null;
      createdAt: Date;
      completedAt: Date | null;
      createdById: string | null;
      createdByName: string | null;
      createdByEmail: string | null;
    }>>(Prisma.sql`
      SELECT
        campaign."id",
        campaign."name",
        campaign."newsletterId",
        newsletter."title" AS "newsletterTitle",
        campaign."subjectSnapshot" AS "subject",
        campaign."status",
        campaign."totalRecipients",
        campaign."sentCount" AS "sent",
        campaign."errorCount" AS "failed",
        COUNT(send."id") FILTER (WHERE send."status" = 'suppressed'::"EmailSendStatus") AS "suppressed",
        COUNT(send."id") FILTER (WHERE send."deliveredAt" IS NOT NULL) AS "delivered",
        COUNT(send."id") FILTER (WHERE send."bouncedAt" IS NOT NULL) AS "bounced",
        COUNT(send."id") FILTER (WHERE send."complainedAt" IS NOT NULL) AS "complaints",
        COUNT(send."id") FILTER (WHERE send."openedAt" IS NOT NULL) AS "opened",
        COUNT(send."id") FILTER (WHERE send."clickedAt" IS NOT NULL) AS "clicked",
        COUNT(send."id") FILTER (WHERE send."repliedAt" IS NOT NULL) AS "replied",
        campaign."scheduledAt",
        campaign."createdAt",
        campaign."completedAt",
        campaign."createdById",
        creator."name" AS "createdByName",
        creator."email" AS "createdByEmail"
      FROM "EmailCampaign" campaign
      JOIN "Newsletter" newsletter ON newsletter."id" = campaign."newsletterId"
      LEFT JOIN "User" creator ON creator."id" = campaign."createdById"
      LEFT JOIN "EmailSend" send ON send."campaignId" = campaign."id"
      WHERE campaign."audienceArea" = 'malichimp'
      GROUP BY campaign."id", newsletter."title", creator."name", creator."email"
      ORDER BY campaign."createdAt" DESC
      LIMIT 200
    `);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      newsletterId: row.newsletterId,
      newsletterTitle: row.newsletterTitle,
      subject: row.subject,
      status: row.status,
      totalRecipients: row.totalRecipients,
      sent: row.sent,
      failed: row.failed,
      delivered: Number(row.delivered),
      suppressed: Number(row.suppressed),
      bounced: Number(row.bounced),
      complaints: Number(row.complaints),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
      replied: Number(row.replied),
      scheduledAt: row.scheduledAt,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      createdBy: row.createdById
        ? {
            id: row.createdById,
            name: row.createdByName ?? '',
            email: row.createdByEmail ?? '',
          }
        : null,
    }));
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      include: {
        newsletter: {
          select: {
            id: true,
            slug: true,
            title: true,
            subject: true,
            htmlBody: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    return {
      id: campaign.id,
      name: campaign.name,
      newsletterId: campaign.newsletterId,
      newsletterTitle: campaign.newsletter.title,
      newsletter: campaign.newsletter,
      subject: campaign.subjectSnapshot,
      previewHtml: campaign.status === EmailCampaignStatus.draft
        ? campaign.newsletter.htmlBody
        : campaign.htmlSnapshot,
      status: campaign.status,
      fromName: campaign.fromName ?? '',
      fromEmail: campaign.fromEmail ?? '',
      replyTo: campaign.replyToEmail ?? campaign.fromEmail ?? '',
      groupOptionIds: campaign.audienceSegments,
      excludeGroupOptionIds: campaign.audienceExcludeSegments,
      totalRecipients: campaign.totalRecipients,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
      createdBy: campaign.createdBy
        ? {
            id: campaign.createdBy.id,
            name: campaign.createdBy.name,
            email: campaign.createdBy.email,
          }
        : null,
    };
  }

  async getCampaignStats(id: string, days = 30) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      select: {
        id: true,
        name: true,
        status: true,
        totalRecipients: true,
        sentCount: true,
        errorCount: true,
      },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');

    const safeDays = Math.min(Math.max(Math.floor(days) || 30, 1), 365);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (safeDays - 1));
    since.setUTCHours(0, 0, 0, 0);

    const [totals] = await this.prisma.$queryRaw<Array<{
      suppressed: bigint;
      delivered: bigint;
      bounced: bigint;
      complaints: bigint;
      opened: bigint;
      clicked: bigint;
      replied: bigint;
    }>>(Prisma.sql`
      SELECT
        COUNT(send."id") FILTER (WHERE send."status" = 'suppressed'::"EmailSendStatus") AS "suppressed",
        COUNT(send."id") FILTER (WHERE send."deliveredAt" IS NOT NULL) AS "delivered",
        COUNT(send."id") FILTER (WHERE send."bouncedAt" IS NOT NULL) AS "bounced",
        COUNT(send."id") FILTER (WHERE send."complainedAt" IS NOT NULL) AS "complaints",
        COUNT(send."id") FILTER (WHERE send."openedAt" IS NOT NULL) AS "opened",
        COUNT(send."id") FILTER (WHERE send."clickedAt" IS NOT NULL) AS "clicked",
        COUNT(send."id") FILTER (WHERE send."repliedAt" IS NOT NULL) AS "replied"
      FROM "EmailSend" send
      WHERE send."campaignId" = ${campaign.id}
    `);

    const openRows = await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
      SELECT to_char(send."openedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COUNT(send."id")::bigint AS count
      FROM "EmailSend" send
      WHERE send."campaignId" = ${campaign.id}
        AND send."openedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `);

    const clickRows = await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
      SELECT to_char(send."clickedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COUNT(send."id")::bigint AS count
      FROM "EmailSend" send
      WHERE send."campaignId" = ${campaign.id}
        AND send."clickedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `);

    const opensMap = new Map(openRows.map((row) => [row.day, Number(row.count)]));
    const clicksMap = new Map(clickRows.map((row) => [row.day, Number(row.count)]));
    const opensByDay: Array<{ date: string; count: number }> = [];
    const clicksByDay: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < safeDays; i += 1) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      opensByDay.push({ date: key, count: opensMap.get(key) ?? 0 });
      clicksByDay.push({ date: key, count: clicksMap.get(key) ?? 0 });
    }

    const delivered = Number(totals?.delivered ?? 0);
    const opened = Number(totals?.opened ?? 0);
    const clicked = Number(totals?.clicked ?? 0);
    const replied = Number(totals?.replied ?? 0);

    return {
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalRecipients: campaign.totalRecipients,
      sent: campaign.sentCount,
      failed: campaign.errorCount,
      suppressed: Number(totals?.suppressed ?? 0),
      delivered,
      bounced: Number(totals?.bounced ?? 0),
      complaints: Number(totals?.complaints ?? 0),
      opened,
      clicked,
      replied,
      openRate: delivered > 0 ? opened / delivered : 0,
      clickRate: delivered > 0 ? clicked / delivered : 0,
      replyRate: delivered > 0 ? replied / delivered : 0,
      opensByDay,
      clicksByDay,
    };
  }

  async listCampaignSends(id: string, query: MalichimpCampaignSendsQueryDto) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');

    const event = (query.event ?? 'all') as MalichimpCampaignSendEvent;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
    const q = query.q?.trim();

    const where: Prisma.EmailSendWhereInput = {
      campaignId: campaign.id,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(event === 'sent'
        ? { status: 'sent' as const }
        : event === 'delivered'
          ? { deliveredAt: { not: null } }
          : event === 'opened'
            ? { openedAt: { not: null } }
            : event === 'clicked'
              ? { clickedAt: { not: null } }
              : event === 'bounced'
                ? { bouncedAt: { not: null } }
                : event === 'complained'
                  ? { complainedAt: { not: null } }
                  : event === 'suppressed'
                    ? { status: 'suppressed' as const }
                    : event === 'failed'
                      ? { status: 'failed' as const }
                      : event === 'pending'
                        ? { status: 'pending' as const }
                        : event === 'replied'
                          ? { repliedAt: { not: null } }
                          : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.emailSend.findMany({
        where,
        orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          sourceContactId: true,
          sentAt: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          bouncedAt: true,
          complainedAt: true,
          repliedAt: true,
          error: true,
        },
      }),
      this.prisma.emailSend.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        sentAt: item.sentAt?.toISOString() ?? null,
        deliveredAt: item.deliveredAt?.toISOString() ?? null,
        openedAt: item.openedAt?.toISOString() ?? null,
        clickedAt: item.clickedAt?.toISOString() ?? null,
        bouncedAt: item.bouncedAt?.toISOString() ?? null,
        complainedAt: item.complainedAt?.toISOString() ?? null,
        repliedAt: item.repliedAt?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      event,
    };
  }

  async exportCampaignsXlsx(campaignIds?: string[]) {
    const ids = (campaignIds ?? []).map((id) => id.trim()).filter(Boolean);
    const campaigns = await this.listCampaigns();
    const rows = ids.length
      ? campaigns.filter((campaign) => ids.includes(campaign.id))
      : campaigns;
    if (ids.length && !rows.length) {
      throw new BadRequestException('No se encontraron campañas para exportar');
    }

    const pct = (num: number, den: number) =>
      den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

    const buffer = await buildTreasuryXlsx(
      'Campañas',
      [
        { key: 'name', header: 'Campaña', width: 32 },
        { key: 'subject', header: 'Asunto', width: 36 },
        { key: 'status', header: 'Estado', width: 14 },
        { key: 'createdBy', header: 'Creada por', width: 24 },
        { key: 'createdAt', header: 'Creada', width: 20 },
        { key: 'scheduledAt', header: 'Programada', width: 20 },
        { key: 'completedAt', header: 'Completada', width: 20 },
        { key: 'totalRecipients', header: 'Destinatarios', width: 14 },
        { key: 'sent', header: 'Enviados', width: 12 },
        { key: 'delivered', header: 'Entregados', width: 12 },
        { key: 'opened', header: 'Abiertos', width: 12 },
        { key: 'clicked', header: 'Clics', width: 12 },
        { key: 'replied', header: 'Respondieron', width: 14 },
        { key: 'bounced', header: 'Rebotes', width: 12 },
        { key: 'complaints', header: 'Quejas', width: 12 },
        { key: 'suppressed', header: 'Omitidos', width: 12 },
        { key: 'failed', header: 'Fallidos', width: 12 },
        { key: 'deliveryRate', header: '% entrega', width: 12 },
        { key: 'openRate', header: '% apertura', width: 12 },
        { key: 'clickRate', header: '% clic', width: 12 },
        { key: 'replyRate', header: '% reply', width: 12 },
      ],
      rows.map((campaign) => ({
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        createdBy: campaign.createdBy?.name || campaign.createdBy?.email || '',
        createdAt: limaStamp(campaign.createdAt),
        scheduledAt: limaStamp(campaign.scheduledAt),
        completedAt: limaStamp(campaign.completedAt),
        totalRecipients: campaign.totalRecipients,
        sent: campaign.sent,
        delivered: campaign.delivered,
        opened: campaign.opened,
        clicked: campaign.clicked,
        replied: campaign.replied,
        bounced: campaign.bounced,
        complaints: campaign.complaints,
        suppressed: campaign.suppressed,
        failed: campaign.failed,
        deliveryRate: pct(campaign.delivered, campaign.sent),
        openRate: pct(campaign.opened, campaign.delivered),
        clickRate: pct(campaign.clicked, campaign.delivered),
        replyRate: pct(campaign.replied, campaign.delivered),
      })),
    );

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      buffer,
      filename: `malichimp-campanas_${stamp}.xlsx`,
    };
  }

  async getCampaignBrowserView(id: string) {
    const campaign = await this.getCampaign(id);
    return {
      title: campaign.name,
      html: campaign.previewHtml,
    };
  }

  async duplicateCampaign(userId: string, id: string) {
    const source = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      include: {
        newsletter: {
          select: {
            slug: true,
            title: true,
            htmlBody: true,
            designJson: true,
          },
        },
      },
    });
    if (!source) throw new NotFoundException('Campaña no encontrada');

    const sourceHtml = source.status === EmailCampaignStatus.draft
      ? source.newsletter.htmlBody
      : source.htmlSnapshot;
    const recipients = source.audienceSegments.length
      ? await this.resolveAudience(
        source.audienceSegments,
        source.audienceExcludeSegments,
      )
      : [];
    const draftId = await this.prisma.$transaction(async (tx) => {
      const newsletter = await tx.newsletter.create({
        data: {
          slug: duplicateNewsletterSlug(source.newsletter.slug),
          title: duplicateLabel(source.newsletter.title, 200),
          subject: source.subjectSnapshot.slice(0, 200),
          htmlBody: sourceHtml,
          designJson: source.newsletter.htmlBody === sourceHtml
            ? source.newsletter.designJson
            : null,
          status: NewsletterStatus.draft,
          createdById: userId,
        },
      });
      const draft = await tx.emailCampaign.create({
        data: {
          newsletterId: newsletter.id,
          name: duplicateLabel(source.name, 160),
          replyToEmail: source.replyToEmail,
          subjectSnapshot: source.subjectSnapshot,
          htmlSnapshot: sourceHtml,
          fromName: source.fromName,
          fromEmail: source.fromEmail,
          unsubscribePath: 'mail/unsubscribe',
          managedByDispatcher: false,
          status: EmailCampaignStatus.draft,
          audienceArea: 'malichimp',
          audienceSegments: source.audienceSegments,
          audienceExcludeSegments: source.audienceExcludeSegments,
          totalRecipients: recipients.length,
          scheduledAt: null,
          createdById: userId,
        },
      });
      return draft.id;
    });
    return this.getCampaign(draftId);
  }

  async deleteDraftCampaign(id: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      select: {
        id: true,
        status: true,
        newsletterId: true,
        newsletter: { select: { id: true, status: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status !== EmailCampaignStatus.draft) {
      throw new BadRequestException(
        'Solo se pueden eliminar campañas en borrador',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailCampaign.delete({ where: { id: campaign.id } });
      if (campaign.newsletter.status !== NewsletterStatus.draft) return;
      const remaining = await tx.emailCampaign.count({
        where: { newsletterId: campaign.newsletterId },
      });
      if (remaining === 0) {
        await tx.newsletter.delete({ where: { id: campaign.newsletterId } });
      }
    });

    return { ok: true as const };
  }

  private async prepareCampaignInput(
    dto: CreateMalichimpCampaignDto,
    attachedDraftNewsletterId?: string,
  ) {
    if (!this.emailDelivery.status.configured) {
      throw new BadRequestException('El motor SES todavía no está configurado');
    }
    const filters = await this.normalizeAudience(dto);
    const fromEmail = dto.fromEmail.trim().toLowerCase();
    const replyTo = dto.replyTo.trim().toLowerCase();
    if (!MALI_PE_EMAIL.test(replyTo)) {
      throw new BadRequestException('La respuesta debe ser un correo @mali.pe');
    }
    await this.emailSenders.assertEnabled(fromEmail);
    const draftNewsletterId = dto.draftNewsletterId?.trim() || attachedDraftNewsletterId;
    const canUseAttachedDraft = Boolean(
      draftNewsletterId && draftNewsletterId === dto.newsletterId,
    );
    if (dto.draftNewsletterId?.trim() && dto.draftNewsletterId.trim() !== dto.newsletterId) {
      throw new BadRequestException('El boletín borrador no coincide con el contenido seleccionado');
    }
    const newsletter = await this.prisma.newsletter.findFirst({
      where: {
        id: dto.newsletterId,
        ...(canUseAttachedDraft ? {} : { status: NewsletterStatus.published }),
      },
      select: { id: true, htmlBody: true, status: true },
    });
    if (!newsletter) {
      throw new BadRequestException(
        canUseAttachedDraft
          ? 'El boletín borrador ya no está disponible'
          : 'Selecciona un boletín publicado',
      );
    }
    const recipients = await this.resolveAudience(
      filters.groupOptionIds,
      filters.excludeGroupOptionIds,
      filters.excludeContactIds,
      filters.includeContactIds,
    );
    if (!recipients.length) {
      throw new BadRequestException('La segmentación no tiene destinatarios elegibles');
    }
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('La programación debe usar una fecha y hora futuras');
    }
    return {
      filters,
      fromEmail,
      replyTo,
      newsletter,
      recipients,
      scheduledAt,
    };
  }

  async createCampaign(userId: string, dto: CreateMalichimpCampaignDto) {
    const prepared = await this.prepareCampaignInput(dto);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.emailCampaign.create({
        data: {
          newsletterId: prepared.newsletter.id,
          name: dto.name.trim(),
          replyToEmail: prepared.replyTo,
          subjectSnapshot: dto.subject.trim(),
          htmlSnapshot: prepared.newsletter.htmlBody,
          fromName: dto.fromName.trim(),
          fromEmail: prepared.fromEmail,
          unsubscribePath: 'mail/unsubscribe',
          managedByDispatcher: true,
          status: prepared.scheduledAt
            ? EmailCampaignStatus.scheduled
            : EmailCampaignStatus.queued,
          audienceArea: 'malichimp',
          audienceSegments: prepared.filters.groupOptionIds,
          audienceExcludeSegments: prepared.filters.excludeGroupOptionIds,
          totalRecipients: prepared.recipients.length,
          scheduledAt: prepared.scheduledAt,
          createdById: userId,
        },
      });
      for (let index = 0; index < prepared.recipients.length; index += 1_000) {
        await tx.emailSend.createMany({
          data: prepared.recipients.slice(index, index + 1_000).map((recipient) => ({
            campaignId: created.id,
            email: recipient.email,
            sourceContactId: recipient.id,
            name: [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || null,
          })),
        });
      }
      return created;
    }, { maxWait: 15_000, timeout: 120_000 });

    return {
      id: campaign.id,
      status: campaign.status,
      totalRecipients: campaign.totalRecipients,
      scheduledAt: campaign.scheduledAt,
    };
  }

  async sendDraftCampaign(id: string, dto: CreateMalichimpCampaignDto) {
    const draft = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      select: { id: true, status: true, newsletterId: true },
    });
    if (!draft) throw new NotFoundException('Campaña no encontrada');
    if (draft.status !== EmailCampaignStatus.draft) {
      throw new ConflictException('Esta campaña ya no es un borrador');
    }
    const prepared = await this.prepareCampaignInput(dto, draft.newsletterId);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.emailCampaign.updateMany({
        where: { id, status: EmailCampaignStatus.draft },
        data: {
          newsletterId: prepared.newsletter.id,
          name: dto.name.trim(),
          replyToEmail: prepared.replyTo,
          subjectSnapshot: dto.subject.trim(),
          htmlSnapshot: prepared.newsletter.htmlBody,
          fromName: dto.fromName.trim(),
          fromEmail: prepared.fromEmail,
          unsubscribePath: 'mail/unsubscribe',
          managedByDispatcher: true,
          status: prepared.scheduledAt
            ? EmailCampaignStatus.scheduled
            : EmailCampaignStatus.queued,
          audienceSegments: prepared.filters.groupOptionIds,
          audienceExcludeSegments: prepared.filters.excludeGroupOptionIds,
          totalRecipients: prepared.recipients.length,
          scheduledAt: prepared.scheduledAt,
        },
      });
      if (!updated.count) {
        throw new ConflictException('Esta campaña ya no es un borrador');
      }
      for (let index = 0; index < prepared.recipients.length; index += 1_000) {
        await tx.emailSend.createMany({
          data: prepared.recipients.slice(index, index + 1_000).map((recipient) => ({
            campaignId: id,
            email: recipient.email,
            sourceContactId: recipient.id,
            name: [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || null,
          })),
        });
      }
      return tx.emailCampaign.findUniqueOrThrow({ where: { id } });
    }, { maxWait: 15_000, timeout: 120_000 });
    return {
      id: campaign.id,
      status: campaign.status,
      totalRecipients: campaign.totalRecipients,
      scheduledAt: campaign.scheduledAt,
    };
  }

  async assertUnsubscribeToken(openToken: string) {
    const send = await this.prisma.emailSend.findUnique({
      where: { openToken },
      include: { campaign: { select: { audienceArea: true, unsubscribePath: true } } },
    });
    if (
      !send ||
      send.campaign.audienceArea !== 'malichimp' ||
      !send.campaign.unsubscribePath
    ) {
      throw new NotFoundException('Enlace de suscripción no válido');
    }
    return send;
  }

  async unsubscribe(openToken: string) {
    const send = await this.assertUnsubscribeToken(openToken);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.malichimpSuppression.findUnique({
        where: { email: send.email },
      });
      if (!existing) {
        await tx.malichimpSuppression.create({
          data: {
            email: send.email,
            reason: MalichimpSuppressionReason.malichimp_unsubscribe,
            source: 'malichimp_unsubscribe_link',
            occurredAt: new Date(),
            metadata: { campaignId: send.campaignId, sendId: send.id },
          },
        });
      }
      await tx.malichimpContact.updateMany({
        where: { email: send.email },
        data: {
          status: MalichimpContactStatus.unsubscribed,
          statusChangedAt: new Date(),
        },
      });
      await tx.emailSend.updateMany({
        where: {
          email: send.email,
          status: 'pending',
          campaign: { audienceArea: 'malichimp' },
        },
        data: {
          status: 'suppressed',
          claimedAt: null,
          error: 'Baja solicitada en MALICHIMP',
        },
      });
    });
    return { unsubscribed: true };
  }

  async previewZip(userId: string, file: Express.Multer.File) {
    await this.cleanupExpiredPreviews();
    if (!file?.buffer?.length) throw new BadRequestException('Selecciona un ZIP');
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Solo se admite el ZIP completo de Mailchimp');
    }

    const previewId = newPreviewId();
    const directory = zipPreviewDirectory(previewId);
    await mkdir(directory, { recursive: true });
    try {
      await extractMailchimpZip(file.buffer, directory);
      const files = await locateMalichimpFiles(directory);
      const report = await inspectMalichimpFiles(files);
      if (report.errors.length) {
        throw new BadRequestException({
          message: `El ZIP contiene ${report.errors.length} error(es)`,
          errors: report.errors.slice(0, 25),
        });
      }
      const previous = await this.prisma.malichimpImportRun.findFirst({
        where: { fileFingerprint: report.fingerprint, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { id: true, completedAt: true },
      });
      const preview: StoredZipPreview = {
        id: previewId,
        userId,
        originalName: file.originalname.slice(0, 240),
        directory,
        files,
        report,
        expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
      };
      await writeZipPreview(preview);
      this.previews.set(preview.id, preview);
      return {
        previewId: preview.id,
        fileName: preview.originalName,
        report,
        expiresAt: preview.expiresAt,
        previouslyImported: previous,
      };
    } catch (error) {
      this.previews.delete(previewId);
      await removePreviewDirectory(directory);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo procesar el ZIP',
      );
    }
  }

  async previewXlsx(
    userId: string,
    file: Express.Multer.File,
    rawGroupOptionIds: string | undefined,
    consentConfirmed: string | undefined,
  ) {
    await this.cleanupExpiredPreviews();
    if (!file?.buffer?.length) throw new BadRequestException('Selecciona un XLSX');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Solo se admite un archivo XLSX');
    }
    if (file.buffer.length > MAX_XLSX_BYTES) {
      throw new BadRequestException('El XLSX debe pesar hasta 10 MB.');
    }
    if (consentConfirmed !== 'true') {
      throw new BadRequestException(
        'Confirma que estos contactos autorizaron recibir comunicaciones por correo.',
      );
    }

    let requestedIds: unknown;
    try {
      requestedIds = JSON.parse(rawGroupOptionIds ?? '[]');
    } catch {
      throw new BadRequestException('La selección de grupos no es válida');
    }
    if (!Array.isArray(requestedIds) || requestedIds.some((id) => typeof id !== 'string')) {
      throw new BadRequestException('La selección de grupos no es válida');
    }
    const groupOptions = await this.validateGroupOptionIds(requestedIds);
    const parsed = await parseMalichimpContactsXlsx(file.buffer);
    const emails = parsed.rows.map((row) => row.email);
    const [existing, localSuppressions, globalSuppressions] = await Promise.all([
      this.prisma.malichimpContact.findMany({
        where: { email: { in: emails } },
        select: { email: true, status: true },
      }),
      this.prisma.malichimpSuppression.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
      this.prisma.emailGlobalSuppression.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      }),
    ]);
    const existingByEmail = new Map(existing.map((contact) => [contact.email, contact]));
    const blockedEmails = new Set([
      ...localSuppressions.map((row) => row.email),
      ...globalSuppressions.map((row) => row.email),
      ...existing
        .filter((contact) => isBlockedContactStatus(contact.status))
        .map((contact) => contact.email),
    ]);

    let newContacts = 0;
    let existingContacts = 0;
    let blockedContacts = 0;
    for (const row of parsed.rows) {
      if (blockedEmails.has(row.email)) {
        blockedContacts += 1;
        continue;
      }
      if (existingByEmail.has(row.email)) existingContacts += 1;
      else newContacts += 1;
    }
    const report = {
      totalRows: parsed.totalRows,
      validRows: parsed.validRows,
      invalidRows: parsed.invalidRows,
      duplicateRows: parsed.duplicateRows,
      importableContacts: newContacts + existingContacts,
      newContacts,
      existingContacts,
      blockedContacts,
      errors: parsed.errors,
      sample: parsed.rows.slice(0, 10).map((row) => ({
        rowNumber: row.rowNumber,
        email: row.email,
        name: [row.firstName, row.lastName].filter(Boolean).join(' ') || null,
        action: blockedEmails.has(row.email)
          ? 'blocked' as const
          : existingByEmail.has(row.email) ? 'update' as const : 'create' as const,
      })),
    };
    if (!report.importableContacts) {
      throw new BadRequestException({
        message: 'El XLSX no contiene contactos que puedan importarse.',
        errors: parsed.errors,
      });
    }

    const previewId = newPreviewId();
    const consentConfirmedAt = new Date().toISOString();
    const preview: StoredXlsxPreview = {
      id: previewId,
      userId,
      originalName: file.originalname.slice(0, 240),
      directory: xlsxPreviewDirectory(previewId),
      rows: parsed.rows,
      groupOptionIds: groupOptions.map((option) => option.id),
      groupOptions: groupOptions.map((option) => ({
        id: option.id,
        name: option.name,
        groupName: option.group.name,
      })),
      report,
      fingerprint: fingerprintBuffer(file.buffer),
      consentConfirmedAt,
      consentConfirmedBy: userId,
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    };
    await writeXlsxPreview(preview);
    this.xlsxPreviews.set(preview.id, preview);
    return {
      previewId: preview.id,
      fileName: preview.originalName,
      groupOptionIds: preview.groupOptionIds,
      groupOptions: preview.groupOptions,
      report,
      expiresAt: preview.expiresAt,
    };
  }

  async applyXlsxImport(userId: string, previewId: string) {
    await this.cleanupExpiredPreviews();
    const preview = await this.loadXlsxPreview(previewId, userId);
    await this.validateGroupOptionIds(preview.groupOptionIds);

    const busy = await this.prisma.malichimpImportJob.count({
      where: { status: { in: ['queued', 'running'] } },
    });
    if (busy) {
      throw new ConflictException(
        'Hay una importación en curso. Espera a que termine.',
      );
    }

    let job: MalichimpImportJob;
    try {
      job = await this.prisma.malichimpImportJob.create({
        data: {
          userId,
          status: 'running',
          originalName: `xlsx:${preview.originalName}`.slice(0, 240),
          total: preview.report.importableContacts,
          processed: 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Hay una importación en curso. Espera a que termine.');
      }
      throw error;
    }

    const now = new Date();
    const source = `xlsx:${preview.originalName}`.slice(0, 240);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const run = await tx.malichimpImportRun.create({
          data: {
            sourceKey: source.slice(0, 160),
            sourceDirectory: 'temporary_ui_xlsx_upload',
            fileFingerprint: preview.fingerprint,
            counts: {
              ...preview.report,
              groupOptionIds: preview.groupOptionIds,
              consentConfirmedAt: preview.consentConfirmedAt,
              consentConfirmedBy: preview.consentConfirmedBy,
              kind: 'xlsx',
            },
          },
        });

        const emails = preview.rows.map((row) => row.email);
        const [existing, localSuppressions, globalSuppressions] = await Promise.all([
          tx.malichimpContact.findMany({
            where: { email: { in: emails } },
            select: {
              id: true,
              email: true,
              status: true,
              source: true,
              optInAt: true,
              confirmedAt: true,
            },
          }),
          tx.malichimpSuppression.findMany({
            where: { email: { in: emails } },
            select: { email: true },
          }),
          tx.emailGlobalSuppression.findMany({
            where: { email: { in: emails } },
            select: { email: true },
          }),
        ]);
        const existingByEmail = new Map(existing.map((contact) => [contact.email, contact]));
        const blocked = new Set([
          ...localSuppressions.map((row) => row.email),
          ...globalSuppressions.map((row) => row.email),
          ...existing
            .filter((contact) => isBlockedContactStatus(contact.status))
            .map((contact) => contact.email),
        ]);
        const importable = preview.rows.filter((row) => !blocked.has(row.email));
        let created = 0;
        let updated = 0;
        const profileData = (row: MalichimpXlsxContactRow) => ({
          ...(row.firstName ? { firstName: row.firstName } : {}),
          ...(row.lastName ? { lastName: row.lastName } : {}),
          ...(row.phone ? { phone: row.phone } : {}),
          ...(row.institutionName ? { institutionName: row.institutionName } : {}),
          ...(row.jobTitle ? { jobTitle: row.jobTitle } : {}),
          ...(row.city ? { city: row.city } : {}),
          ...(row.country ? { country: row.country } : {}),
          ...(row.classification ? { classification: row.classification } : {}),
        });

        const newRows = importable.filter((row) => !existingByEmail.has(row.email));
        for (let index = 0; index < newRows.length; index += 1_000) {
          const batch = await tx.malichimpContact.createMany({
            data: newRows.slice(index, index + 1_000).map((row) => ({
              email: row.email,
              ...profileData(row),
              source,
              status: MalichimpContactStatus.subscribed,
              optInAt: now,
              confirmedAt: now,
              statusChangedAt: now,
            })),
            skipDuplicates: true,
          });
          created += batch.count;
        }

        for (const row of importable) {
          const current = existingByEmail.get(row.email);
          if (!current) continue;
          await tx.malichimpContact.update({
            where: { email: row.email },
            data: {
              ...profileData(row),
              source: current.source ?? source,
              optInAt: current.optInAt ?? now,
              confirmedAt: current.confirmedAt ?? now,
            },
          });
          updated += 1;
        }

        const importedContacts = await tx.malichimpContact.findMany({
          where: {
            email: { in: importable.map((row) => row.email) },
            status: MalichimpContactStatus.subscribed,
          },
          select: { id: true },
        });
        const memberships = importedContacts.flatMap((contact) =>
          preview.groupOptionIds.map((optionId) => ({
            contactId: contact.id,
            optionId,
          })),
        );
        let membershipsAdded = 0;
        for (let index = 0; index < memberships.length; index += 5_000) {
          const batch = await tx.malichimpContactGroupOption.createMany({
            data: memberships.slice(index, index + 5_000),
            skipDuplicates: true,
          });
          membershipsAdded += batch.count;
        }

        await tx.malichimpImportRun.update({
          where: { id: run.id },
          data: {
            completedAt: new Date(),
            counts: {
              ...preview.report,
              groupOptionIds: preview.groupOptionIds,
              consentConfirmedAt: preview.consentConfirmedAt,
              consentConfirmedBy: preview.consentConfirmedBy,
              kind: 'xlsx',
              created,
              updated,
              skipped: preview.rows.length - importable.length,
              membershipsAdded,
            },
          },
        });

        return {
          created,
          updated,
          skipped: preview.rows.length - importable.length,
          imported: created + updated,
          membershipsAdded,
          runId: run.id,
          jobId: job.id,
        };
      }, { maxWait: 15_000, timeout: 120_000 });

      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          processed: result.imported,
          runId: result.runId,
          completedAt: new Date(),
        },
      });
      return result;
    } catch (error) {
      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          processed: 0,
          error: error instanceof Error ? error.message.slice(0, 1000) : String(error),
          completedAt: new Date(),
        },
      });
      throw error;
    } finally {
      this.xlsxPreviews.delete(preview.id);
      await removePreviewDirectory(preview.directory);
    }
  }

  async startZipImport(userId: string, previewId: string) {
    await this.cleanupExpiredPreviews();
    const preview = await this.loadZipPreview(previewId, userId);
    const busy = await this.prisma.malichimpImportJob.count({
      where: { status: { in: ['queued', 'running'] } },
    });
    if (busy) throw new ConflictException('Ya hay una importación en curso');

    let job: MalichimpImportJob;
    try {
      job = await this.prisma.malichimpImportJob.create({
        data: {
          userId,
          status: 'queued',
          originalName: preview.originalName,
          total: preview.report.totalUnique,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya hay una importación en curso');
      }
      throw error;
    }
    this.previews.delete(previewId);
    void this.runImport(job, preview).catch((error: unknown) => {
      this.logger.error('No se pudo finalizar el trabajo de importación', error);
    });
    return this.serializeJob(job);
  }

  async getImportJob(userId: string, jobId: string) {
    const job = await this.prisma.malichimpImportJob.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) throw new NotFoundException('Importación no encontrada');
    return this.serializeJob(job);
  }

  private async normalizeAudience(dto: MalichimpAudienceDto) {
    const [included, excluded] = await Promise.all([
      this.validateGroupOptionIds(dto.groupOptionIds ?? []),
      this.validateGroupOptionIds(dto.excludeGroupOptionIds ?? [], false),
    ]);
    const groupOptionIds = included.map((option) => option.id);
    const excludeGroupOptionIds = excluded.map((option) => option.id);
    const includedIds = new Set(groupOptionIds);
    if (excludeGroupOptionIds.some((id) => includedIds.has(id))) {
      throw new BadRequestException(
        'Una opción de grupo no puede estar incluida y excluida a la vez',
      );
    }
    const excludeContactIds = [
      ...new Set(
        (dto.excludeContactIds ?? [])
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    const includeContactIds = [
      ...new Set(
        (dto.includeContactIds ?? [])
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    if (includeContactIds.length && excludeContactIds.length) {
      throw new BadRequestException(
        'Usa solo exclusiones o solo inclusiones de contactos, no ambas',
      );
    }
    return {
      groupOptionIds,
      excludeGroupOptionIds,
      excludeContactIds,
      includeContactIds,
    };
  }

  private async validateGroupOptionIds(groupOptionIds: string[], required = true) {
    const normalizedIds = [
      ...new Set(groupOptionIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!normalizedIds.length && required) {
      throw new BadRequestException('Selecciona al menos una opción de grupo');
    }
    if (!normalizedIds.length) return [];
    const existing = await this.prisma.malichimpGroupOption.findMany({
      where: { id: { in: normalizedIds } },
      include: {
        group: {
          select: { id: true, name: true, sortOrder: true },
        },
      },
    });
    const known = new Set(existing.map((option) => option.id));
    if (normalizedIds.some((id) => !known.has(id))) {
      throw new BadRequestException('La audiencia contiene opciones de grupo que ya no existen');
    }
    const byId = new Map(existing.map((option) => [option.id, option]));
    return normalizedIds.map((id) => byId.get(id)!);
  }

  private audienceSearchWhere(q: string): Prisma.Sql {
    if (!q) return Prisma.sql``;
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    return Prisma.sql`
      AND (
        contact."email" ILIKE ${pattern} ESCAPE '\\'
        OR COALESCE(contact."firstName", '') ILIKE ${pattern} ESCAPE '\\'
        OR COALESCE(contact."lastName", '') ILIKE ${pattern} ESCAPE '\\'
        OR CONCAT_WS(' ', contact."firstName", contact."lastName") ILIKE ${pattern} ESCAPE '\\'
      )
    `;
  }

  private audienceWhere(
    groupOptionIds: string[],
    excludeGroupOptionIds: string[],
    excludeContactIds: string[] = [],
    includeContactIds: string[] = [],
  ): Prisma.Sql {
    const exclusion = excludeGroupOptionIds.length
      ? Prisma.sql`
        AND NOT EXISTS (
          SELECT 1
          FROM "MalichimpContactGroupOption" excluded_membership
          WHERE excluded_membership."contactId" = contact."id"
            AND excluded_membership."optionId" IN (${Prisma.join(excludeGroupOptionIds)})
        )
      `
      : Prisma.sql``;
    const contactExclusion = excludeContactIds.length
      ? Prisma.sql`
        AND contact."id" NOT IN (${Prisma.join(excludeContactIds)})
      `
      : Prisma.sql``;
    const contactInclusion = includeContactIds.length
      ? Prisma.sql`
        AND contact."id" IN (${Prisma.join(includeContactIds)})
      `
      : Prisma.sql``;
    return Prisma.sql`
      contact."status" = 'subscribed'::"MalichimpContactStatus"
      AND NOT EXISTS (
        SELECT 1 FROM "MalichimpSuppression" suppression
        WHERE suppression."email" = contact."email"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "EmailGlobalSuppression" suppression
        WHERE suppression."email" = contact."email"
      )
      AND EXISTS (
        SELECT 1
        FROM "MalichimpContactGroupOption" membership
        WHERE membership."contactId" = contact."id"
          AND membership."optionId" IN (${Prisma.join(groupOptionIds)})
      )
      ${exclusion}
      ${contactExclusion}
      ${contactInclusion}
    `;
  }

  private resolveAudience(
    groupOptionIds: string[],
    excludeGroupOptionIds: string[],
    excludeContactIds: string[] = [],
    includeContactIds: string[] = [],
  ) {
    const where = this.audienceWhere(
      groupOptionIds,
      excludeGroupOptionIds,
      excludeContactIds,
      includeContactIds,
    );
    return this.prisma.$queryRaw<AudienceRecipient[]>(Prisma.sql`
      SELECT contact."id", contact."email", contact."firstName", contact."lastName"
      FROM "MalichimpContact" contact
      WHERE ${where}
      ORDER BY contact."id"
    `);
  }

  private async loadZipPreview(previewId: string, userId: string): Promise<StoredZipPreview> {
    const cached = this.previews.get(previewId);
    const preview = cached ?? await readZipPreview(previewId);
    if (!preview || preview.userId !== userId) {
      throw new NotFoundException('La vista previa expiró; vuelve a subir el ZIP');
    }
    if (!cached) this.previews.set(preview.id, preview);
    return preview;
  }

  private async loadXlsxPreview(previewId: string, userId: string): Promise<StoredXlsxPreview> {
    const cached = this.xlsxPreviews.get(previewId);
    const preview = cached ?? await readXlsxPreview(previewId);
    if (!preview || preview.userId !== userId) {
      throw new NotFoundException('La vista previa expiró; vuelve a subir el XLSX');
    }
    if (!cached) this.xlsxPreviews.set(preview.id, preview);
    return preview;
  }

  private async runImport(job: MalichimpImportJob, preview: StoredZipPreview) {
    try {
      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: { status: 'running' },
      });
      const result = await applyMalichimpFiles(
        this.prisma,
        preview.files,
        preview.report,
        {
          sourceKey: preview.originalName,
          sourceDirectory: 'temporary_ui_upload',
          onProgress: async (processed) => {
            await this.prisma.malichimpImportJob.update({
              where: { id: job.id },
              data: { processed },
            });
          },
        },
      );
      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: {
          processed: result.imported,
          runId: result.runId,
          status: 'completed',
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          processed: 0,
          error: error instanceof Error ? error.message.slice(0, 1000) : String(error),
          completedAt: new Date(),
        },
      });
    } finally {
      this.previews.delete(preview.id);
      await removePreviewDirectory(preview.directory);
    }
  }

  private serializeJob(job: MalichimpImportJob) {
    return {
      ...job,
      progress: job.total ? Math.round((job.processed / job.total) * 100) : 0,
    };
  }

  private async cleanupExpiredPreviews() {
    const now = Date.now();
    const expiredZip = [...this.previews.values()].filter(
      (preview) => preview.expiresAt.getTime() <= now,
    );
    await Promise.all(
      expiredZip.map(async (preview) => {
        this.previews.delete(preview.id);
        await removePreviewDirectory(preview.directory);
      }),
    );
    const expiredXlsx = [...this.xlsxPreviews.values()].filter(
      (preview) => preview.expiresAt.getTime() <= now,
    );
    await Promise.all(
      expiredXlsx.map(async (preview) => {
        this.xlsxPreviews.delete(preview.id);
        await removePreviewDirectory(preview.directory);
      }),
    );
  }

  private async cleanupOrphanDirectories() {
    try {
      const entries = await readdir(tmpdir(), { withFileTypes: true });
      const cutoff = Date.now() - 60 * 60 * 1000;
      await Promise.all(
        entries
          .filter(
            (entry) =>
              entry.isDirectory() && entry.name.startsWith(ZIP_PREVIEW_PREFIX),
          )
          .map(async (entry) => {
            const directory = path.join(tmpdir(), entry.name);
            const details = await stat(directory);
            if (details.mtimeMs < cutoff) {
              await removePreviewDirectory(directory);
            }
          }),
      );
    } catch {
      // Temporary cleanup must not prevent the API from starting.
    }
  }
}
