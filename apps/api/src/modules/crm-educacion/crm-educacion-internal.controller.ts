import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Public } from '../../core/guards/public.decorator';
import { EducacionSaleService } from './educacion-sale.service';

class InternalAssociateBody {
  @IsInt() @Min(1) waCycleId!: number;
  @IsOptional() @IsInt() @Min(1) waContactId?: number;
  @IsString() @MaxLength(120) transactionCode!: string;
  @IsOptional() @IsNumber() amountAgreed?: number;
  @IsOptional() @IsString() @MaxLength(200) itemLabel?: string;
  @IsOptional() @IsString() @MaxLength(200) actorEmail?: string;
}

/**
 * Lookup/asociación de pagos para mali-whatsapp (asesor no entra a Treasury).
 * Auth: `x-crm-educacion-service-token` o Bearer = CRM_EDUCACION_SERVICE_TOKEN.
 */
@Controller('crm-educacion/internal')
export class CrmEducacionInternalController {
  constructor(
    private readonly sales: EducacionSaleService,
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
}
