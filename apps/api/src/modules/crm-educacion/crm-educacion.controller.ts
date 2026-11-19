import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { AppModule, type User } from '@prisma/client';
import type { Request } from 'express';
import {
  IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequireModule } from '../../core/guards/module.decorator';
import { CrmEducacionService } from './crm-educacion.service';
import { EducacionActivityService } from './educacion-activity.service';
import { EducacionSaleService } from './educacion-sale.service';
import { EDUCATION_CATEGORY_SCOPES, EDUCATION_WRITE_AREA } from './education-scope';
import { EducacionOpportunityService } from './prospectia/educacion-opportunity.service';
import { ProspectiaIngestService } from './prospectia/prospectia-ingest.service';
import { AnuraIngestService } from './anura/anura-ingest.service';

class ListContactsQuery {
  @IsOptional() @IsIn([...EDUCATION_CATEGORY_SCOPES]) categoria?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsString() @MaxLength(50) segment?: string;
  @IsOptional() @IsString() @MaxLength(64) attr_key?: string;
  @IsOptional() @IsString() @MaxLength(255) attr_value?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

class ListLeadsQuery {
  @IsOptional() @IsIn([...EDUCATION_CATEGORY_SCOPES]) categoria?: string;
  @IsOptional() @IsString() @MaxLength(32) channel?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['recent', 'new_number', 'duplicate', 'reassignable', 'conflict', 'in_progress', 'all']) view?: string;
  @IsOptional() @IsIn(['true', 'false']) unassigned?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

class ListCyclesQuery {
  @IsOptional() @IsIn([...EDUCATION_CATEGORY_SCOPES]) categoria?: string;
  @IsOptional() @IsString() @MaxLength(32) channel?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['open', 'closed', 'review', 'unassigned', 'stale', 'solo_contacto']) view?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

class SlaQuery {
  @IsOptional() @IsIn([...EDUCATION_CATEGORY_SCOPES]) categoria?: string;
  @IsOptional() @IsString() @MaxLength(10) from?: string;
  @IsOptional() @IsString() @MaxLength(10) to?: string;
}

class ManagementBody {
  @IsIn([EDUCATION_WRITE_AREA]) area!: typeof EDUCATION_WRITE_AREA;
  @IsOptional() @IsInt() @Min(1) assigned_user_id?: number | null;
  @IsOptional() @IsInt() @Min(1) lead_status_id?: number | null;
  @IsOptional() @IsInt() @Min(1) lead_id?: number;
  @IsOptional() @IsString() @MaxLength(40) promise_at?: string | null;
  @IsOptional() @IsString() @MaxLength(64) lost_reason?: string | null;
}

class DistributeBody {
  @IsIn([...EDUCATION_CATEGORY_SCOPES]) categoria!: string;
  @IsOptional() @IsString() @MaxLength(32) channel?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
}

class ReviewBody {
  @IsIn([EDUCATION_WRITE_AREA]) area!: typeof EDUCATION_WRITE_AREA;
  @IsIn(['open_new', 'keep_existing', 'dismiss']) action!: 'open_new' | 'keep_existing' | 'dismiss';
}

class PatchContactBody {
  @IsIn([EDUCATION_WRITE_AREA]) area!: typeof EDUCATION_WRITE_AREA;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() last_name?: string;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() dni?: string | null;
  @IsOptional() @IsObject() attributes?: Record<string, string>;
  @IsOptional() @IsArray() @IsString({ each: true }) segment_slugs?: string[];
  @IsOptional() @IsBoolean() opt_in_email?: boolean;
  @IsOptional() @IsBoolean() opt_in?: boolean;
}

class ProspectiaSubjectBody {
  @IsString() @MaxLength(160) key!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(64) username?: string | null;
  @IsOptional() @IsString() @MaxLength(128) whatsapp_user_id?: string | null;
}

class ProspectiaCheckBody {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProspectiaSubjectBody)
  subjects!: ProspectiaSubjectBody[];
}

class ManualLeadBody {
  @IsIn(['manual_call', 'manual_historical', 'manual_organic']) source_key!: string;
  @IsIn(['ca', 'ep']) categoria!: string;
  @IsString() @MaxLength(150) name!: string;
  @IsOptional() @IsString() @MaxLength(150) last_name?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(32) dni?: string;
  @IsOptional() @IsString() @MaxLength(200) curso?: string;
}

class ProspectiaImportBody {
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @MaxLength(64) username?: string;
  @IsOptional() @IsString() @MaxLength(128) whatsapp_user_id?: string;
  @IsOptional() @IsIn(['ca', 'ep', 'general']) category?: 'ca' | 'ep' | 'general';
  @IsOptional() @IsString() @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(150) last_name?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
}

class AnuraImportBody {
  @IsOptional() @IsInt() @Min(1) hours?: number;
  @IsOptional() @IsInt() @Min(1) limit?: number;
}

