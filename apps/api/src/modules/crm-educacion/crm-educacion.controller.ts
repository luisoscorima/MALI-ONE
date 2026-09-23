import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { AppModule } from '@prisma/client';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
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
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
}

class PatchContactBody {
  @IsIn(AREAS.slice(1)) area!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() last_name?: string;
  @IsOptional() @IsString() email?: string | null;
  @IsOptional() @IsString() dni?: string | null;
  @IsOptional() @IsObject() attributes?: Record<string, string>;
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
}
