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
import { AnuraWebhookController } from './anura/anura-webhook.controller';
import { EducacionBandejaService } from './educacion-bandeja.service';

@Module({
  controllers: [CrmEducacionController, CrmEducacionInternalController, AnuraWebhookController],
  providers: [
    CrmEducacionService,
    EducacionActivityService,
    EducacionSaleService,
    EducacionBandejaService,
    ProspectiaClientService,
    ProspectiaIngestService,
    EducacionOpportunityService,
    AnuraClientService,
    AnuraIngestService,
  ],
  exports: [EducacionSaleService, EducacionOpportunityService, ProspectiaIngestService, EducacionBandejaService],
})
export class CrmEducacionModule {}
