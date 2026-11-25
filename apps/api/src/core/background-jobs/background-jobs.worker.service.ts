import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Cron } from '@nestjs/schedule';
import { BackgroundJobType } from '@prisma/client';
import { isBackgroundProcess } from '../process-role';
import { BackgroundJobsService } from './background-jobs.service';

@Injectable()
export class BackgroundJobsWorkerService {
  private readonly logger = new Logger(BackgroundJobsWorkerService.name);
  private draining = false;

  constructor(
    private readonly jobs: BackgroundJobsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Cron('*/3 * * * * *')
  async drain() {
    if (!isBackgroundProcess() || this.draining) return;
    this.draining = true;
    try {
      // Process a few jobs per tick without blocking the event loop forever.
      for (let i = 0; i < 3; i += 1) {
        const job = await this.jobs.claimNext();
        if (!job) break;
        try {
          await this.dispatch(job.type, (job.payload ?? {}) as Record<string, unknown>);
          await this.jobs.complete(job.id);
        } catch (error) {
          await this.jobs.fail(job.id, error);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async dispatch(type: BackgroundJobType, payload: Record<string, unknown>) {
    this.logger.log(`background_job_start type=${type}`);
    switch (type) {
      case BackgroundJobType.niubiz_sales_sync: {
        const { NiubizSyncService } = await import(
          '../../modules/treasury/niubiz-sync.service'
        );
        const niubiz = this.moduleRef.get(NiubizSyncService, { strict: false });
        await niubiz.start(
          {
            from: typeof payload.from === 'string' ? payload.from : undefined,
            to: typeof payload.to === 'string' ? payload.to : undefined,
          },
          this.actorFrom(payload),
          { forceLocal: true },
        );
        return;
      }
      case BackgroundJobType.niubiz_paycash_sync: {
        const { NiubizPayCashService } = await import(
          '../../modules/treasury/niubiz-paycash.service'
        );
        const paycash = this.moduleRef.get(NiubizPayCashService, { strict: false });
        await paycash.start(this.actorFrom(payload), { forceLocal: true });
        return;
      }
      case BackgroundJobType.mercadopago_sync: {
        const { MercadoPagoSyncService } = await import(
          '../../modules/treasury/mercadopago-sync.service'
        );
        const mp = this.moduleRef.get(MercadoPagoSyncService, { strict: false });
        const sourceId = String(payload.sourceId ?? '');
        const actor = this.actorFrom(payload);
        if (!sourceId || !actor) {
          throw new Error('mercadopago_sync requiere sourceId y actor');
        }
        await mp.start(
          sourceId,
          {
            from: typeof payload.from === 'string' ? payload.from : undefined,
            to: typeof payload.to === 'string' ? payload.to : undefined,
          },
          actor,
          { forceLocal: true },
        );
        return;
      }
      case BackgroundJobType.prospectia_ingest: {
        const { ProspectiaIngestService } = await import(
          '../../modules/crm-educacion/prospectia/prospectia-ingest.service'
        );
        const ingest = this.moduleRef.get(ProspectiaIngestService, { strict: false });
        const mode =
          payload.mode === 'backfill' ? 'backfill' : 'incremental';
        const maxPages =
          typeof payload.maxPages === 'number' ? payload.maxPages : undefined;
        const result = await ingest.start(
          { mode, maxPages },
          { forceLocal: true },
        );
        if (!result.started) {
          throw new Error(`prospectia_ingest no inició: ${result.reason}`);
        }
        return;
      }
      default:
        throw new Error(`Tipo de job desconocido: ${type}`);
    }
  }

  private actorFrom(payload: Record<string, unknown>) {
    const id = typeof payload.actorId === 'string' ? payload.actorId : null;
    const email = typeof payload.actorEmail === 'string' ? payload.actorEmail : null;
    if (!id || !email) return undefined;
    return { id, email };
  }
}
