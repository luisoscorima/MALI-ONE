import { Module } from '@nestjs/common';
import { CrmEducacionModule } from '../crm-educacion/crm-educacion.module';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';
import { TreasuryPaymentsService } from './treasury-payments.service';
import { NiubizSyncService } from './niubiz-sync.service';
import { NiubizPayCashService } from './niubiz-paycash.service';
import { MercadoPagoSyncService } from './mercadopago-sync.service';

@Module({
  imports: [CrmEducacionModule],
  controllers: [TreasuryController],
  providers: [
    TreasuryService,
    TreasuryPaymentsService,
    NiubizSyncService,
    NiubizPayCashService,
    MercadoPagoSyncService,
  ],
})
export class TreasuryModule {}
