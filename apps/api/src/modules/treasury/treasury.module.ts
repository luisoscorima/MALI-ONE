import { Module } from '@nestjs/common';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';
import { TreasuryPaymentsService } from './treasury-payments.service';
import { NiubizSyncService } from './niubiz-sync.service';

@Module({ controllers: [TreasuryController], providers: [TreasuryService, TreasuryPaymentsService, NiubizSyncService] })
export class TreasuryModule {}
