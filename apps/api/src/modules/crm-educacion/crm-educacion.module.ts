import { Module } from '@nestjs/common';
import { CrmEducacionController } from './crm-educacion.controller';
import { CrmEducacionService } from './crm-educacion.service';

@Module({
  controllers: [CrmEducacionController],
  providers: [CrmEducacionService],
})
export class CrmEducacionModule {}
