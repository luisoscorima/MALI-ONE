import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  EDUCACION_LEAD_FUENTE,
  EDUCACION_LEAD_SOURCE,
  normalizePersonName,
} from '@mali-one/shared';
import type { EducacionLead } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RedisService } from '../../../core/redis/redis.service';
import { WhatsappCrmClientService } from '../../crm/whatsapp-crm-client.service';
import { EducacionOpportunityService } from '../../crm-educacion/prospectia/educacion-opportunity.service';
import { CreateEducacionLeadDto } from '../dto/create-educacion-lead.dto';
import { EducacionLeadsSheetsService } from './educacion-leads-sheets.service';

@Injectable()
export class EducacionLeadsService {
  private readonly logger = new Logger(EducacionLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crm: WhatsappCrmClientService,
    private readonly sheets: EducacionLeadsSheetsService,
    private readonly opportunities: EducacionOpportunityService,
  ) {}

  async createLead(dto: CreateEducacionLeadDto, ip: string) {
    const key = `edu:lead:${ip}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, 3600);
    }
    if (count > 15) {
      throw new BadRequestException('Demasiados intentos. Intenta más tarde.');
    }

    if (!dto.acceptPrivacy) {
      throw new BadRequestException(
        'Debes aceptar las políticas de privacidad',
      );
    }

    const whatsappArea = dto.whatsappArea ?? 'educacion_ep';

    const lead = await this.prisma.educacionLead.create({
      data: {
        nombres: normalizePersonName(dto.nombres),
        apellidos: normalizePersonName(dto.apellidos),
        dni: dto.dni?.trim() || null,
        celular: dto.celular.trim(),
        email: dto.email?.trim().toLowerCase() || null,
        optInMarketing: Boolean(dto.optInMarketing),
        acceptPrivacy: true,
        courseSlug: dto.courseSlug?.trim() || null,
        courseTitle: dto.courseTitle?.trim() || null,
        pageUrl: dto.pageUrl?.trim() || null,
        captureSource: dto.captureSource ?? 'wordpress_widget',
        referrer: dto.referrer?.trim() || null,
        utmSource: dto.utmSource?.trim() || null,
        utmMedium: dto.utmMedium?.trim() || null,
        utmCampaign: dto.utmCampaign?.trim() || null,
        utmContent: dto.utmContent?.trim() || null,
        utmTerm: dto.utmTerm?.trim() || null,
        gclid: dto.gclid?.trim() || null,
        fbclid: dto.fbclid?.trim() || null,
        whatsappArea,
        fuente: EDUCACION_LEAD_FUENTE,
        source: EDUCACION_LEAD_SOURCE,
        sheetStatus: this.sheets.enabled ? 'pending' : 'disabled',
      },
    });

    await this.syncWhatsapp(lead);
    void this.syncSheet(lead.id);
    // Oportunidad nativa ONE (escritor one). WA solo si hay chat/ciclo (link-cycle aditivo).
    let oneOpportunityId: string | null = null;
    try {
      const category = whatsappArea.includes('_ca') ? 'ca'
        : whatsappArea.includes('_ep') || whatsappArea.includes('educacion') ? 'ep'
          : 'general';
      const phone = lead.celular.trim().startsWith('+')
        ? lead.celular.trim()
        : `+${lead.celular.trim().replace(/\D/g, '')}`;
      const one = await this.opportunities.createNative({
        channel: 'widget',
        category,
        name: lead.nombres,
        lastName: lead.apellidos,
        phone,
        email: lead.email ?? undefined,
        interestCourse: lead.courseTitle ?? lead.courseSlug ?? undefined,
        sourceLabel: `widget · ${lead.captureSource ?? 'lead-form'}`,
        stageSlug: 'por_contactar',
      });
      oneOpportunityId = one.id;
    } catch (err) {
      this.logger.warn(
        `ONE opportunity widget falló para lead ${lead.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    const updated = await this.prisma.educacionLead.findUniqueOrThrow({
      where: { id: lead.id },
    });

    return {
      id: updated.id,
      ok: true,
      waStatus: updated.waStatus,
      sheetStatus: updated.sheetStatus,
      oneOpportunityId,
    };
  }

  private async syncWhatsapp(lead: EducacionLead): Promise<void> {
    if (!this.crm.configured) {
      await this.prisma.educacionLead.update({
        where: { id: lead.id },
        data: { waStatus: 'skipped', waError: 'WhatsApp CRM no configurado' },
      });
      return;
    }

    try {
      // Idempotente por (area, channel, external_id=lead.id) en WhatsApp.
      await this.crm.syncEducacionLeadAsync(lead);
      await this.prisma.educacionLead.update({
        where: { id: lead.id },
        data: { waStatus: 'ok', waError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`CRM sync falló para lead ${lead.id}: ${message}`);
      await this.prisma.educacionLead.update({
        where: { id: lead.id },
        data: { waStatus: 'error', waError: message.slice(0, 500) },
      });
      // Un solo reintento diferido (evita doble fire inmediato).
      setTimeout(() => {
        this.crm.syncEducacionLead(lead);
      }, 15_000);
    }
  }

  /** Reintenta leads con waStatus=error (ops / cron). Idempotente por external_id. */
  async retryFailedWhatsappSync(limit = 50): Promise<{ retried: number }> {
    const failed = await this.prisma.educacionLead.findMany({
      where: { waStatus: 'error' },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    for (const lead of failed) {
      await this.syncWhatsapp(lead);
    }
    return { retried: failed.length };
  }

  private async syncSheet(leadId: string): Promise<void> {
    if (!this.sheets.enabled) {
      return;
    }

    try {
      const lead = await this.prisma.educacionLead.findUniqueOrThrow({
        where: { id: leadId },
      });
      await this.sheets.appendLead(lead);
      await this.prisma.educacionLead.update({
        where: { id: leadId },
        data: { sheetStatus: 'ok', sheetError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sheets append falló para lead ${leadId}: ${message}`);
      await this.prisma.educacionLead.update({
        where: { id: leadId },
        data: { sheetStatus: 'error', sheetError: message.slice(0, 500) },
      });
    }
  }
}