class ProspectiaIngestBody {
  @IsOptional() @IsIn(['incremental', 'backfill']) mode?: 'incremental' | 'backfill';
  @IsOptional() @IsInt() @Min(1) maxPages?: number;
}

class ListOpportunitiesQuery {
  @IsOptional() @IsIn([...EDUCATION_CATEGORY_SCOPES]) categoria?: string;
  @IsOptional() @IsString() @MaxLength(32) channel?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['recent', 'solo_contacto', 'open', 'closed', 'unassigned', 'all']) view?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

class ActivityBody {
  @IsOptional() @IsInt() @Min(1) waCycleId?: number;
  @IsOptional() @IsString() @MaxLength(40) opportunityId?: string;
  @IsOptional() @IsInt() @Min(1) waContactId?: number;
  @IsIn(['call', 'email', 'whatsapp', 'other']) channel!: string;
  @IsOptional() @IsIn(['inbound', 'outbound']) direction?: string;
  @IsString() occurredAt!: string;
  @IsIn(['attempted', 'reached', 'no_answer', 'left_voicemail', 'bounced', 'other']) result!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) externalRef?: string;
  @IsOptional() @IsString() @MaxLength(40) externalSystem?: string;
}

class AssociatePaymentBody {
  @IsInt() @Min(1) waCycleId!: number;
  @IsOptional() @IsInt() @Min(1) waContactId?: number;
  @IsString() @MaxLength(120) transactionCode!: string;
  @IsOptional() @IsNumber() amountAgreed?: number;
  @IsOptional() @IsString() @MaxLength(200) itemLabel?: string;
}

class ApplyPaymentBody {
  @IsString() saleId!: string;
  @IsIn(['niubiz', 'paycash', 'mercadopago']) provider!: 'niubiz' | 'paycash' | 'mercadopago';
  @IsString() providerPaymentId!: string;
  @IsString() transactionCode!: string;
  @IsNumber() amountApplied!: number;
  @IsOptional() @IsString() currency?: string;
}

class BillingBody {
  @IsIn(['pending', 'obs', 'obs_asesor', 'boleteado']) billingStatus!: 'pending' | 'obs' | 'obs_asesor' | 'boleteado';
  @IsOptional() @IsString() @MaxLength(2000) billingNote?: string;
  @IsOptional() @IsString() @MaxLength(120) enrollmentRef?: string;
}

class ReversePaymentBody {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

@Controller('crm-educacion')
@RequireModule(AppModule.crm_educacion)
export class CrmEducacionController {
  constructor(
    private readonly crm: CrmEducacionService,
    private readonly activities: EducacionActivityService,
    private readonly sales: EducacionSaleService,
    private readonly opportunities: EducacionOpportunityService,
    private readonly prospectiaIngest: ProspectiaIngestService,
    private readonly anuraIngest: AnuraIngestService,
  ) {}

  @Get('contacts')
  contacts(@Query() query: ListContactsQuery) {
    return this.crm.contacts(query);
  }

  @Post('prospectia/check')
  prospectiaCheck(@Body() body: ProspectiaCheckBody) {
    if (body.subjects.length > 50 || body.subjects.some((subject) =>
      subject.key.length > 160 || (subject.phone?.length ?? 0) > 32 ||
      (subject.username?.length ?? 0) > 64 || (subject.whatsapp_user_id?.length ?? 0) > 128)) {
      throw new BadRequestException('Máximo 50 contactos');
    }
    return this.crm.checkProspectia(body.subjects);
  }

  @Patch('contacts/:id')
  patchContact(@Param('id', ParseIntPipe) id: number, @Body() body: PatchContactBody) {
    return this.crm.patchContact(id, body);
  }

  @Get('catalogs')
  catalogs() {
    return this.crm.catalogs();
  }

  @Get('leads')
  leads(@Query() query: ListLeadsQuery) {
    return this.crm.leads(query);
  }

  @Get('cycles')
  cycles(@Query() query: ListCyclesQuery) {
    return this.crm.cycles(query);
  }

  @Get('sla')
  sla(@Query() query: SlaQuery) {
    return this.crm.sla(query);
  }

  @Get('management-catalogs')
  managementCatalogs() {
    return this.crm.managementCatalogs();
  }

  /** F4 scaffolding: quién escribe lo comercial. Default wa hasta cutover. */
  @Get('commercial-authority')
  commercialAuthority() {
    const raw = String(process.env.COMMERCIAL_AUTHORITY ?? 'wa').trim().toLowerCase();
    const authority = raw === 'one' ? 'one' : 'wa';
    return {
      authority,
      messaging: 'whatsapp',
      note: authority === 'wa'
        ? 'Motor comercial en mali-whatsapp; Prospectia ingresa nativo en ONE. Mensajería no se tumba en cutover.'
        : 'Motor comercial en ONE; WA solo canal + hechos.',
    };
  }

