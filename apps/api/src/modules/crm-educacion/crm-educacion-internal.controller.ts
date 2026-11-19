import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IsBoolean, IsEmail, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min,
} from 'class-validator';
import { Public } from '../../core/guards/public.decorator';
import { EducacionSaleService } from './educacion-sale.service';
import { EducacionOpportunityService } from './prospectia/educacion-opportunity.service';
import { EducacionChannelEventService } from './educacion-channel-event.service';

class InternalAssociateBody {
  @IsInt() @Min(1) waCycleId!: number;
  @IsOptional() @IsInt() @Min(1) waContactId?: number;
  @IsString() @MaxLength(120) transactionCode!: string;
  @IsOptional() @IsNumber() amountAgreed?: number;
  @IsOptional() @IsString() @MaxLength(200) itemLabel?: string;
  @IsOptional() @IsString() @MaxLength(200) actorEmail?: string;
}

class InternalLinkCycleBody {
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsInt() @Min(1) waCycleId!: number;
  @IsOptional() @IsInt() @Min(1) waContactId?: number;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsBoolean() markInbound?: boolean;
}

class InternalChannelEventBody {
  @IsString() @MaxLength(120) eventId!: string;
  @IsString() @MaxLength(80) eventType!: string;
  @IsOptional() @IsString() @MaxLength(40) occurredAt?: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
}

/**
 * Lookup/asociación de pagos + link ciclo↔oportunidad Prospectia para mali-whatsapp.
 * Auth: `x-crm-educacion-service-token` o Bearer = CRM_EDUCACION_SERVICE_TOKEN.
 */
@Controller('crm-educacion/internal')
export class CrmEducacionInternalController {
  constructor(
    private readonly sales: EducacionSaleService,
    private readonly opportunities: EducacionOpportunityService,
    private readonly channelEvents: EducacionChannelEventService,
    private readonly config: ConfigService,
  ) {}

  private assertServiceToken(headerToken?: string, authorization?: string): void {
    const expected = String(
      this.config.get('CRM_EDUCACION_SERVICE_TOKEN') ?? '',
    ).trim();
    if (!expected) {
      throw new UnauthorizedException('CRM_EDUCACION_SERVICE_TOKEN no configurado');
    }
    const bearer = String(authorization ?? '')
      .trim()
      .toLowerCase()
      .startsWith('bearer ')
      ? String(authorization).trim().slice(7).trim()
      : '';
    const provided = String(headerToken ?? '').trim() || bearer;
    if (provided !== expected) {
      throw new UnauthorizedException('Token de servicio inválido');
    }
  }

  /** Lectura informativa para WA (facade); no cambia escritor. */
  @Public()
  @Get('commercial-authority')
  commercialAuthority(
    @Headers('x-crm-educacion-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    const raw = String(this.config.get('COMMERCIAL_AUTHORITY') ?? 'wa').trim().toLowerCase();
    const authority = raw === 'one' ? 'one' : 'wa';
    const waChannelsPending = String(this.config.get('COMMERCIAL_AUTHORITY_WA_SOURCES') ?? 'meta,tiktok,wa_inbound')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      authority,
      messaging: 'whatsapp',
      per_opportunity: true,
      wa_ux: 'stable',
      wa_channels_pending: waChannelsPending,
      note: 'Shadow/outbox only; WA keeps commercial writer until F4.',
    };
  }

  @Public()
  @Get('payments/lookup')
  lookup(
    @Query('code') code: string,
    @Query('provider') provider: string | undefined,
    @Headers('x-crm-educacion-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    const p = String(provider ?? 'all').trim().toLowerCase();
    const allowed = ['all', 'niubiz', 'paycash', 'mercadopago'] as const;
    const selected = (allowed as readonly string[]).includes(p)
      ? (p as (typeof allowed)[number])
      : 'all';
    return this.sales.lookupTransaction(code, selected);
  }

  @Public()
  @Post('payments/associate')
  associate(
    @Body() body: InternalAssociateBody,
    @Headers('x-crm-educacion-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    return this.sales.associateCode({
      waCycleId: body.waCycleId,
      waContactId: body.waContactId,
      transactionCode: body.transactionCode,
      amountAgreed: body.amountAgreed,
      itemLabel: body.itemLabel,
      actorEmail: body.actorEmail || 'mali-whatsapp@system',
    });
  }

  /** Identificador pago↔ciclo para inbox WA. */
  @Public()
  @Get('sales/by-cycle/:waCycleId')
  async saleLinkByCycle(
    @Param('waCycleId', ParseIntPipe) waCycleId: number,
    @Headers('x-crm-educacion-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    const sale = await this.sales.getByCycle(waCycleId);
    return { payment_link: this.sales.paymentLinkOf(sale) };
  }

  /**
   * Vincula ciclo WA a oportunidad Prospectia nativa en ONE (piloto autoridad).
   * Aditivo: si no hay match, linked=false y el chat sigue.
   */
  @Public()
  @Post('opportunities/link-cycle')
  linkCycle(
    @Body() body: InternalLinkCycleBody,
    @Headers('x-crm-educacion-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    return this.opportunities.linkCycle({
      category: body.category,
      waCycleId: body.waCycleId,
      waContactId: body.waContactId,
      phone: body.phone,
      email: body.email,
      markInbound: body.markInbound !== false,
    });
  }

  /**
   * Outbox shadow WA→ONE. Idempotente por eventId. No escribe etapa comercial.
   */
  @Public()
  @Post('channel-events')
  ingestChannelEvent(
    @Body() body: InternalChannelEventBody,
    @Headers('x-crm-educacion-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    return this.channelEvents.ingest({
      eventId: body.eventId,
      eventType: body.eventType,
      occurredAt: body.occurredAt,
      payload: body.payload,
    });
  }

  @Public()
  @Get('channel-events/recent')
  recentChannelEvents(
    @Query('limit') limitRaw: string | undefined,
    @Headers('x-crm-educacion-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    const limit = limitRaw ? Number(limitRaw) : 20;
    return this.channelEvents.recent(Number.isFinite(limit) ? limit : 20);
  }
}
