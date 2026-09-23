import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { AppModule, type User } from '@prisma/client';
import type { Request } from 'express';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { RequireModule } from '../../core/guards/module.decorator';
import { CrmEducacionService } from './crm-educacion.service';

const AREAS = ['all', 'educacion', 'educacion_ca', 'educacion_ep'] as const;

class ListContactsQuery {
  @IsOptional() @IsIn(AREAS) area?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsString() @MaxLength(50) segment?: string;
  @IsOptional() @IsString() @MaxLength(64) attr_key?: string;
  @IsOptional() @IsString() @MaxLength(255) attr_value?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

class ListLeadsQuery {
  @IsOptional() @IsIn(AREAS) area?: string;
  @IsOptional() @IsString() @MaxLength(32) channel?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
  @IsOptional() @IsIn(['recent', 'new_number', 'duplicate', 'reassignable', 'conflict', 'in_progress', 'all']) view?: string;
  @IsOptional() @IsIn(['true', 'false']) unassigned?: string;
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

class ManagementBody {
  @IsIn(AREAS.slice(1)) area!: string;
  @IsOptional() @IsInt() @Min(1) assigned_user_id?: number | null;
  @IsOptional() @IsInt() @Min(1) lead_status_id?: number | null;
}

class DistributeBody {
  @IsIn(AREAS) area!: string;
  @IsOptional() @IsString() @MaxLength(32) channel?: string;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
}

class ReviewBody {
  @IsIn(AREAS.slice(1)) area!: string;
  @IsIn(['open_new', 'keep_existing', 'dismiss']) action!: 'open_new' | 'keep_existing' | 'dismiss';
}

class PatchContactBody {
  @IsIn(AREAS.slice(1)) area!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() last_name?: string;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() dni?: string | null;
  @IsOptional() @IsObject() attributes?: Record<string, string>;
  @IsOptional() @IsArray() @IsString({ each: true }) segment_slugs?: string[];
  @IsOptional() @IsBoolean() opt_in_email?: boolean;
  @IsOptional() @IsBoolean() opt_in?: boolean;
}

@Controller('crm-educacion')
@RequireModule(AppModule.crm_educacion)
export class CrmEducacionController {
  constructor(private readonly crm: CrmEducacionService) {}

  @Get('contacts')
  contacts(@Query() query: ListContactsQuery) {
    return this.crm.contacts(query);
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

  @Get('management-catalogs')
  managementCatalogs() {
    return this.crm.managementCatalogs();
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
}