  @Get('opportunities')
  listOpportunities(@Query() query: ListOpportunitiesQuery) {
    return this.opportunities.list({
      categoria: query.categoria,
      channel: query.channel,
      q: query.q,
      view: query.view,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Post('prospectia/ingest')
  prospectiaIngestStart(@Body() body: ProspectiaIngestBody) {
    return this.prospectiaIngest.start({
      mode: body.mode ?? 'incremental',
      maxPages: body.maxPages,
    });
  }

  @Get('prospectia/ingest')
  prospectiaIngestStatus() {
    return this.prospectiaIngest.status();
  }

  @Post('prospectia/import')
  prospectiaImport(@Body() body: ProspectiaImportBody) {
    if (!body.phone && !body.username && !body.whatsapp_user_id) {
      throw new BadRequestException('Indica phone, username o whatsapp_user_id');
    }
    return this.prospectiaIngest.importByLookup({
      phone: body.phone,
      username: body.username,
      whatsapp_user_id: body.whatsapp_user_id,
      category: body.category,
      name: body.name,
      lastName: body.last_name,
      email: body.email,
    });
  }

  @Patch('contacts/:id/management')
  management(@Param('id', ParseIntPipe) id: number, @Body() body: ManagementBody, @Req() req: Request) {
    return this.crm.management(id, body, (req.user as User).email);
  }

  @Post('distribute')
  distribute(@Body() body: DistributeBody, @Req() req: Request) {
    return this.crm.distribute(body, (req.user as User).email);
  }

  @Patch('leads/:id/review')
  review(@Param('id', ParseIntPipe) id: number, @Body() body: ReviewBody, @Req() req: Request) {
    return this.crm.review(id, body, (req.user as User).email);
  }

  @Post('leads/manual')
  createManualLead(@Body() body: ManualLeadBody, @Req() req: Request) {
    return this.crm.createManualLead(body, (req.user as User).email);
  }

  @Get('activities')
  listActivities(
    @Query('waCycleId') waCycleIdRaw?: string,
    @Query('opportunityId') opportunityId?: string,
  ) {
    const waCycleId = waCycleIdRaw ? Number(waCycleIdRaw) : NaN;
    if (opportunityId?.trim()) {
      return this.activities.listByOpportunity(opportunityId.trim());
    }
    if (!Number.isInteger(waCycleId) || waCycleId < 1) {
      throw new BadRequestException('Indica waCycleId u opportunityId');
    }
    return this.activities.listByCycle(waCycleId);
  }

  @Post('activities')
  createActivity(@Body() body: ActivityBody, @Req() req: Request) {
    return this.activities.create({
      ...body,
      actorEmail: (req.user as User).email,
    });
  }

  @Get('activities/anura-contract')
  anuraContract() {
    return {
      ...this.activities.anuraContract(),
      status: this.anuraIngest.status().enabled ? 'ready' : 'needs_credentials',
      runtime: this.anuraIngest.status(),
    };
  }

  @Get('activities/anura/recent')
  anuraRecent(@Query('limit') limitRaw?: string) {
    const limit = limitRaw ? Number(limitRaw) : 30;
    return this.anuraIngest.listRecent(Number.isFinite(limit) ? limit : 30);
  }

  @Post('activities/anura/import')
  anuraImport(@Body() body: AnuraImportBody) {
    return this.anuraIngest.importHours(body.hours ?? 24, body.limit ?? 2000);
  }

  @Get('sales/by-cycle/:waCycleId')
  saleByCycle(@Param('waCycleId', ParseIntPipe) waCycleId: number) {
    return this.sales.getByCycle(waCycleId);
  }

  @Get('payments/lookup')
  lookupPayment(
    @Query('code') code: string,
    @Query('provider') provider?: string,
  ) {
    const p = String(provider ?? 'all').trim().toLowerCase();
    const allowed = ['all', 'niubiz', 'paycash', 'mercadopago'] as const;
    const selected = (allowed as readonly string[]).includes(p)
      ? (p as (typeof allowed)[number])
      : 'all';
    return this.sales.lookupTransaction(code, selected);
  }

  @Post('payments/associate')
  associatePayment(@Body() body: AssociatePaymentBody, @Req() req: Request) {
    return this.sales.associateCode({
      ...body,
      actorEmail: (req.user as User).email,
    });
  }

  @Post('payments/apply')
  applyPayment(@Body() body: ApplyPaymentBody, @Req() req: Request) {
    return this.sales.applyPayment({
      ...body,
      actorEmail: (req.user as User).email,
    });
  }

  @Post('payments/applications/:id/reverse')
  reversePayment(
    @Param('id') id: string,
    @Body() body: ReversePaymentBody,
    @Req() req: Request,
  ) {
    return this.sales.reverseApplication(id, {
      actorEmail: (req.user as User).email,
      reason: body.reason,
    });
  }

  @Patch('sales/:id/billing')
  patchBilling(@Param('id') id: string, @Body() body: BillingBody) {
    return this.sales.patchBilling(id, body);
  }
}
