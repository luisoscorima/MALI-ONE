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
  EmailSendStatus,
  MalichimpContactStatus,
  MalichimpSuppressionReason,
  NewsletterKind,
  NewsletterScope,
  Prisma,
  type MalichimpImportJob,
  type User,
} from '@prisma/client';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
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
  MalichimpAudienceDto,
  CreateMalichimpContentDto,
  MalichimpCampaignSendsQueryDto,
  SaveMalichimpDraftDto,
  SendMalichimpTestDto,
  UpdateMalichimpContactDto,
  UpdateMalichimpWorkingCopyDto,
  type MalichimpCampaignSendEvent,
  type MalichimpSendScope,
} from './dto/malichimp-campaign.dto';
import { NewslettersService } from '../newsletters/newsletters.service';
import {
  contentRevisionOf,
  moduleLibraryListWhere,
} from '../newsletters/newsletter-working-copy';
import {
  buildTreasuryXlsx,
  limaStamp,
} from '../treasury/treasury-xlsx';
import { GoogleAdminService } from '../google-admin/google-admin.service';
import { EmailTrackingService } from '../../core/email-delivery/email-tracking.service';
import {
  applyEmailMergeTags,
  firstNameFromDisplayName,
} from '../../core/email-delivery/email-merge-tags';
import { replyToWithSendToken } from '../../core/email-delivery/malichimp-reply-to';
import { formatMalichimpAudienceLabel } from './lib/malichimp-audience-label';
import {
  MALICHIMP_AUDIENCE_MODE,
  MALICHIMP_RESOLVE_EMAILS_MAX,
  resolveMalichimpAudienceMode,
} from './lib/malichimp-audience-mode';
import { MALICHIMP_ELIGIBLE_CONTACT_SQL } from './lib/malichimp-eligibility';
import { isBasicEmail, normalizeEmail } from './lib/malichimp-import';
import type {
  MalichimpAudienceMode,
  MalichimpAudienceReviewDto,
  MalichimpBlockedEmailReason,
  MalichimpResolveEmailsDto,
} from '@mali-one/shared';

type AudienceRecipient = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type NormalizedAudience = {
  audienceMode: MalichimpAudienceMode;
  groupOptionIds: string[];
  excludeGroupOptionIds: string[];
  tagIds: string[];
  excludeTagIds: string[];
  excludeContactIds: string[];
  includeContactIds: string[];
};

const MALI_PE_EMAIL = /^[^@\s]+@mali\.pe$/i;

function recipientName(recipient: AudienceRecipient) {
  return [recipient.firstName, recipient.lastName].filter(Boolean).join(' ') || null;
}

function audienceRevisionOf(recipients: AudienceRecipient[]) {
  // resolveAudience returns rows in stable ID order.
  const hash = createHash('sha256');
  for (const { id, email } of recipients) {
    hash.update(JSON.stringify([id, email]) + '\n');
  }
  return hash.digest('hex');
}

