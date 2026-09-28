import { Module } from '@nestjs/common';
import { CatalogEducacionController } from './catalog-educacion.controller';
import { CatalogEducacionService } from './catalog-educacion.service';

@Module({
  controllers: [CatalogEducacionController],
  providers: [CatalogEducacionService],
  exports: [CatalogEducacionService],
})
export class CatalogEducacionModule {}
