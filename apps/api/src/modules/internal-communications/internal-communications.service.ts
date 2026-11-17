import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailCampaignStatus, NewsletterStatus, Prisma, SesEventType } from '@prisma/client';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { GoogleAdminService } from '../google-admin/google-admin.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import {
  CreateInternalCampaignDto,
  PreviewInternalAudienceDto,
} from './dto/create-internal-campaign.dto';

const AUDIENCE_AREA = 'internal_workspace';
const DEFAULT_REPLY_TO = 'tecnologia@mali.pe';
const DEFAULT_FROM_NAME = 'MALI - Campañas internas';
const MALI_PE_EMAIL = /^[^@\s]+@mali\.pe$/i;

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

  async createCampaign(userId: string, dto: CreateInternalCampaignDto) {
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

    const newsletter = await this.prisma.newsletter.findFirst({
      where: { id: dto.newsletterId, status: NewsletterStatus.published },
      select: { id: true, subject: true, htmlBody: true },
    });
    if (!newsletter) throw new BadRequestException('Selecciona un boletín publicado');

    const fromName = dto.fromName?.trim() || DEFAULT_FROM_NAME;

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.emailCampaign.create({
        data: {
          newsletterId: newsletter.id,
          name: dto.name.trim(),
          replyToEmail: replyTo,
          subjectSnapshot: newsletter.subject,
          htmlSnapshot: newsletter.htmlBody,
          fromName,
          fromEmail,
          managedByDispatcher: true,
          status: EmailCampaignStatus.queued,
          audienceArea: AUDIENCE_AREA,
          audienceSegments: includePaths,
          audienceExcludeSegments: excludePaths,
          totalRecipients: recipients.length,
          createdById: userId,
        },
      });
      for (let index = 0; index < recipients.length; index += 1_000) {
        await tx.emailSend.createMany({
          data: recipients.slice(index, index + 1_000).map((recipient) => ({
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
    };
  }

  async campaigns() {
    const rows = await this.prisma.emailCampaign.findMany({
      where: { audienceArea: AUDIENCE_AREA },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        newsletter: { select: { title: true } },
        sends: {
          select: {
            id: true,
            sesMessageId: true,
            status: true,
            events: { select: { type: true } },
          },
        },
      },
    });

    const messageIds = rows.flatMap((row) =>
      row.sends.map((send) => send.sesMessageId).filter(Boolean),
    ) as string[];
    const sesEvents = messageIds.length
      ? await this.prisma.sesEventRecord.findMany({
          where: { messageId: { in: messageIds } },
          select: { messageId: true, type: true },
        })
      : [];
    const byMessage = new Map<string, Set<SesEventType>>();
    for (const event of sesEvents) {
      if (!event.messageId) continue;
      const types = byMessage.get(event.messageId) ?? new Set<SesEventType>();
      types.add(event.type);
      byMessage.set(event.messageId, types);
    }

    return rows.map((row) => {
      let delivered = 0;
      let bounced = 0;
      let complaints = 0;
      let opened = 0;
      let clicked = 0;
      let suppressed = 0;
      for (const send of row.sends) {
        const types = send.sesMessageId ? byMessage.get(send.sesMessageId) : undefined;
        if (types?.has(SesEventType.delivery)) delivered++;
        if (types?.has(SesEventType.bounce)) bounced++;
        if (types?.has(SesEventType.complaint)) complaints++;
        if (types?.has(SesEventType.open) || send.events.some((event) => event.type === 'open')) {
          opened++;
        }
        if (types?.has(SesEventType.click) || send.events.some((event) => event.type === 'click')) {
          clicked++;
        }
        if (send.status === 'suppressed') suppressed++;
      }
      return {
        id: row.id,
        name: row.name,
        newsletterId: row.newsletterId,
        newsletterTitle: row.newsletter.title,
        subject: row.subjectSnapshot,
        replyTo: row.replyToEmail ?? DEFAULT_REPLY_TO,
        status: row.status,
        totalRecipients: row.totalRecipients,
        sent: row.sentCount,
        failed: row.errorCount,
        suppressed,
        delivered,
        bounced,
        complaints,
        opened,
        clicked,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
      };
    });
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
      subject: campaign.subjectSnapshot,
      previewHtml: campaign.htmlSnapshot,
      status: campaign.status,
      fromName: campaign.fromName ?? DEFAULT_FROM_NAME,
      fromEmail: campaign.fromEmail ?? '',
      replyTo: campaign.replyToEmail ?? campaign.fromEmail ?? DEFAULT_REPLY_TO,
      orgUnitPaths: campaign.audienceSegments,
      excludeOrgUnitPaths: campaign.audienceExcludeSegments,
      totalRecipients: campaign.totalRecipients,
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
