import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmailCampaignStatus, NewsletterStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { GoogleAdminService } from '../google-admin/google-admin.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import {
  CreateInternalCampaignDto,
  CreateInternalNewsletterDraftDto,
  PreviewInternalAudienceDto,
} from './dto/create-internal-campaign.dto';

const AUDIENCE_AREA = 'internal_workspace';
const DEFAULT_REPLY_TO = 'tecnologia@mali.pe';
const DEFAULT_FROM_NAME = 'MALI - Campañas internas';
const MALI_PE_EMAIL = /^[^@\s]+@mali\.pe$/i;

const NEW_NEWSLETTER_PLACEHOLDER_HTML =
  '<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#444">Edita este boletín en <strong>Boletines</strong> antes de enviar la campaña.</p>';

type AudienceMember = {
  id: string;
  email: string;
  name: string;
  orgUnitPath: string;
  lastActivityAt: string;
};

function normalizeOrgPaths(paths: string[] | undefined): string[] {
  return [...new Set((paths ?? []).map((path) => path.trim()).filter(Boolean))];
}

function matchesOrgUnit(orgUnitPath: string, selected: string): boolean {
  return orgUnitPath === selected || orgUnitPath.startsWith(`${selected}/`);
}

function filterByOrgUnits(
  members: AudienceMember[],
  includePaths: string[],
  excludePaths: string[],
): AudienceMember[] {
  let filtered = members;
  if (includePaths.length) {
    filtered = filtered.filter((member) =>
      includePaths.some((path) => matchesOrgUnit(member.orgUnitPath, path)),
    );
  }
  if (excludePaths.length) {
    filtered = filtered.filter(
      (member) =>
        !excludePaths.some((path) => matchesOrgUnit(member.orgUnitPath, path)),
    );
  }
  return filtered;
}

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

