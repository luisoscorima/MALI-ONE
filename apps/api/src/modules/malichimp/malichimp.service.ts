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
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import {
  applyMalichimpFiles,
  inspectMalichimpFiles,
  locateMalichimpFiles,
  type MalichimpImportReport,
  type MalichimpLocatedFile,
} from './lib/malichimp-import-runner';
import { extractMailchimpZip } from './lib/mailchimp-zip';
import { MalichimpContactsQueryDto } from './dto/malichimp-query.dto';
import {
  CreateMalichimpCampaignDto,
  MalichimpAudienceDto,
} from './dto/malichimp-campaign.dto';
import { NewslettersService } from '../newsletters/newsletters.service';

type ImportPreview = {
  id: string;
  userId: string;
  originalName: string;
  directory: string;
  files: MalichimpLocatedFile[];
  report: MalichimpImportReport;
  expiresAt: Date;
};

type AudienceRecipient = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

const PREVIEW_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class MalichimpService implements OnModuleInit {
  private readonly logger = new Logger(MalichimpService.name);
  private readonly previews = new Map<string, ImportPreview>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: EmailDeliveryService,
    private readonly newsletters: NewslettersService,
  ) {}

  async onModuleInit() {
    void this.cleanupOrphanDirectories();
    await this.prisma.malichimpImportJob.updateMany({
      where: { status: { in: ['queued', 'running'] } },
      data: {
        status: 'failed',
        error: 'La API se reinició durante la importación. Verifica la audiencia antes de volver a importar el ZIP.',
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
    const where: Prisma.MalichimpContactWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(groupOptionId
        ? { groupOptions: { some: { optionId: groupOptionId } } }
        : {}),
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
      items: items.map(({ tags, groupOptions, ...contact }) => ({
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
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
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

  async previewAudience(dto: MalichimpAudienceDto) {
    const filters = await this.normalizeAudience(dto);
    const where = this.audienceWhere(filters.groupOptionIds);
    const [subscribed, eligible, sample] = await Promise.all([
      this.prisma.malichimpContact.count({
        where: { status: MalichimpContactStatus.subscribed },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM "MalichimpContact" contact WHERE ${where}
      `),
      this.prisma.$queryRaw<AudienceRecipient[]>(Prisma.sql`
        SELECT contact."id", contact."email", contact."firstName", contact."lastName"
        FROM "MalichimpContact" contact
        WHERE ${where}
        ORDER BY contact."lastName" NULLS LAST, contact."firstName" NULLS LAST, contact."email"
        LIMIT 10
      `),
    ]);
    const total = Number(eligible[0].count);
    return {
      subscribed,
      eligible: total,
      excluded: Math.max(0, subscribed - total),
      groupOptionIds: filters.groupOptionIds,
      sample: sample.map((contact) => ({
        id: contact.id,
        email: contact.email,
        name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null,
      })),
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
      scheduledAt: Date | null;
      createdAt: Date;
      completedAt: Date | null;
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
        campaign."scheduledAt",
        campaign."createdAt",
        campaign."completedAt"
      FROM "EmailCampaign" campaign
      JOIN "Newsletter" newsletter ON newsletter."id" = campaign."newsletterId"
      LEFT JOIN "EmailSend" send ON send."campaignId" = campaign."id"
      WHERE campaign."audienceArea" = 'malichimp'
      GROUP BY campaign."id", newsletter."title"
      ORDER BY campaign."createdAt" DESC
      LIMIT 50
    `);
    return rows.map((row) => ({
      ...row,
      delivered: Number(row.delivered),
      suppressed: Number(row.suppressed),
      bounced: Number(row.bounced),
      complaints: Number(row.complaints),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
    }));
  }

  async createCampaign(userId: string, dto: CreateMalichimpCampaignDto) {
    if (!this.emailDelivery.status.configured) {
      throw new BadRequestException('El motor SES todavía no está configurado');
    }
    const filters = await this.normalizeAudience(dto);
    const newsletter = await this.prisma.newsletter.findFirst({
      where: { id: dto.newsletterId, status: NewsletterStatus.published },
      select: { id: true, subject: true, htmlBody: true },
    });
    if (!newsletter) throw new BadRequestException('Selecciona un boletín publicado');

    const recipients = await this.resolveAudience(filters.groupOptionIds);
    if (!recipients.length) {
      throw new BadRequestException('Los grupos seleccionados no tienen destinatarios elegibles');
    }

    const requestedSchedule = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    const scheduledAt = requestedSchedule && requestedSchedule.getTime() > Date.now()
      ? requestedSchedule
      : null;
    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.emailCampaign.create({
        data: {
          newsletterId: newsletter.id,
          name: dto.name.trim(),
          replyToEmail: dto.replyTo.trim().toLowerCase(),
          subjectSnapshot: newsletter.subject,
          htmlSnapshot: newsletter.htmlBody,
          fromName: 'MALI',
          unsubscribePath: 'mail/unsubscribe',
          managedByDispatcher: true,
          status: scheduledAt
            ? EmailCampaignStatus.scheduled
            : EmailCampaignStatus.queued,
          audienceArea: 'malichimp',
          audienceSegments: filters.groupOptionIds,
          audienceExcludeSegments: [],
          totalRecipients: recipients.length,
          scheduledAt,
          createdById: userId,
        },
      });
      for (let index = 0; index < recipients.length; index += 1_000) {
        await tx.emailSend.createMany({
          data: recipients.slice(index, index + 1_000).map((recipient) => ({
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

    const directory = await mkdtemp(path.join(tmpdir(), 'mali-one-malichimp-'));
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
      const preview: ImportPreview = {
        id: randomUUID(),
        userId,
        originalName: file.originalname.slice(0, 240),
        directory,
        files,
        report,
        expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
      };
      this.previews.set(preview.id, preview);
      return {
        previewId: preview.id,
        fileName: preview.originalName,
        report,
        expiresAt: preview.expiresAt,
        previouslyImported: previous,
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo procesar el ZIP',
      );
    }
  }

  async startZipImport(userId: string, previewId: string) {
    await this.cleanupExpiredPreviews();
    const preview = this.previews.get(previewId);
    if (!preview || preview.userId !== userId) {
      throw new NotFoundException('La vista previa expiró; vuelve a subir el ZIP');
    }
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
    const groupOptionIds = [
      ...new Set((dto.groupOptionIds ?? []).map((id) => id.trim()).filter(Boolean)),
    ];
    if (!groupOptionIds.length) {
      throw new BadRequestException('Selecciona al menos una opción de grupo');
    }
    const existing = await this.prisma.malichimpGroupOption.findMany({
      where: { id: { in: groupOptionIds } },
      select: { id: true },
    });
    const known = new Set(existing.map((option) => option.id));
    if (groupOptionIds.some((id) => !known.has(id))) {
      throw new BadRequestException('La audiencia contiene opciones de grupo que ya no existen');
    }
    return { groupOptionIds };
  }

  private audienceWhere(groupOptionIds: string[]): Prisma.Sql {
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
    `;
  }

  private resolveAudience(groupOptionIds: string[]) {
    const where = this.audienceWhere(groupOptionIds);
    return this.prisma.$queryRaw<AudienceRecipient[]>(Prisma.sql`
      SELECT contact."id", contact."email", contact."firstName", contact."lastName"
      FROM "MalichimpContact" contact
      WHERE ${where}
      ORDER BY contact."id"
    `);
  }

  private async runImport(job: MalichimpImportJob, preview: ImportPreview) {
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
      await rm(preview.directory, { recursive: true, force: true });
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
    const expired = [...this.previews.values()].filter(
      (preview) => preview.expiresAt.getTime() <= now,
    );
    await Promise.all(
      expired.map(async (preview) => {
        this.previews.delete(preview.id);
        await rm(preview.directory, { recursive: true, force: true });
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
              entry.isDirectory() && entry.name.startsWith('mali-one-malichimp-'),
          )
          .map(async (entry) => {
            const directory = path.join(tmpdir(), entry.name);
            const details = await stat(directory);
            if (details.mtimeMs < cutoff) {
              await rm(directory, { recursive: true, force: true });
            }
          }),
      );
    } catch {
      // Temporary cleanup must not prevent the API from starting.
    }
  }
}
