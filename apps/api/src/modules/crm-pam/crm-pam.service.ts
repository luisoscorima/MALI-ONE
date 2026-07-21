import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EmailCampaignStatus,
  EmailSendStatus,
  NewsletterStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WhatsappCrmClientService } from '../crm/whatsapp-crm-client.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import { CreateEmailCampaignDto } from './dto/crm-pam.dto';
import { SesMailService } from './ses-mail.service';

@Injectable()
export class CrmPamService {
  private readonly logger = new Logger(CrmPamService.name);
  private sending = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ses: SesMailService,
    private readonly crm: WhatsappCrmClientService,
    private readonly newsletters: NewslettersService,
  ) {}

  async listContacts(query: {
    q?: string;
    segment?: string;
    attr_key?: string;
    attr_value?: string;
    has_email?: boolean;
    page?: number;
    limit?: number;
  }) {
    if (!this.crm.configured) {
      throw new BadRequestException(
        'WhatsApp CRM no configurado (WHATSAPP_CRM_BASE_URL / TOKEN)',
      );
    }
    return this.crm.fetchContacts({
      area: 'pam',
      q: query.q,
      segment: query.segment,
      attr_key: query.attr_key,
      attr_value: query.attr_value,
      has_email: query.has_email,
      page: query.page ?? 1,
      limit: query.limit ?? 100,
    });
  }

  listAttributeDefinitions() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.fetchAttributeDefinitions('pam');
  }

  listSegments() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.fetchSegments('pam');
  }

  createAttributeDefinition(dto: {
    scope: 'area' | 'segment';
    segment_slug?: string;
    slug: string;
    label: string;
    field_type?: string;
    sort_order?: number;
    required?: boolean;
  }) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.createAttributeDefinition({ area: 'pam', ...dto });
  }

  updateAttributeDefinition(
    id: number,
    dto: {
      label: string;
      field_type?: string;
      sort_order?: number;
      required?: boolean;
      active?: boolean;
    },
  ) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.updateAttributeDefinition(id, dto, 'pam');
  }

  patchContact(
    contactId: number,
    dto: {
      name?: string;
      last_name?: string;
      email?: string | null;
      dni?: string | null;
      opt_in?: boolean;
      opt_in_email?: boolean;
      segment_slugs?: string[];
      attributes?: Record<string, string>;
    },
  ) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    return this.crm.patchContact(contactId, dto, 'pam');
  }

  listPayments() {
    return this.prisma.pamRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async ensureDefaultPaymentMethod() {
    await this.prisma.pamPaymentMethod.upsert({
      where: { slug: 'mercado_pago' },
      create: {
        slug: 'mercado_pago',
        label: 'Mercado Pago',
        active: true,
        system: true,
        sortOrder: 0,
      },
      update: { system: true },
    });
  }

  async listPaymentMethods(includeInactive = true) {
    await this.ensureDefaultPaymentMethod();
    return this.prisma.pamPaymentMethod.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  private slugifyPaymentMethod(label: string, explicit?: string) {
    const base = String(explicit ?? label)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
    if (!base) {
      throw new BadRequestException('Slug de medio de pago inválido');
    }
    return base;
  }

  async createPaymentMethod(dto: {
    label: string;
    slug?: string;
    active?: boolean;
    sortOrder?: number;
  }) {
    const label = dto.label.trim();
    if (!label) throw new BadRequestException('Nombre requerido');
    const slug = this.slugifyPaymentMethod(label, dto.slug);
    if (slug === 'mercado_pago') {
      throw new BadRequestException(
        'Mercado Pago ya existe como medio de pago del sistema',
      );
    }
    try {
      return await this.prisma.pamPaymentMethod.create({
        data: {
          slug,
          label,
          active: dto.active ?? true,
          system: false,
          sortOrder: dto.sortOrder ?? 100,
        },
      });
    } catch {
      throw new BadRequestException(`Ya existe un medio de pago con slug "${slug}"`);
    }
  }

  async updatePaymentMethod(
    id: string,
    dto: { label?: string; active?: boolean; sortOrder?: number },
  ) {
    const existing = await this.prisma.pamPaymentMethod.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Medio de pago no encontrado');
    if (existing.system && dto.active === false) {
      throw new BadRequestException(
        'No se puede desactivar Mercado Pago (medio de sistema)',
      );
    }
    return this.prisma.pamPaymentMethod.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deletePaymentMethod(id: string) {
    const existing = await this.prisma.pamPaymentMethod.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Medio de pago no encontrado');
    if (existing.system) {
      throw new BadRequestException(
        'No se puede eliminar Mercado Pago (medio de sistema)',
      );
    }
    const inUse = await this.prisma.pamRegistration.count({
      where: { paymentMethod: existing.slug },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `Hay ${inUse} pago(s) con este medio. Desactívalo en lugar de eliminarlo.`,
      );
    }
    await this.prisma.pamPaymentMethod.delete({ where: { id } });
    return { ok: true };
  }

  async resolvePaymentMethodSlug(slug?: string) {
    await this.ensureDefaultPaymentMethod();
    const value = String(slug ?? 'mercado_pago').trim() || 'mercado_pago';
    const method = await this.prisma.pamPaymentMethod.findUnique({
      where: { slug: value },
    });
    if (!method || !method.active) {
      throw new BadRequestException(
        `Medio de pago inválido o inactivo: "${value}"`,
      );
    }
    return method.slug;
  }

  async createPayment(dto: {
    nombres: string;
    apellidos: string;
    dni: string;
    celular: string;
    correo: string;
    direccion?: string;
    ciudad?: string;
    distrito?: string;
    genero?: string;
    fechaNacimiento?: string;
    comoTeEnteraste?: string;
    plan: string;
    frecuencia: string;
    paymentMethod?: string;
    checkoutUrl?: string;
    mpStatus?: string;
    expiryDate?: string;
    aceptaPrivacidad?: boolean;
  }) {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }

    const paymentMethod = await this.resolvePaymentMethodSlug(dto.paymentMethod);

    const created = await this.prisma.pamRegistration.create({
      data: {
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        dni: dto.dni.trim(),
        celular: dto.celular.trim(),
        correo: dto.correo.trim().toLowerCase(),
        direccion: dto.direccion?.trim() || null,
        ciudad: dto.ciudad?.trim() || null,
        distrito: dto.distrito?.trim() || null,
        genero: dto.genero?.trim() || null,
        fechaNacimiento: dto.fechaNacimiento?.trim() || null,
        comoTeEnteraste: dto.comoTeEnteraste?.trim() || null,
        plan: dto.plan.trim(),
        frecuencia: dto.frecuencia.trim(),
        paymentMethod,
        checkoutUrl: dto.checkoutUrl?.trim() || null,
        aceptaPrivacidad: dto.aceptaPrivacidad ?? true,
        mpStatus: dto.mpStatus
          ? (dto.mpStatus as import('@prisma/client').PamMpStatus)
          : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      },
    });

    await this.crm.syncPamRegistrationAsync(created);
    return created;
  }

  /** Vincula un pago concreto al contacto WA (payment_id = este registro). */
  async linkPayment(paymentId: string) {
    const reg = await this.prisma.pamRegistration.findUnique({
      where: { id: paymentId },
    });
    if (!reg) throw new NotFoundException('Pago no encontrado');
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    await this.crm.syncPamRegistrationAsync(reg);
    return { ok: true, paymentId: reg.id, phone: reg.celular };
  }

  /**
   * Por cada teléfono con pagos, vincula el PamRegistration más reciente
   * (createdAt) al contacto WhatsApp vía payment_id.
   */
  async linkPaymentsByPhone() {
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    const regs = await this.prisma.pamRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const latestByPhone = new Map<string, (typeof regs)[number]>();
    for (const reg of regs) {
      const phone = this.crm.toE164Pe(reg.celular);
      if (!phone) continue;
      if (!latestByPhone.has(phone)) {
        latestByPhone.set(phone, reg);
      }
    }

    let linked = 0;
    const errors: Array<{ paymentId: string; error: string }> = [];
    for (const reg of latestByPhone.values()) {
      try {
        await this.crm.syncPamRegistrationAsync(reg);
        linked += 1;
      } catch (err) {
        errors.push({
          paymentId: reg.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      ok: true,
      linked,
      phones: latestByPhone.size,
      errors,
    };
  }

  listPublishedNewsletters() {
    return this.newsletters.listPublished();
  }

  listCampaigns() {
    return this.prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        newsletter: {
          select: { id: true, slug: true, title: true, subject: true },
        },
        createdBy: { select: { email: true, name: true } },
      },
    });
  }

  async getCampaign(id: string) {
    const row = await this.prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        newsletter: true,
        createdBy: { select: { email: true, name: true } },
        _count: { select: { sends: true, events: true } },
      },
    });
    if (!row) throw new NotFoundException('Campaña no encontrada');
    return row;
  }

  async getCampaignStats(id: string) {
    const campaign = await this.getCampaign(id);
    const [opensByDay, clicksByDay] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "EmailEvent"
        WHERE "campaignId" = ${id} AND type = 'open'
        GROUP BY 1 ORDER BY 1
      `,
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "EmailEvent"
        WHERE "campaignId" = ${id} AND type = 'click'
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    return {
      campaign,
      opensByDay: opensByDay.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      clicksByDay: clicksByDay.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      openRate:
        campaign.sentCount > 0
          ? Math.round((campaign.openCount / campaign.sentCount) * 1000) / 10
          : 0,
      clickRate:
        campaign.sentCount > 0
          ? Math.round((campaign.clickCount / campaign.sentCount) * 1000) / 10
          : 0,
    };
  }

  async createCampaign(userId: string, dto: CreateEmailCampaignDto) {
    const newsletter = await this.prisma.newsletter.findUnique({
      where: { id: dto.newsletterId },
    });
    if (!newsletter) throw new NotFoundException('Boletín no encontrado');
    if (newsletter.status !== NewsletterStatus.published) {
      throw new BadRequestException(
        'Solo se pueden enviar boletines publicados',
      );
    }

    return this.prisma.emailCampaign.create({
      data: {
        newsletterId: dto.newsletterId,
        name: dto.name.trim(),
        audienceArea: (dto.audienceArea ?? 'pam').trim().toLowerCase() || 'pam',
        audienceSegment: dto.audienceSegment?.trim() || null,
        audienceAttrKey: dto.audienceAttrKey?.trim() || null,
        audienceAttrValue: dto.audienceAttrValue?.trim() || null,
        createdById: userId,
        status: EmailCampaignStatus.draft,
      },
    });
  }

  async previewAudience(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }
    const audience = await this.crm.fetchAudience({
      area: campaign.audienceArea,
      segment: campaign.audienceSegment ?? undefined,
      attr_key: campaign.audienceAttrKey ?? undefined,
      attr_value: campaign.audienceAttrValue ?? undefined,
      limit: 50,
      page: 1,
      opt_in_email: true,
    });
    return {
      total: audience.total,
      sample: audience.items.slice(0, 20),
      area: audience.area,
    };
  }

  async startCampaign(campaignId: string) {
    const campaign = await this.getCampaign(campaignId);
    if (
      campaign.status === EmailCampaignStatus.sending ||
      campaign.status === EmailCampaignStatus.queued
    ) {
      throw new BadRequestException('La campaña ya está en envío');
    }
    if (!this.ses.configured) {
      throw new BadRequestException('SES no configurado');
    }
    if (!this.crm.configured) {
      throw new BadRequestException('WhatsApp CRM no configurado');
    }

    await this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: EmailCampaignStatus.queued,
        startedAt: new Date(),
        completedAt: null,
        sentCount: 0,
        openCount: 0,
        clickCount: 0,
        errorCount: 0,
      },
    });

    void this.processCampaign(campaignId).catch((err) => {
      this.logger.error(
        `Campaign ${campaignId} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });

    return this.getCampaign(campaignId);
  }

  private async processCampaign(campaignId: string) {
    if (this.sending.has(campaignId)) return;
    this.sending.add(campaignId);

    try {
      await this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: EmailCampaignStatus.sending },
      });

      const campaign = await this.prisma.emailCampaign.findUniqueOrThrow({
        where: { id: campaignId },
        include: { newsletter: true },
      });

      await this.prisma.emailSend.deleteMany({ where: { campaignId } });
      await this.prisma.emailEvent.deleteMany({ where: { campaignId } });

      const recipients: Array<{
        contact_id: number;
        email: string;
        name: string;
        last_name: string;
      }> = [];
      let page = 1;
      let pages = 1;
      while (page <= pages) {
        const batch = await this.crm.fetchAudience({
          area: campaign.audienceArea,
          segment: campaign.audienceSegment ?? undefined,
          attr_key: campaign.audienceAttrKey ?? undefined,
          attr_value: campaign.audienceAttrValue ?? undefined,
          page,
          limit: 500,
          opt_in_email: true,
        });
        pages = batch.pages || 1;
        recipients.push(...batch.items);
        page += 1;
      }

      const unique = new Map<string, (typeof recipients)[number]>();
      for (const r of recipients) {
        const email = r.email.trim().toLowerCase();
        if (email) unique.set(email, r);
      }
      const list = [...unique.values()];

      await this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { totalRecipients: list.length },
      });

      let sentCount = 0;
      let errorCount = 0;

      for (const recipient of list) {
        const openToken = this.makeOpenToken();
        const send = await this.prisma.emailSend.create({
          data: {
            campaignId,
            email: recipient.email.toLowerCase(),
            contactId: recipient.contact_id,
            name: `${recipient.name} ${recipient.last_name}`.trim(),
            openToken,
            status: EmailSendStatus.pending,
          },
        });

        try {
          const html = this.newsletters.injectTracking(
            campaign.newsletter.htmlBody,
            openToken,
          );
          const messageId = await this.ses.sendHtml({
            to: recipient.email,
            subject: campaign.newsletter.subject,
            html,
          });
          await this.prisma.emailSend.update({
            where: { id: send.id },
            data: {
              status: EmailSendStatus.sent,
              sesMessageId: messageId,
              sentAt: new Date(),
            },
          });
          sentCount += 1;
        } catch (err) {
          errorCount += 1;
          await this.prisma.emailSend.update({
            where: { id: send.id },
            data: {
              status: EmailSendStatus.failed,
              error:
                err instanceof Error ? err.message.slice(0, 500) : String(err),
            },
          });
        }

        if ((sentCount + errorCount) % 25 === 0) {
          await this.prisma.emailCampaign.update({
            where: { id: campaignId },
            data: { sentCount, errorCount },
          });
        }
      }

      await this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: EmailCampaignStatus.completed,
          sentCount,
          errorCount,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      await this.prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: EmailCampaignStatus.failed,
          completedAt: new Date(),
        },
      });
      throw err;
    } finally {
      this.sending.delete(campaignId);
    }
  }

  private makeOpenToken(): string {
    return createHash('sha256')
      .update(randomBytes(32))
      .digest('hex')
      .slice(0, 32);
  }
}