@Injectable()
export class InternalCommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAdmin: GoogleAdminService,
    private readonly newslettersService: NewslettersService,
    private readonly emailSenders: EmailSenderService,
  ) {}

  private async loadActiveMembers(activeDays: number): Promise<AudienceMember[]> {
    return this.googleAdmin.listRecentlyActiveInternalUsers(activeDays);
  }

  private buildAudiencePayload(
    members: AudienceMember[],
    activeDays: number,
    includePaths: string[],
    excludePaths: string[],
  ) {
    const filtered = filterByOrgUnits(members, includePaths, excludePaths);
    const orgUnits = [...new Set(members.map((member) => member.orgUnitPath))]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'es'));
    const noteParts = [
      `Cuentas @mali.pe habilitadas que iniciaron sesión en Google Workspace durante los últimos ${activeDays} días.`,
    ];
    if (includePaths.length) {
      noteParts.push(`Incluye ${includePaths.length} unidad(es) organizativa(s) (con sub-OUs).`);
    }
    if (excludePaths.length) {
      noteParts.push(`Excluye ${excludePaths.length} unidad(es).`);
    }
    return {
      members: filtered,
      orgUnits,
      orgUnitPaths: includePaths,
      excludeOrgUnitPaths: excludePaths,
      activeDays,
      generatedAt: new Date().toISOString(),
      source: 'google_workspace_last_login' as const,
      note: noteParts.join(' '),
    };
  }

  async audience(activeDays = 30) {
    const days = Math.min(90, Math.max(1, activeDays));
    const members = await this.loadActiveMembers(days);
    return this.buildAudiencePayload(members, days, [], []);
  }

  async previewAudience(dto: PreviewInternalAudienceDto) {
    const days = Math.min(90, Math.max(1, dto.activeDays ?? 30));
    const includePaths = normalizeOrgPaths(dto.orgUnitPaths);
    const excludePaths = normalizeOrgPaths(dto.excludeOrgUnitPaths);
    const members = await this.loadActiveMembers(days);
    return this.buildAudiencePayload(members, days, includePaths, excludePaths);
  }

  newsletters() {
    return this.newslettersService.listPublished();
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

  async createNewsletterDraft(userId: string, dto: CreateInternalNewsletterDraftDto) {
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

  private async prepareCampaignInput(
    dto: CreateInternalCampaignDto,
    attachedDraftNewsletterId?: string,
  ) {
    const includePaths = normalizeOrgPaths(dto.orgUnitPaths);
    const excludePaths = normalizeOrgPaths(dto.excludeOrgUnitPaths);
    if (!includePaths.length) {
      throw new BadRequestException('Selecciona al menos una unidad organizativa');
    }

    const replyTo = dto.replyTo.trim().toLowerCase();
    const fromEmail = dto.fromEmail.trim().toLowerCase();
    if (!MALI_PE_EMAIL.test(replyTo)) {
      throw new BadRequestException('La dirección de respuesta debe pertenecer a @mali.pe');
    }
    if (!MALI_PE_EMAIL.test(fromEmail)) {
      throw new BadRequestException('El remitente debe ser un correo @mali.pe');
    }
    await this.emailSenders.assertEnabled(fromEmail);

    const activeDays = Math.min(90, Math.max(1, dto.activeDays ?? 30));
    const active = await this.loadActiveMembers(activeDays);
    const recipients = filterByOrgUnits(active, includePaths, excludePaths);
    if (!recipients.length) {
      throw new BadRequestException(
        'La segmentación no tiene destinatarios elegibles con la regla de actividad actual',
      );
    }

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

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('La programación debe usar una fecha y hora futuras');
    }

    return {
      includePaths,
      excludePaths,
      replyTo,
      fromEmail,
      fromName: dto.fromName?.trim() || DEFAULT_FROM_NAME,
      subject: dto.subject.trim(),
      newsletter,
      recipients,
      scheduledAt,
    };
  }

  async createCampaign(userId: string, dto: CreateInternalCampaignDto) {
    const prepared = await this.prepareCampaignInput(dto);
    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.emailCampaign.create({
        data: {
          newsletterId: prepared.newsletter.id,
          name: dto.name.trim(),
          replyToEmail: prepared.replyTo,
          subjectSnapshot: prepared.subject,
          htmlSnapshot: prepared.newsletter.htmlBody,
          fromName: prepared.fromName,
          fromEmail: prepared.fromEmail,
          managedByDispatcher: true,
          status: prepared.scheduledAt
            ? EmailCampaignStatus.scheduled
            : EmailCampaignStatus.queued,
          audienceArea: AUDIENCE_AREA,
          audienceSegments: prepared.includePaths,
          audienceExcludeSegments: prepared.excludePaths,
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
            name: recipient.name || null,
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

  async sendDraftCampaign(id: string, dto: CreateInternalCampaignDto) {
    const draft = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: AUDIENCE_AREA },
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
          subjectSnapshot: prepared.subject,
          htmlSnapshot: prepared.newsletter.htmlBody,
          fromName: prepared.fromName,
          fromEmail: prepared.fromEmail,
          managedByDispatcher: true,
          status: prepared.scheduledAt
            ? EmailCampaignStatus.scheduled
            : EmailCampaignStatus.queued,
          audienceSegments: prepared.includePaths,
          audienceExcludeSegments: prepared.excludePaths,
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
            name: recipient.name || null,
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

  async duplicateCampaign(userId: string, id: string) {
    const source = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: AUDIENCE_AREA },
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
    const includePaths = source.audienceSegments;
    const excludePaths = source.audienceExcludeSegments;
    const recipients = includePaths.length
      ? filterByOrgUnits(await this.loadActiveMembers(30), includePaths, excludePaths)
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
          managedByDispatcher: false,
          status: EmailCampaignStatus.draft,
          audienceArea: AUDIENCE_AREA,
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
      where: { id, audienceArea: AUDIENCE_AREA },
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

  async campaigns() {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      newsletterId: string;
      newsletterTitle: string;
      subject: string;
      replyTo: string | null;
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
        campaign."replyToEmail" AS "replyTo",
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
      WHERE campaign."audienceArea" = ${AUDIENCE_AREA}
      GROUP BY campaign."id", newsletter."title"
      ORDER BY campaign."createdAt" DESC
      LIMIT 50
    `);
    return rows.map((row) => ({
      ...row,
      replyTo: row.replyTo ?? DEFAULT_REPLY_TO,
      delivered: Number(row.delivered),
      suppressed: Number(row.suppressed),
      bounced: Number(row.bounced),
      complaints: Number(row.complaints),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
    }));
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: AUDIENCE_AREA },
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
      fromName: campaign.fromName ?? DEFAULT_FROM_NAME,
      fromEmail: campaign.fromEmail ?? '',
      replyTo: campaign.replyToEmail ?? campaign.fromEmail ?? DEFAULT_REPLY_TO,
      orgUnitPaths: campaign.audienceSegments,
      excludeOrgUnitPaths: campaign.audienceExcludeSegments,
      totalRecipients: campaign.totalRecipients,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
    };
  }

  async getCampaignStats(id: string, days = 30) {
    const campaign = await this.prisma.emailCampaign.findFirst({
      where: { id, audienceArea: AUDIENCE_AREA },
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
    }>>(Prisma.sql`
      SELECT
        COUNT(send."id") FILTER (WHERE send."status" = 'suppressed'::"EmailSendStatus") AS "suppressed",
        COUNT(send."id") FILTER (WHERE send."deliveredAt" IS NOT NULL) AS "delivered",
        COUNT(send."id") FILTER (WHERE send."bouncedAt" IS NOT NULL) AS "bounced",
        COUNT(send."id") FILTER (WHERE send."complainedAt" IS NOT NULL) AS "complaints",
        COUNT(send."id") FILTER (WHERE send."openedAt" IS NOT NULL) AS "opened",
        COUNT(send."id") FILTER (WHERE send."clickedAt" IS NOT NULL) AS "clicked"
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
      openRate: delivered > 0 ? opened / delivered : 0,
      clickRate: delivered > 0 ? clicked / delivered : 0,
      opensByDay,
      clicksByDay,
    };
  }

  async getCampaignBrowserView(id: string) {
    const campaign = await this.getCampaign(id);
    return {
      title: campaign.name,
      html: campaign.previewHtml,
    };
  }
}
