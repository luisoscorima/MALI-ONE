import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScreenCastGateway } from './screen-cast.gateway';
import { ScreenCastService } from './screen-cast.service';

@Injectable()
export class ScreenCastScheduleScheduler {
  private readonly logger = new Logger(ScreenCastScheduleScheduler.name);
  private readonly lastEffective = new Map<string, string | null>();

  constructor(
    private readonly service: ScreenCastService,
    private readonly gateway: ScreenCastGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tickScheduleBoundaries() {
    try {
      const rows = await this.service.listMonitorEffectivePlaylistIds();
      for (const row of rows) {
        const prev = this.lastEffective.get(row.screenKey);
        if (prev === undefined) {
          this.lastEffective.set(row.screenKey, row.playlistId);
          continue;
        }
        if (prev === row.playlistId) continue;

        this.logger.log(
          `schedule:boundary screen=${row.screenKey} from=${prev ?? 'none'} to=${row.playlistId ?? 'none'}`,
        );
        await this.gateway.applyScheduleTransition(row.screenKey);
        this.lastEffective.set(row.screenKey, row.playlistId);
      }

      const live = new Set(rows.map((r) => r.screenKey));
      for (const key of this.lastEffective.keys()) {
        if (!live.has(key)) this.lastEffective.delete(key);
      }
    } catch (err) {
      this.logger.error(
        `Error en fronteras de programación: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
