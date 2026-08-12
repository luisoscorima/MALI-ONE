import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  EDUCACION_LEAD_FUENTE,
  EDUCACION_LEAD_SOURCE,
} from '@mali-one/shared';
import type { EducacionLead } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RedisService } from '../../../core/redis/redis.service';
import { WhatsappCrmClientService } from '../../crm/whatsapp-crm-client.service';
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
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        dni: dto.dni.trim(),
        celular: dto.celular.trim(),
        email: dto.email.trim().toLowerCase(),
        optInMarketing: Boolean(dto.optInMarketing),
        acceptPrivacy: true,
        courseSlug: dto.courseSlug?.trim() || null,
        courseTitle: dto.courseTitle?.trim() || null,
        pageUrl: dto.pageUrl?.trim() || null,
        whatsappArea,
        fuente: EDUCACION_LEAD_FUENTE,
        source: EDUCACION_LEAD_SOURCE,
        sheetStatus: this.sheets.enabled ? 'pending' : 'disabled',
      },
    });

    await this.syncWhatsapp(lead);
    void this.syncSheet(lead.id);

    const updated = await this.prisma.educacionLead.findUniqueOrThrow({
      where: { id: lead.id },
    });

    return {
      id: updated.id,
      ok: true,
      waStatus: updated.waStatus,
      sheetStatus: updated.sheetStatus,
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
      // Reintento fire-and-forget
      this.crm.syncEducacionLead(lead);
    }
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
