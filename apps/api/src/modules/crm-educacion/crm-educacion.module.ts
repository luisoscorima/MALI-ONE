import { Module } from '@nestjs/common';
import { CrmEducacionController } from './crm-educacion.controller';
import { CrmEducacionInternalController } from './crm-educacion-internal.controller';
import { CrmEducacionService } from './crm-educacion.service';
import { EducacionActivityService } from './educacion-activity.service';
import { EducacionSaleService } from './educacion-sale.service';

@Module({
  controllers: [CrmEducacionController, CrmEducacionInternalController],
  providers: [CrmEducacionService, EducacionActivityService, EducacionSaleService],
  exports: [EducacionSaleService],
})
export class CrmEducacionModule {}