function duplicateLabel(value: string, maxLength: number): string {
  const suffix = ' — copia';
  return `${value.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
}

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
    private readonly googleAdmin: GoogleAdminService,
    private readonly emailTracking: EmailTrackingService,
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
    const [tags, eligibleRows] = await Promise.all([
      this.prisma.malichimpTag.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { contacts: true } } },
      }),
      this.prisma.$queryRaw<Array<{ tagId: string; contacts: bigint }>>(Prisma.sql`
        SELECT membership."tagId" AS "tagId", COUNT(DISTINCT membership."contactId") AS contacts
        FROM "MalichimpContactTag" membership
        JOIN "MalichimpContact" contact ON contact."id" = membership."contactId"
        WHERE ${MALICHIMP_ELIGIBLE_CONTACT_SQL}
        GROUP BY membership."tagId"
      `),
    ]);
    const eligibleByTag = new Map(
      eligibleRows.map((row) => [row.tagId, Number(row.contacts)]),
    );
    return tags.map(({ _count, ...tag }) => ({
      ...tag,
      contacts: _count.contacts,
      eligibleContacts: eligibleByTag.get(tag.id) ?? 0,
    }));
  }

  async listGroups() {
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
        WHERE ${MALICHIMP_ELIGIBLE_CONTACT_SQL}
        GROUP BY option."groupId"
      `),
      this.prisma.$queryRaw<Array<{ optionId: string; contacts: bigint }>>(Prisma.sql`
        SELECT membership."optionId" AS "optionId", COUNT(DISTINCT membership."contactId") AS contacts
        FROM "MalichimpContactGroupOption" membership
        JOIN "MalichimpContact" contact ON contact."id" = membership."contactId"
        WHERE ${MALICHIMP_ELIGIBLE_CONTACT_SQL}
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

  /** Campaign wizard bases: shared published + MALICHIMP library. */
  listPublishedNewsletters() {
    return this.newsletters.listCampaignContentBases(NewsletterScope.malichimp);
  }

  /** Contenido tab: module library only (not working copies). */
  listLibraryContent() {
    return this.newsletters.listModuleLibrary(NewsletterScope.malichimp).then((rows) =>
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        brand: row.brand,
        updatedAt: row.updatedAt,
        contentRevision: contentRevisionOf(row),
        usedInCampaigns: row._count.campaigns,
        editable: true,
      })),
    );
  }

  async getContent(id: string) {
    const library = await this.prisma.newsletter.findFirst({
      where: { id, ...moduleLibraryListWhere(NewsletterScope.malichimp) },
    });
    if (library) {
      return {
        ...library,
        contentRevisionToken: contentRevisionOf(library),
        editable: true,
        kind: library.kind,
      };
    }
    return this.newsletters.getWorkingCopy(id, NewsletterScope.malichimp);
  }

  createLibraryContent(userId: string, dto: CreateMalichimpContentDto) {
    return this.newsletters.createModuleLibrary(userId, NewsletterScope.malichimp, {
      title: dto.title,
      subject: dto.subject,
      htmlBody: dto.htmlBody,
      designJson: dto.designJson,
      brand: dto.brand,
    });
  }

  async updateContent(id: string, dto: UpdateMalichimpWorkingCopyDto) {
    const library = await this.prisma.newsletter.findFirst({
      where: { id, ...moduleLibraryListWhere(NewsletterScope.malichimp) },
      select: { id: true },
    });
    if (library && dto.subject && dto.subject.length > 200) {
      throw new BadRequestException('El asunto de la biblioteca admite hasta 200 caracteres');
    }
    const row = library
      ? await this.newsletters.updateModuleLibrary(id, NewsletterScope.malichimp, dto)
      : await this.newsletters.updateWorkingCopy(id, NewsletterScope.malichimp, dto);
    return {
      ...row,
      contentRevisionToken: contentRevisionOf(row),
      editable: true,
    };
  }

  duplicateLibraryContent(userId: string, id: string) {
    return this.newsletters.duplicateModuleLibrary(
      userId,
      id,
      NewsletterScope.malichimp,
    );
  }

  deleteLibraryContent(id: string) {
    return this.newsletters.removeModuleLibrary(id, NewsletterScope.malichimp);
  }

  async getContentBrowserView(id: string) {
    const row = await this.getContent(id);
    return {
      title: row.title,
      html: row.htmlBody,
    };
  }

  async previewAudience(dto: MalichimpAudienceDto) {
    const filters = await this.normalizeAudience(dto);
    const pageSize = Math.min(Math.max(Math.floor(dto.pageSize ?? 50) || 50, 1), 100);
    const page = Math.max(Math.floor(dto.page ?? 1) || 1, 1);
    const offset = (page - 1) * pageSize;
    const q = (dto.q ?? '').trim().slice(0, 160);
    const includedFilters: NormalizedAudience = {
      ...filters,
      excludeGroupOptionIds: [],
      excludeTagIds: [],
      excludeContactIds: [],
      includeContactIds:
        filters.audienceMode === MALICHIMP_AUDIENCE_MODE.emails
          ? filters.includeContactIds
          : [],
    };
    const includedWhere = this.audienceWhere(includedFilters);
    const baseWhere = this.audienceWhere(filters);
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
      name: recipientName(contact),
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
      audienceMode: filters.audienceMode,
      groupOptionIds: filters.groupOptionIds,
      excludeGroupOptionIds: filters.excludeGroupOptionIds,
      tagIds: filters.tagIds,
      excludeTagIds: filters.excludeTagIds,
      excludeContactIds: filters.excludeContactIds,
      includeContactIds: filters.includeContactIds,
      recipients: mapped,
      sample: mapped,
    };
  }

  async reviewAudience(dto: MalichimpAudienceDto): Promise<MalichimpAudienceReviewDto> {
    const recipients = await this.resolveAudience(await this.normalizeAudience(dto));
    return {
      audienceRevision: audienceRevisionOf(recipients),
      totalRecipients: recipients.length,
      sample: recipients.slice(0, 5).map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        name: recipientName(recipient),
      })),
    };
  }

  async resolveEmails(emails: string[]): Promise<MalichimpResolveEmailsDto> {
    const received = emails.length;
    const uniqueByNormalized = new Map<string, string>();
    const invalid: string[] = [];
    for (const raw of emails) {
      const display = raw.trim();
      const normalized = normalizeEmail(raw);
      if (!normalized) {
        if (display) invalid.push(display);
        continue;
      }
      if (uniqueByNormalized.has(normalized)) continue;
      uniqueByNormalized.set(normalized, display || normalized);
    }
    const unique = uniqueByNormalized.size;
    if (unique > MALICHIMP_RESOLVE_EMAILS_MAX) {
      throw new BadRequestException(
        `Máximo ${MALICHIMP_RESOLVE_EMAILS_MAX} correos únicos por solicitud`,
      );
    }

    const eligible: MalichimpResolveEmailsDto['eligible'] = [];
    const notFound: string[] = [];
    const blocked: MalichimpResolveEmailsDto['blocked'] = [];

    const lookupEmails: string[] = [];
    for (const [normalized, display] of uniqueByNormalized) {
      if (!isBasicEmail(normalized)) {
        invalid.push(display);
      } else {
        lookupEmails.push(normalized);
      }
    }

    const contacts = lookupEmails.length
      ? await this.prisma.malichimpContact.findMany({
          where: { email: { in: lookupEmails } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        })
      : [];
    const contactByEmail = new Map(contacts.map((contact) => [contact.email, contact]));

    const suppressedEmails = lookupEmails.length
      ? new Set(
          (
            await this.prisma.$queryRaw<Array<{ email: string }>>(Prisma.sql`
              SELECT email FROM (
                SELECT "email" AS email FROM "MalichimpSuppression"
                WHERE "email" IN (${Prisma.join(lookupEmails)})
                UNION
                SELECT "email" AS email FROM "EmailGlobalSuppression"
                WHERE "email" IN (${Prisma.join(lookupEmails)})
              ) suppressions
            `)
          ).map((row) => row.email),
        )
      : new Set<string>();

    for (const [normalized, display] of uniqueByNormalized) {
      if (!isBasicEmail(normalized)) continue;
      const contact = contactByEmail.get(normalized);
      if (contact && isBlockedContactStatus(contact.status)) {
        blocked.push({
          email: display,
          reason: contact.status as MalichimpBlockedEmailReason,
        });
        continue;
      }
      if (suppressedEmails.has(normalized)) {
        blocked.push({ email: display, reason: 'suppressed' });
        continue;
      }
      if (!contact) {
        notFound.push(display);
        continue;
      }
      eligible.push({
        id: contact.id,
        email: contact.email,
        name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
      });
    }

    return {
      eligible,
      notFound,
      invalid,
      blocked,
      summary: {
        received,
        unique,
        eligible: eligible.length,
        notFound: notFound.length,
        invalid: invalid.length,
        blocked: blocked.length,
      },
    };
  }

  async getCampaignSetup() {
    const [groups, tags, senders] = await Promise.all([
      this.listGroups(),
      this.listTags(),
      this.emailSenders.list(NewsletterScope.malichimp),
    ]);
    return { groups, tags, senders, delivery: this.emailDelivery.status };
  }

  async listCampaigns(options?: { limit?: number | null }) {
    /** UI list stays capped; pass `limit: null` for full export. */
    const limit =
      options?.limit === null
        ? null
        : Math.min(Math.max(options?.limit ?? 200, 1), 5_000);
    const limitSql =
      limit == null ? Prisma.sql`` : Prisma.sql`LIMIT ${limit}`;

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
        metrics.*,
        campaign."scheduledAt",
        campaign."createdAt",
        campaign."completedAt",
        campaign."createdById",
        creator."name" AS "createdByName",
        creator."email" AS "createdByEmail"
      FROM (
        SELECT "id", "name", "newsletterId", "subjectSnapshot", "status", "totalRecipients",
          "sentCount", "errorCount", "scheduledAt", "createdAt", "completedAt", "createdById"
        FROM "EmailCampaign"
        WHERE "audienceArea" = 'malichimp'
        ORDER BY "createdAt" DESC, "id" DESC
        ${limitSql}
      ) campaign
      JOIN "Newsletter" newsletter ON newsletter."id" = campaign."newsletterId"
      LEFT JOIN "User" creator ON creator."id" = campaign."createdById"
      CROSS JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE send."status" = 'suppressed'::"EmailSendStatus") AS "suppressed",
          COUNT(*) FILTER (WHERE send."deliveredAt" IS NOT NULL) AS "delivered",
          COUNT(*) FILTER (WHERE send."bouncedAt" IS NOT NULL) AS "bounced",
          COUNT(*) FILTER (WHERE send."complainedAt" IS NOT NULL) AS "complaints",
          COUNT(*) FILTER (WHERE send."openedAt" IS NOT NULL) AS "opened",
          COUNT(*) FILTER (WHERE send."clickedAt" IS NOT NULL) AS "clicked",
          COUNT(*) FILTER (WHERE send."repliedAt" IS NOT NULL) AS "replied"
        FROM "EmailSend" send
        WHERE send."campaignId" = campaign."id" AND send."isTest" = false
      ) metrics
      ORDER BY campaign."createdAt" DESC, campaign."id" DESC
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
        workingNewsletter: {
          select: {
            id: true,
            title: true,
            subject: true,
            htmlBody: true,
            designJson: true,
            brand: true,
            status: true,
            contentRevision: true,
            updatedAt: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    const audience = (await this.describeAudiences([campaign])).get(campaign.id);
    const working = campaign.workingNewsletter;
    const filters = this.filtersFromCampaign(campaign);
    const includeContacts = filters.audienceMode === MALICHIMP_AUDIENCE_MODE.emails
      && filters.includeContactIds.length
      ? (campaign.status === EmailCampaignStatus.draft
          ? await this.resolveAudience(filters)
          : await this.prisma.malichimpContact.findMany({
              where: { id: { in: filters.includeContactIds } },
              select: { id: true, email: true, firstName: true, lastName: true },
              orderBy: { email: 'asc' },
            }))
          .map((contact) => ({ id: contact.id, email: contact.email, name: recipientName(contact) }))
      : undefined;
    return {
      id: campaign.id,
      name: campaign.name,
      newsletterId: campaign.newsletterId,
      workingNewsletterId: campaign.workingNewsletterId,
      newsletterTitle: working?.title ?? campaign.newsletter.title,
      libraryTitle: campaign.newsletter.title,
      audienceLabel: audience?.label ?? '',
      recipientSample: audience?.sample ?? [],
      newsletter: working
        ? {
            id: working.id,
            slug: campaign.newsletter.slug,
            title: working.title,
            subject: working.subject,
            htmlBody: working.htmlBody,
            status: working.status,
            createdAt: campaign.newsletter.createdAt,
            updatedAt: working.updatedAt,
          }
        : campaign.newsletter,
      libraryNewsletter: campaign.newsletter,
      contentRevision: working ? contentRevisionOf(working) : null,
      subject: campaign.status === EmailCampaignStatus.draft && working
        ? working.subject
        : campaign.subjectSnapshot,
      previewHtml:
        campaign.status === EmailCampaignStatus.draft && working
          ? working.htmlBody
          : campaign.htmlSnapshot,
      status: campaign.status,
      fromName: campaign.fromName ?? '',
      fromEmail: campaign.fromEmail ?? '',
      replyTo: campaign.replyToEmail ?? campaign.fromEmail ?? '',
      audienceMode: campaign.audienceMode,
      groupOptionIds: filters.groupOptionIds,
      excludeGroupOptionIds: filters.excludeGroupOptionIds,
      tagIds: filters.tagIds,
      excludeTagIds: filters.excludeTagIds,
      includeContactIds: filters.includeContactIds,
      excludeContactIds: filters.excludeContactIds,
      includeContacts,
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

  private sendScopeSql(scope: MalichimpSendScope = 'production') {
    if (scope === 'all') return Prisma.sql``;
    if (scope === 'test') return Prisma.sql`AND send."isTest" = true`;
    return Prisma.sql`AND send."isTest" = false`;
  }

  async getCampaignStats(
    id: string,
    days = 30,
    scope: MalichimpSendScope = 'production',
  ) {
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
    const scopeSql = this.sendScopeSql(scope);

    const [totals] = await this.prisma.$queryRaw<Array<{
      recipients: bigint;
      sent: bigint;
      failed: bigint;
      suppressed: bigint;
      delivered: bigint;
      bounced: bigint;
      complaints: bigint;
      opened: bigint;
      clicked: bigint;
      replied: bigint;
    }>>(Prisma.sql`
      SELECT
        COUNT(send."id") AS "recipients",
        COUNT(send."id") FILTER (WHERE send."status" = 'sent'::"EmailSendStatus") AS "sent",
        COUNT(send."id") FILTER (WHERE send."status" = 'failed'::"EmailSendStatus") AS "failed",
        COUNT(send."id") FILTER (WHERE send."status" = 'suppressed'::"EmailSendStatus") AS "suppressed",
        COUNT(send."id") FILTER (WHERE send."deliveredAt" IS NOT NULL) AS "delivered",
        COUNT(send."id") FILTER (WHERE send."bouncedAt" IS NOT NULL) AS "bounced",
        COUNT(send."id") FILTER (WHERE send."complainedAt" IS NOT NULL) AS "complaints",
        COUNT(send."id") FILTER (WHERE send."openedAt" IS NOT NULL) AS "opened",
        COUNT(send."id") FILTER (WHERE send."clickedAt" IS NOT NULL) AS "clicked",
        COUNT(send."id") FILTER (WHERE send."repliedAt" IS NOT NULL) AS "replied"
      FROM "EmailSend" send
      WHERE send."campaignId" = ${campaign.id}
      ${scopeSql}
    `);

    const openRows = await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
      SELECT to_char(send."openedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COUNT(send."id")::bigint AS count
      FROM "EmailSend" send
      WHERE send."campaignId" = ${campaign.id}
        AND send."openedAt" >= ${since}
        ${scopeSql}
      GROUP BY 1
      ORDER BY 1
    `);

    const clickRows = await this.prisma.$queryRaw<Array<{ day: string; count: bigint }>>(Prisma.sql`
      SELECT to_char(send."clickedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             COUNT(send."id")::bigint AS count
      FROM "EmailSend" send
      WHERE send."campaignId" = ${campaign.id}
        AND send."clickedAt" >= ${since}
        ${scopeSql}
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
    const scopedRecipients = Number(totals?.recipients ?? 0);

    const sent =
      scope === 'production'
        ? campaign.sentCount
        : Number(totals?.sent ?? 0);
    const failed =
      scope === 'production'
        ? campaign.errorCount
        : Number(totals?.failed ?? 0);
    // Production keeps the planned audience size; other scopes use sends in that scope.
    const totalRecipients =
      scope === 'production' ? campaign.totalRecipients : scopedRecipients;

    return {
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalRecipients,
      sent,
      failed,
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
      scope,
    };
  }

  async listCampaignSends(id: string, query: MalichimpCampaignSendsQueryDto) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');

    const event = (query.event ?? 'all') as MalichimpCampaignSendEvent;
    const scope = (query.scope ?? 'production') as MalichimpSendScope;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
    const q = query.q?.trim();

    const where: Prisma.EmailSendWhereInput = {
      campaignId: campaign.id,
      ...(scope === 'production'
        ? { isTest: false }
        : scope === 'test'
          ? { isTest: true }
          : {}),
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
          isTest: true,
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
      scope,
    };
  }

  async listTestRecipients(q?: string) {
    const query = q?.trim().toLowerCase() ?? '';
    const users = await this.googleAdmin.listRecentlyActiveInternalUsers(90);
    const filtered = query
      ? users.filter(
          (user) =>
            user.email.includes(query) ||
            user.name.toLowerCase().includes(query),
        )
      : users;
    return filtered.slice(0, 50).map((user) => ({
      email: user.email,
      name: user.name,
    }));
  }

  async sendTestCampaign(user: User, dto: SendMalichimpTestDto) {
    if (!this.emailDelivery.status.configured) {
      throw new BadRequestException('El motor SES todavía no está configurado');
    }

    const sessionEmail = user.email.trim().toLowerCase();
    if (!MALI_PE_EMAIL.test(sessionEmail)) {
      throw new BadRequestException('Tu usuario debe ser @mali.pe para enviar pruebas');
    }

    const emails = [
      ...new Set(
        [sessionEmail, ...dto.emails.map((email) => email.trim().toLowerCase())]
          .filter(Boolean),
      ),
    ];
    if (emails.length > 5) {
      throw new BadRequestException('Máximo 5 destinatarios de prueba');
    }
    for (const email of emails) {
      if (!MALI_PE_EMAIL.test(email)) {
        throw new BadRequestException(`Solo se permiten correos @mali.pe (${email})`);
      }
    }

    const fromEmail = dto.fromEmail.trim().toLowerCase();
    const replyTo = dto.replyTo.trim().toLowerCase();
    if (!MALI_PE_EMAIL.test(replyTo)) {
      throw new BadRequestException('La respuesta debe ser un correo @mali.pe');
    }
    await this.emailSenders.assertEnabled(fromEmail, NewsletterScope.malichimp);

    const subject = dto.subject.trim();
    const fromName = dto.fromName.trim();
    const name = dto.name.trim();
    let campaignId = dto.campaignId?.trim() || '';
    let workingHtml = '';

    if (campaignId) {
      workingHtml = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.emailCampaign.findFirst({
          where: { id: campaignId, audienceArea: 'malichimp' },
          select: {
            id: true,
            status: true,
            workingNewsletterId: true,
          },
        });
        if (!existing) throw new NotFoundException('Campaña no encontrada');
        if (existing.status !== EmailCampaignStatus.draft) {
          throw new ConflictException('Solo se pueden enviar pruebas desde un borrador');
        }
        if (!existing.workingNewsletterId) {
          throw new BadRequestException('La campaña no tiene contenido de trabajo');
        }
        const working = await this.newsletters.claimWorkingCopyRevision(
          tx,
          existing.workingNewsletterId,
          dto.contentRevision,
          { required: true, subject },
        );
        await tx.emailCampaign.update({
          where: { id: campaignId },
          data: {
            name,
            replyToEmail: replyTo,
            subjectSnapshot: subject,
            htmlSnapshot: working.htmlBody,
            designJsonSnapshot: working.designJson,
            brandSnapshot: working.brand,
            fromName,
            fromEmail,
            unsubscribePath: 'mail/unsubscribe',
            managedByDispatcher: false,
          },
        });
        return working.htmlBody;
      });
    } else {
      const library = await this.requireCampaignContentBase(dto.newsletterId, dto.contentRevision);
      campaignId = await this.prisma.$transaction(async (tx) => {
        const working = await this.newsletters.createWorkingCopy(tx, {
          userId: user.id,
          scope: NewsletterScope.malichimp,
          sourceNewsletterId: library.id,
          title: library.title,
          subject,
          htmlBody: library.htmlBody,
          designJson: library.designJson,
          brand: library.brand,
          slugBase: library.slug,
        });
        workingHtml = working.htmlBody;
        const created = await tx.emailCampaign.create({
          data: {
            newsletterId: library.id,
            workingNewsletterId: working.id,
            name,
            replyToEmail: replyTo,
            subjectSnapshot: subject,
            htmlSnapshot: working.htmlBody,
            designJsonSnapshot: working.designJson,
            brandSnapshot: working.brand,
            fromName,
            fromEmail,
            unsubscribePath: 'mail/unsubscribe',
            managedByDispatcher: false,
            status: EmailCampaignStatus.draft,
            audienceArea: 'malichimp',
            audienceSegments: [],
            audienceExcludeSegments: [],
            totalRecipients: 0,
            createdById: user.id,
          },
        });
        return created.id;
      });
    }

    const directoryUsers = await this.googleAdmin
      .listRecentlyActiveInternalUsers(90)
      .catch(() => []);
    const directoryByEmail = new Map(
      directoryUsers.map((entry) => [entry.email, entry] as const),
    );

    const sends: Array<{
      id: string;
      email: string;
      status: string;
      error: string | null;
    }> = [];

    for (const email of emails) {
      const directoryUser = directoryByEmail.get(email);
      const displayName =
        directoryUser?.name ||
        (email === sessionEmail ? user.name : email.split('@')[0]);
      const names = {
        firstName: directoryUser?.firstName ?? (!directoryUser?.lastName ? firstNameFromDisplayName(displayName) : null),
        lastName: directoryUser?.lastName ?? null,
      };
      const send = await this.prisma.emailSend.create({
        data: {
          campaignId,
          email,
          name: displayName,
          ...names,
          isTest: true,
          status: EmailSendStatus.pending,
        },
      });

      try {
        const personalizedSubject = applyEmailMergeTags(subject, names);
        const personalizedHtml = applyEmailMergeTags(workingHtml, names, { html: true });
        const viewInBrowserUrl = this.emailTracking.publicUrl(
          `mail/view/${send.openToken}`,
        );
        const result = await this.emailDelivery.sendHtml({
          to: email,
          subject: `[PRUEBA] ${personalizedSubject}`,
          html: this.emailTracking.inject(
            personalizedHtml,
            send.openToken,
            undefined,
            viewInBrowserUrl,
          ),
          fromName,
          fromEmail,
          replyTo: replyToWithSendToken(replyTo, send.id),
          tags: {
            source: 'malichimp',
            campaign: campaignId,
            send: send.id,
            test: '1',
          },
        });
        await this.prisma.emailSend.update({
          where: { id: send.id },
          data: {
            status: EmailSendStatus.sent,
            sesMessageId: result.messageId,
            sentAt: new Date(),
            error: null,
          },
        });
        sends.push({ id: send.id, email, status: 'sent', error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error de envío';
        await this.prisma.emailSend.update({
          where: { id: send.id },
          data: {
            status: EmailSendStatus.failed,
            error: message.slice(0, 1000),
          },
        });
        sends.push({ id: send.id, email, status: 'failed', error: message });
      }
    }

    return { campaignId, sends };
  }

  async exportCampaignsXlsx(campaignIds?: string[]) {
    const ids = (campaignIds ?? []).map((id) => id.trim()).filter(Boolean);
    const campaigns = await this.listCampaigns({ limit: null });
    const rows = ids.length
      ? campaigns.filter((campaign) => ids.includes(campaign.id))
      : campaigns;
    if (ids.length && !rows.length) {
      throw new BadRequestException('No se encontraron campañas para exportar');
    }

    const details = rows.length
      ? await this.prisma.emailCampaign.findMany({
          where: { id: { in: rows.map((campaign) => campaign.id) } },
          select: {
            id: true,
            fromName: true,
            fromEmail: true,
            status: true,
            audienceMode: true,
            audienceSegments: true,
            audienceExcludeSegments: true,
            audienceIncludeContactIds: true,
            audienceExcludeContactIds: true,
            totalRecipients: true,
          },
        })
      : [];
    const audienceById = await this.describeAudiences(details);
    const senderById = new Map(details.map((campaign) => [campaign.id, campaign]));

    const pct = (num: number, den: number) =>
      den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

    const buffer = await buildTreasuryXlsx(
      'Campañas',
      [
        { key: 'name', header: 'Campaña', width: 32 },
        { key: 'subject', header: 'Asunto', width: 36 },
        { key: 'newsletterTitle', header: 'Boletín', width: 32 },
        { key: 'from', header: 'De', width: 36 },
        { key: 'audience', header: 'Para', width: 48 },
        { key: 'sample', header: 'Muestra', width: 36 },
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
      rows.map((campaign) => {
        const sender = senderById.get(campaign.id);
        const fromName = sender?.fromName?.trim() ?? '';
        const fromEmail = sender?.fromEmail?.trim() ?? '';
        const audience = audienceById.get(campaign.id);
        return {
          name: campaign.name,
          subject: campaign.subject,
          newsletterTitle: campaign.newsletterTitle,
          from: fromName && fromEmail
            ? `${fromName} <${fromEmail}>`
            : fromName || fromEmail,
          audience: audience?.label ?? '',
          sample: (audience?.sample ?? []).map((recipient) => recipient.email).join(', '),
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
        };
      }),
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
            id: true,
            slug: true,
            title: true,
            htmlBody: true,
            designJson: true,
            brand: true,
          },
        },
        workingNewsletter: {
          select: {
            htmlBody: true,
            designJson: true,
            brand: true,
            title: true,
            subject: true,
          },
        },
      },
    });
    if (!source) throw new NotFoundException('Campaña no encontrada');

    const fromWorking =
      source.status === EmailCampaignStatus.draft && source.workingNewsletter
        ? {
            html: source.workingNewsletter.htmlBody,
            designJson: source.workingNewsletter.designJson,
            brand: source.workingNewsletter.brand,
            title: source.workingNewsletter.title,
            subject: source.workingNewsletter.subject,
          }
        : {
            html: source.htmlSnapshot,
            designJson:
              source.designJsonSnapshot ??
              (source.htmlSnapshot === source.newsletter.htmlBody
                ? source.newsletter.designJson
                : null),
            brand: source.brandSnapshot ?? source.newsletter.brand,
            title: source.newsletter.title,
            subject: source.subjectSnapshot,
          };

    const sourceFilters = this.filtersFromCampaign(source);
    const audienceFields = this.audiencePersistFields(sourceFilters);
    const recipients = await this.resolveAudience(sourceFilters);
    const draftId = await this.prisma.$transaction(async (tx) => {
      const working = await this.newsletters.createWorkingCopy(tx, {
        userId,
        scope: NewsletterScope.malichimp,
        sourceNewsletterId: source.newsletterId,
        title: duplicateLabel(fromWorking.title, 200),
        subject: fromWorking.subject,
        htmlBody: fromWorking.html,
        designJson: fromWorking.designJson,
        brand: fromWorking.brand,
        slugBase: source.newsletter.slug,
      });
      const draft = await tx.emailCampaign.create({
        data: {
          newsletterId: source.newsletterId,
          workingNewsletterId: working.id,
          name: duplicateLabel(source.name, 160),
          replyToEmail: source.replyToEmail,
          subjectSnapshot: fromWorking.subject.slice(0, 300),
          htmlSnapshot: fromWorking.html,
          designJsonSnapshot: fromWorking.designJson,
          brandSnapshot: fromWorking.brand,
          fromName: source.fromName,
          fromEmail: source.fromEmail,
          unsubscribePath: 'mail/unsubscribe',
          managedByDispatcher: false,
          status: EmailCampaignStatus.draft,
          audienceArea: 'malichimp',
          ...audienceFields,
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
        workingNewsletterId: true,
        workingNewsletter: { select: { id: true, kind: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaña no encontrada');
    if (campaign.status !== EmailCampaignStatus.draft) {
      throw new BadRequestException(
        'Solo se pueden eliminar campañas en borrador',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const workingId = campaign.workingNewsletterId;
      const deleted = await tx.emailCampaign.deleteMany({
        where: { id: campaign.id, status: EmailCampaignStatus.draft },
      });
      if (!deleted.count) throw new ConflictException('Esta campaña ya no es un borrador');
      if (
        workingId &&
        campaign.workingNewsletter?.kind === 'campaign_working_copy'
      ) {
        await tx.newsletter.delete({ where: { id: workingId } }).catch(() => undefined);
      }
    });

    return { ok: true as const };
  }

  private async prepareAudienceAndSender(dto: SaveMalichimpDraftDto) {
    const filters = await this.normalizeAudience(dto);
    const fromEmail = dto.fromEmail.trim().toLowerCase();
    const replyTo = dto.replyTo.trim().toLowerCase();
    if (!MALI_PE_EMAIL.test(replyTo)) {
      throw new BadRequestException('La respuesta debe ser un correo @mali.pe');
    }
    await this.emailSenders.assertEnabled(fromEmail, NewsletterScope.malichimp);
    const recipients = await this.resolveAudience(filters);
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    return { filters, fromEmail, replyTo, recipients, scheduledAt };
  }

  private async prepareConfirmedSend(dto: CreateMalichimpCampaignDto) {
    if (!this.emailDelivery.status.configured) {
      throw new BadRequestException('El motor SES todavía no está configurado');
    }
    const prepared = await this.prepareAudienceAndSender(dto);
    if (audienceRevisionOf(prepared.recipients) !== dto.audienceRevision) {
      throw new ConflictException({
        code: 'MALICHIMP_AUDIENCE_CHANGED',
        message: 'La audiencia cambió. Revisa los destinatarios y confirma nuevamente.',
      });
    }
    if (!prepared.recipients.length) {
      throw new BadRequestException('La segmentación no tiene destinatarios elegibles');
    }
    if (prepared.scheduledAt && prepared.scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('La programación debe usar una fecha y hora futuras');
    }
    return prepared;
  }

  /** Accepts only MALICHIMP module library as campaign base. */
  private async requireCampaignContentBase(newsletterId: string, contentRevision?: string) {
    const newsletter = await this.prisma.newsletter.findFirst({
      where: {
        id: newsletterId,
        ...moduleLibraryListWhere(NewsletterScope.malichimp),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        subject: true,
        htmlBody: true,
        designJson: true,
        brand: true,
        status: true,
        scope: true,
        contentRevision: true,
        updatedAt: true,
      },
    });
    if (!newsletter) {
      throw new BadRequestException(
        'Selecciona un contenido de la biblioteca MALICHIMP',
      );
    }
    this.newsletters.assertContentRevision(newsletter, contentRevision);
    return newsletter;
  }

  private createCampaignWorkingCopy(
    tx: Prisma.TransactionClient,
    userId: string,
    library: Awaited<ReturnType<MalichimpService['requireCampaignContentBase']>>,
    subject: string,
  ) {
    return this.newsletters.createWorkingCopy(tx, {
      userId,
      scope: NewsletterScope.malichimp,
      sourceNewsletterId: library.id,
      title: library.title,
      subject,
      htmlBody: library.htmlBody,
      designJson: library.designJson,
      brand: library.brand,
      slugBase: library.slug,
    });
  }

  async saveDraftCampaign(userId: string, dto: SaveMalichimpDraftDto, id?: string) {
    const prepared = await this.prepareAudienceAndSender(dto);
    const library = id
      ? null
      : await this.requireCampaignContentBase(dto.newsletterId, dto.contentRevision);
    const draftId = await this.prisma.$transaction(async (tx) => {
      const working = library
        ? await this.createCampaignWorkingCopy(tx, userId, library, dto.subject.trim())
        : await this.claimDraftContent(tx, id!, dto);
      const data = {
        name: dto.name.trim(),
        replyToEmail: prepared.replyTo,
        subjectSnapshot: dto.subject.trim(),
        htmlSnapshot: working.htmlBody,
        designJsonSnapshot: working.designJson,
        brandSnapshot: working.brand,
        fromName: dto.fromName.trim(),
        fromEmail: prepared.fromEmail,
        unsubscribePath: 'mail/unsubscribe',
        ...this.audiencePersistFields(prepared.filters),
        totalRecipients: prepared.recipients.length,
        scheduledAt: prepared.scheduledAt,
      };
      if (library) {
        const draft = await tx.emailCampaign.create({
          data: {
            ...data,
            newsletterId: library.id,
            workingNewsletterId: working.id,
            status: EmailCampaignStatus.draft,
            audienceArea: 'malichimp',
            createdById: userId,
          },
        });
        return draft.id;
      }
      const updated = await tx.emailCampaign.updateMany({
        where: { id, status: EmailCampaignStatus.draft },
        data,
      });
      if (!updated.count) throw new ConflictException('Esta campaña ya no es un borrador');
      return id!;
    });
    return this.getCampaign(draftId);
  }

  async createCampaign(userId: string, dto: CreateMalichimpCampaignDto) {
    const prepared = await this.prepareConfirmedSend(dto);
    const library = await this.requireCampaignContentBase(dto.newsletterId, dto.contentRevision);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const working = await this.createCampaignWorkingCopy(tx, userId, library, dto.subject.trim());
      const created = await tx.emailCampaign.create({
        data: {
          newsletterId: library.id,
          workingNewsletterId: working.id,
          name: dto.name.trim(),
          replyToEmail: prepared.replyTo,
          subjectSnapshot: working.subject.slice(0, 300),
          htmlSnapshot: working.htmlBody,
          designJsonSnapshot: working.designJson,
          brandSnapshot: working.brand,
          fromName: dto.fromName.trim(),
          fromEmail: prepared.fromEmail,
          unsubscribePath: 'mail/unsubscribe',
          managedByDispatcher: true,
          status: prepared.scheduledAt
            ? EmailCampaignStatus.scheduled
            : EmailCampaignStatus.queued,
          audienceArea: 'malichimp',
          ...this.audiencePersistFields(prepared.filters),
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
            name: recipientName(recipient),
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            isTest: false,
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

  private async claimDraftContent(
    tx: Prisma.TransactionClient,
    id: string,
    dto: SaveMalichimpDraftDto,
  ) {
    const draft = await tx.emailCampaign.findFirst({
      where: { id, audienceArea: 'malichimp' },
      select: {
        status: true,
        newsletterId: true,
        workingNewsletterId: true,
      },
    });
    if (!draft) throw new NotFoundException('Campaña no encontrada');
    if (draft.status !== EmailCampaignStatus.draft) {
      throw new ConflictException('Esta campaña ya no es un borrador');
    }
    if (!draft.workingNewsletterId) {
      throw new BadRequestException('La campaña no tiene contenido de trabajo');
    }
    if (dto.newsletterId !== draft.newsletterId && dto.newsletterId !== draft.workingNewsletterId) {
      throw new BadRequestException('El contenido de la campaña no coincide');
    }
    return this.newsletters.claimWorkingCopyRevision(tx, draft.workingNewsletterId, dto.contentRevision, {
      required: true,
      subject: dto.subject.trim(),
    });
  }

  async sendDraftCampaign(id: string, dto: CreateMalichimpCampaignDto) {
    const prepared = await this.prepareConfirmedSend(dto);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const freshWorking = await this.claimDraftContent(tx, id, dto);
      const updated = await tx.emailCampaign.updateMany({
        where: { id, status: EmailCampaignStatus.draft },
        data: {
          name: dto.name.trim(),
          replyToEmail: prepared.replyTo,
          subjectSnapshot: dto.subject.trim(),
          htmlSnapshot: freshWorking.htmlBody,
          designJsonSnapshot: freshWorking.designJson,
          brandSnapshot: freshWorking.brand,
          fromName: dto.fromName.trim(),
          fromEmail: prepared.fromEmail,
          unsubscribePath: 'mail/unsubscribe',
          managedByDispatcher: true,
          status: prepared.scheduledAt
            ? EmailCampaignStatus.scheduled
            : EmailCampaignStatus.queued,
          ...this.audiencePersistFields(prepared.filters),
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
            name: recipientName(recipient),
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            isTest: false,
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

  async cancelCampaign(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.emailCampaign.updateMany({
        where: {
          id,
          audienceArea: 'malichimp',
          scheduledAt: { not: null },
          status: { in: [EmailCampaignStatus.scheduled, EmailCampaignStatus.queued] },
        },
        data: { status: EmailCampaignStatus.cancelled, completedAt: new Date() },
      });
      if (!changed.count) {
        const campaign = await tx.emailCampaign.findFirst({
          where: { id, audienceArea: 'malichimp' },
          select: { status: true },
        });
        if (!campaign) throw new NotFoundException('Campaña no encontrada');
        if (campaign.status === EmailCampaignStatus.cancelled) return { ok: true as const };
        throw new ConflictException('Solo se puede cancelar una programación antes de iniciar su envío');
      }
      await tx.emailSend.updateMany({
        where: { campaignId: id, status: EmailSendStatus.pending, isTest: false },
        data: {
          status: EmailSendStatus.suppressed,
          claimedAt: null,
          nextAttemptAt: null,
          error: 'Campaña cancelada antes del envío',
        },
      });
      return { ok: true as const };
    });
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

  private audiencePersistFields(filters: NormalizedAudience) {
    if (filters.audienceMode === MALICHIMP_AUDIENCE_MODE.tags) {
      return {
        audienceMode: MALICHIMP_AUDIENCE_MODE.tags,
        audienceSegments: filters.tagIds,
        audienceExcludeSegments: filters.excludeTagIds,
        audienceIncludeContactIds: filters.includeContactIds,
        audienceExcludeContactIds: filters.excludeContactIds,
      };
    }
    if (filters.audienceMode === MALICHIMP_AUDIENCE_MODE.emails) {
      return {
        audienceMode: MALICHIMP_AUDIENCE_MODE.emails,
        audienceSegments: [] as string[],
        audienceExcludeSegments: [] as string[],
        audienceIncludeContactIds: filters.includeContactIds,
        audienceExcludeContactIds: [] as string[],
      };
    }
    return {
      audienceMode: MALICHIMP_AUDIENCE_MODE.groups,
      audienceSegments: filters.groupOptionIds,
      audienceExcludeSegments: filters.excludeGroupOptionIds,
      audienceIncludeContactIds: filters.includeContactIds,
      audienceExcludeContactIds: filters.excludeContactIds,
    };
  }

  private async describeAudiences(
    campaigns: Array<{
      id: string;
      totalRecipients: number;
      audienceMode: string | null;
      audienceSegments: string[];
      audienceExcludeSegments: string[];
      audienceIncludeContactIds: string[];
      audienceExcludeContactIds: string[];
    }>,
  ) {
    const described = new Map<string, {
      label: string;
      sample: Array<{ email: string; name: string | null }>;
    }>();
    if (!campaigns.length) return described;

    const filters = campaigns.map((campaign) => ({
      id: campaign.id,
      totalRecipients: campaign.totalRecipients,
      filters: this.filtersFromCampaign(campaign),
    }));
    const groupIds = new Set<string>();
    const tagIds = new Set<string>();
    const contactIds = new Set<string>();
    for (const row of filters) {
      for (const id of row.filters.groupOptionIds) groupIds.add(id);
      for (const id of row.filters.tagIds) tagIds.add(id);
      if (row.filters.audienceMode === MALICHIMP_AUDIENCE_MODE.emails) {
        for (const id of row.filters.includeContactIds) contactIds.add(id);
      }
    }

    const [optionsRows, tags, contacts, samples] = await Promise.all([
      groupIds.size
        ? this.prisma.malichimpGroupOption.findMany({
            where: { id: { in: [...groupIds] } },
            select: { id: true, name: true, group: { select: { name: true } } },
          })
        : [],
      tagIds.size
        ? this.prisma.malichimpTag.findMany({
            where: { id: { in: [...tagIds] } },
            select: { id: true, name: true },
          })
        : [],
      contactIds.size
        ? this.prisma.malichimpContact.findMany({
            where: { id: { in: [...contactIds] } },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : [],
      this.prisma.$queryRaw<Array<{
        campaignId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      }>>(Prisma.sql`
        SELECT ranked."campaignId", ranked."email", ranked."firstName", ranked."lastName"
        FROM (
          SELECT
            send."campaignId",
            send."email",
            send."firstName",
            send."lastName",
            row_number() OVER (PARTITION BY send."campaignId" ORDER BY send."email") AS rn
          FROM "EmailSend" send
          WHERE send."isTest" = false
            AND send."campaignId" IN (${Prisma.join(campaigns.map((campaign) => campaign.id))})
        ) ranked
        WHERE ranked.rn <= 5
        ORDER BY ranked."campaignId", ranked."email"
      `),
    ]);

    const optionLabel = new Map(optionsRows.map((option) => [
      option.id,
      `${option.group.name}: ${option.name}`,
    ]));
    const tagLabel = new Map(tags.map((tag) => [tag.id, tag.name]));
    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
    const sampleByCampaign = new Map<string, Array<{ email: string; name: string | null }>>();
    for (const row of samples) {
      const list = sampleByCampaign.get(row.campaignId) ?? [];
      const name = [row.firstName, row.lastName].filter(Boolean).join(' ');
      list.push({ email: row.email, name: name || null });
      sampleByCampaign.set(row.campaignId, list);
    }

    const named = (ids: string[], labels: Map<string, string>) =>
      ids.flatMap((id) => {
        const label = labels.get(id);
        return label ? [label] : [];
      });

    for (const row of filters) {
      const mode = row.filters.audienceMode;
      const included = mode === MALICHIMP_AUDIENCE_MODE.tags
        ? named(row.filters.tagIds, tagLabel)
        : mode === MALICHIMP_AUDIENCE_MODE.groups
          ? named(row.filters.groupOptionIds, optionLabel)
          : [];
      let sample = sampleByCampaign.get(row.id) ?? [];
      if (!sample.length && mode === MALICHIMP_AUDIENCE_MODE.emails) {
        sample = row.filters.includeContactIds.slice(0, 5).flatMap((id) => {
          const contact = contactById.get(id);
          return contact
            ? [{ email: contact.email, name: recipientName(contact) }]
            : [];
        });
      }
      described.set(row.id, {
        label: formatMalichimpAudienceLabel({
          audienceMode: mode,
          included,
          recipientCount: row.totalRecipients,
        }),
        sample,
      });
    }
    return described;
  }

  private filtersFromCampaign(campaign: {
    audienceMode: string | null;
    audienceSegments: string[];
    audienceExcludeSegments: string[];
    audienceIncludeContactIds: string[];
    audienceExcludeContactIds: string[];
  }): NormalizedAudience {
    const audienceMode = resolveMalichimpAudienceMode(campaign.audienceMode);
    if (audienceMode === MALICHIMP_AUDIENCE_MODE.tags) {
      return {
        audienceMode,
        groupOptionIds: [],
        excludeGroupOptionIds: [],
        tagIds: campaign.audienceSegments,
        excludeTagIds: campaign.audienceExcludeSegments,
        includeContactIds: campaign.audienceIncludeContactIds,
        excludeContactIds: campaign.audienceExcludeContactIds,
      };
    }
    if (audienceMode === MALICHIMP_AUDIENCE_MODE.emails) {
      return {
        audienceMode,
        groupOptionIds: [],
        excludeGroupOptionIds: [],
        tagIds: [],
        excludeTagIds: [],
        includeContactIds: campaign.audienceIncludeContactIds,
        excludeContactIds: [],
      };
    }
    return {
      audienceMode: MALICHIMP_AUDIENCE_MODE.groups,
      groupOptionIds: campaign.audienceSegments,
      excludeGroupOptionIds: campaign.audienceExcludeSegments,
      tagIds: [],
      excludeTagIds: [],
      includeContactIds: campaign.audienceIncludeContactIds,
      excludeContactIds: campaign.audienceExcludeContactIds,
    };
  }

  private async normalizeAudience(dto: MalichimpAudienceDto): Promise<NormalizedAudience> {
    const audienceMode = resolveMalichimpAudienceMode(dto.audienceMode);
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

    if (audienceMode === MALICHIMP_AUDIENCE_MODE.emails) {
      if (excludeContactIds.length) {
        throw new BadRequestException(
          'El modo por correos no admite exclusiones de contactos',
        );
      }
      if (!includeContactIds.length) {
        throw new BadRequestException('Indica al menos un contacto en la audiencia');
      }
      const hasSegments =
        (dto.groupOptionIds?.length ?? 0) > 0 ||
        (dto.excludeGroupOptionIds?.length ?? 0) > 0 ||
        (dto.tagIds?.length ?? 0) > 0 ||
        (dto.excludeTagIds?.length ?? 0) > 0;
      if (hasSegments) {
        throw new BadRequestException(
          'El modo por correos no admite segmentos por grupos o etiquetas',
        );
      }
      return {
        audienceMode,
        groupOptionIds: [],
        excludeGroupOptionIds: [],
        tagIds: [],
        excludeTagIds: [],
        excludeContactIds: [],
        includeContactIds,
      };
    }

    if (includeContactIds.length && excludeContactIds.length) {
      throw new BadRequestException(
        'Usa solo exclusiones o solo inclusiones de contactos, no ambas',
      );
    }

    if (audienceMode === MALICHIMP_AUDIENCE_MODE.tags) {
      const [included, excluded] = await Promise.all([
        this.validateTagIds(dto.tagIds ?? []),
        this.validateTagIds(dto.excludeTagIds ?? [], false),
      ]);
      const tagIds = included;
      const excludeTagIds = excluded;
      const includedIds = new Set(tagIds);
      if (excludeTagIds.some((id) => includedIds.has(id))) {
        throw new BadRequestException(
          'Una etiqueta no puede estar incluida y excluida a la vez',
        );
      }
      return {
        audienceMode,
        groupOptionIds: [],
        excludeGroupOptionIds: [],
        tagIds,
        excludeTagIds,
        excludeContactIds,
        includeContactIds,
      };
    }

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
    return {
      audienceMode,
      groupOptionIds,
      excludeGroupOptionIds,
      tagIds: [],
      excludeTagIds: [],
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

  private async validateTagIds(tagIds: string[], required = true) {
    const normalizedIds = [
      ...new Set(tagIds.map((id) => id.trim()).filter(Boolean)),
    ];
    if (!normalizedIds.length && required) {
      throw new BadRequestException('Selecciona al menos una etiqueta');
    }
    if (!normalizedIds.length) return [];
    const existing = await this.prisma.malichimpTag.findMany({
      where: { id: { in: normalizedIds } },
      select: { id: true },
    });
    const known = new Set(existing.map((tag) => tag.id));
    if (normalizedIds.some((id) => !known.has(id))) {
      throw new BadRequestException('La audiencia contiene etiquetas que ya no existen');
    }
    return normalizedIds;
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

  private audienceWhere(filters: NormalizedAudience): Prisma.Sql {
    if (filters.audienceMode === MALICHIMP_AUDIENCE_MODE.emails) {
      return Prisma.sql`
        ${MALICHIMP_ELIGIBLE_CONTACT_SQL}
        AND contact."id" IN (${Prisma.join(filters.includeContactIds)})
      `;
    }

    const contactExclusion = filters.excludeContactIds.length
      ? Prisma.sql`
        AND contact."id" NOT IN (${Prisma.join(filters.excludeContactIds)})
      `
      : Prisma.sql``;
    const contactInclusion = filters.includeContactIds.length
      ? Prisma.sql`
        AND contact."id" IN (${Prisma.join(filters.includeContactIds)})
      `
      : Prisma.sql``;

    if (filters.audienceMode === MALICHIMP_AUDIENCE_MODE.tags) {
      const tagExclusion = filters.excludeTagIds.length
        ? Prisma.sql`
          AND NOT EXISTS (
            SELECT 1
            FROM "MalichimpContactTag" excluded_membership
            WHERE excluded_membership."contactId" = contact."id"
              AND excluded_membership."tagId" IN (${Prisma.join(filters.excludeTagIds)})
          )
        `
        : Prisma.sql``;
      return Prisma.sql`
        ${MALICHIMP_ELIGIBLE_CONTACT_SQL}
        AND EXISTS (
          SELECT 1
          FROM "MalichimpContactTag" membership
          WHERE membership."contactId" = contact."id"
            AND membership."tagId" IN (${Prisma.join(filters.tagIds)})
        )
        ${tagExclusion}
        ${contactExclusion}
        ${contactInclusion}
      `;
    }

    const groupExclusion = filters.excludeGroupOptionIds.length
      ? Prisma.sql`
        AND NOT EXISTS (
          SELECT 1
          FROM "MalichimpContactGroupOption" excluded_membership
          WHERE excluded_membership."contactId" = contact."id"
            AND excluded_membership."optionId" IN (${Prisma.join(filters.excludeGroupOptionIds)})
        )
      `
      : Prisma.sql``;
    return Prisma.sql`
      ${MALICHIMP_ELIGIBLE_CONTACT_SQL}
      AND EXISTS (
        SELECT 1
        FROM "MalichimpContactGroupOption" membership
        WHERE membership."contactId" = contact."id"
          AND membership."optionId" IN (${Prisma.join(filters.groupOptionIds)})
      )
      ${groupExclusion}
      ${contactExclusion}
      ${contactInclusion}
    `;
  }

  private resolveAudience(filters: NormalizedAudience) {
    const where = this.audienceWhere(filters);
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
