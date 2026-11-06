import { Module } from '@nestjs/common';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';
import { TreasuryPaymentsService } from './treasury-payments.service';
import { NiubizSyncService } from './niubiz-sync.service';
import { MercadoPagoSyncService } from './mercadopago-sync.service';
import { PagoEfectivoSyncService } from './pagoefectivo-sync.service';

@Module({ controllers: [TreasuryController], providers: [TreasuryService, TreasuryPaymentsService, NiubizSyncService, MercadoPagoSyncService, PagoEfectivoSyncService] })
export class TreasuryModule {}
