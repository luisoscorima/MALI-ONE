import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailCampaignStatus, NewsletterStatus, SesEventType } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { GoogleAdminService } from '../google-admin/google-admin.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import { CreateInternalCampaignDto } from './dto/create-internal-campaign.dto';

const AUDIENCE_AREA = 'internal_workspace';
const MAX_RECIPIENTS = 200;
const DEFAULT_REPLY_TO = 'tecnologia@mali.pe';

@Injectable()
export class InternalCommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleAdmin: GoogleAdminService,
    private readonly newslettersService: NewslettersService,
  ) {}

  async audience(activeDays = 30) {
    const members = await this.googleAdmin.listRecentlyActiveInternalUsers(activeDays);
    return {
      members,
      activeDays,
      generatedAt: new Date().toISOString(),
      source: 'google_workspace_last_login' as const,
      note: `Cuentas @mali.pe habilitadas que iniciaron sesión en Google Workspace durante los últimos ${activeDays} días.`,
    };
  }

  newsletters() {
    return this.newslettersService.listPublished();
  }

  async createCampaign(userId: string, dto: CreateInternalCampaignDto) {
    const recipients = [...new Set(dto.recipients.map((email) => email.trim().toLowerCase()))];
    const replyTo = dto.replyTo.trim().toLowerCase();
    if (recipients.length > MAX_RECIPIENTS) {
      throw new BadRequestException(`El máximo por envío es ${MAX_RECIPIENTS}`);
    }
    if (recipients.some((email) => !email.endsWith('@mali.pe'))) {
      throw new BadRequestException('Comunicación Interna solo permite cuentas @mali.pe');
    }
    if (!replyTo.endsWith('@mali.pe')) {
      throw new BadRequestException('La dirección de respuesta debe pertenecer a @mali.pe');
    }

    const audience = await this.googleAdmin.listRecentlyActiveInternalUsers(30);
    const eligible = new Map(audience.map((member) => [member.email, member]));
    const invalid = recipients.filter((email) => !eligible.has(email));
    if (invalid.length) {
      throw new BadRequestException(
        `${invalid.length} destinatario(s) ya no cumplen la regla de actividad de 30 días`,
      );
    }

    const newsletter = await this.prisma.newsletter.findFirst({
      where: { id: dto.newsletterId, status: NewsletterStatus.published },
      select: { id: true, subject: true, htmlBody: true },
    });
    if (!newsletter) throw new BadRequestException('Selecciona un boletín publicado');

    return this.prisma.emailCampaign.create({
      data: {
        newsletterId: newsletter.id,
        name: dto.name.trim(),
        replyToEmail: replyTo,
        subjectSnapshot: newsletter.subject,
        htmlSnapshot: newsletter.htmlBody,
        fromName: 'MALI - Comunicación Interna',
        managedByDispatcher: true,
        status: EmailCampaignStatus.queued,
        audienceArea: AUDIENCE_AREA,
        audienceSegments: ['google-workspace-active-30d'],
        totalRecipients: recipients.length,
        createdById: userId,
        sends: {
          create: recipients.map((email) => ({
            email,
            name: eligible.get(email)?.name || null,
          })),
        },
      },
      select: { id: true, status: true, totalRecipients: true },
    });
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

    const messageIds = rows.flatMap((row) => row.sends.map((send) => send.sesMessageId).filter(Boolean)) as string[];
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
        if (types?.has(SesEventType.open) || send.events.some((event) => event.type === 'open')) opened++;
        if (types?.has(SesEventType.click) || send.events.some((event) => event.type === 'click')) clicked++;
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

}
