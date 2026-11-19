import { Module } from '@nestjs/common';
import { CrmEducacionController } from './crm-educacion.controller';
import { CrmEducacionInternalController } from './crm-educacion-internal.controller';
import { CrmEducacionService } from './crm-educacion.service';
import { EducacionActivityService } from './educacion-activity.service';
import { EducacionSaleService } from './educacion-sale.service';
import { EducacionOpportunityService } from './prospectia/educacion-opportunity.service';
import { ProspectiaClientService } from './prospectia/prospectia-client.service';
import { ProspectiaIngestService } from './prospectia/prospectia-ingest.service';
import { AnuraClientService } from './anura/anura-client.service';
import { AnuraIngestService } from './anura/anura-ingest.service';

@Module({
  controllers: [CrmEducacionController, CrmEducacionInternalController],
  providers: [
    CrmEducacionService,
    EducacionActivityService,
    EducacionSaleService,
    ProspectiaClientService,
    ProspectiaIngestService,
    EducacionOpportunityService,
    AnuraClientService,
    AnuraIngestService,
  ],
  exports: [EducacionSaleService, EducacionOpportunityService, ProspectiaIngestService],
})
export class CrmEducacionModule {}
