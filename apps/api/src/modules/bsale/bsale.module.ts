import { Module } from '@nestjs/common';
import { BsaleClientService } from './bsale-client.service';
import { BsaleController } from './bsale.controller';
import { BsaleExportService } from './bsale-export.service';
import { BsaleKardexService } from './bsale-kardex.service';

@Module({
  controllers: [BsaleController],
  providers: [BsaleClientService, BsaleKardexService, BsaleExportService],
})
export class BsaleModule {}
