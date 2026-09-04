import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScreenCastGateway } from './screen-cast.gateway';
import { ScreenCastService } from './screen-cast.service';

/** Backup poll; primary transitions also arm exact timers on CRUD. */
const POLL_MS_CRON = '*/15 * * * * *';

@Injectable()
export class ScreenCastScheduleScheduler {
  private readonly logger = new Logger(ScreenCastScheduleScheduler.name);
  private readonly lastEffective = new Map<string, string | null>();
  private boundaryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly service: ScreenCastService,
    private readonly gateway: ScreenCastGateway,
  ) {}

  /** Keep snapshot in sync after CRUD so the poll does not miss/double-fire oddly. */
  markEffective(screenKey: string, playlistId: string | null) {
    this.lastEffective.set(screenKey.trim().toLowerCase(), playlistId);
  }

  /** Arm exact wake-ups for start/end of an override (plus poll backup). */
  armOverrideBoundaries(startsAt: string | Date, endsAt: string | Date) {
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    const now = Date.now();
    for (const at of [startMs, endMs]) {
      if (!Number.isFinite(at)) continue;
      const delay = at - now;
      if (delay < -2_000) continue;
      const key = `t:${at}`;
      if (this.boundaryTimers.has(key)) continue;
      const wait = Math.max(0, delay) + 250;
      const timer = setTimeout(() => {
        this.boundaryTimers.delete(key);
        void this.tickScheduleBoundaries();
      }, wait);
      this.boundaryTimers.set(key, timer);
    }
  }

  @Cron(POLL_MS_CRON)
  async tickScheduleBoundaries() {
    try {
      const rows = await this.service.listMonitorEffectivePlaylistIds();
      for (const row of rows) {
        const key = row.screenKey.trim().toLowerCase();
        const prev = this.lastEffective.get(key);
        if (prev === undefined) {
          this.lastEffective.set(key, row.playlistId);
          continue;
        }
        if (prev === row.playlistId) continue;

        this.logger.log(
          `schedule:boundary screen=${key} from=${prev ?? 'none'} to=${row.playlistId ?? 'none'}`,
        );
        await this.gateway.applyScheduleTransition(key);
        this.lastEffective.set(key, row.playlistId);
      }

      const live = new Set(rows.map((r) => r.screenKey.trim().toLowerCase()));
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
