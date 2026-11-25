import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/** Lightweight lag probe — logs when the timer fires later than expected. */
@Injectable()
export class EventLoopLagService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventLoopLagService.name);
  private timer?: NodeJS.Timeout;
  private readonly intervalMs = Number(process.env.EVENT_LOOP_LAG_INTERVAL_MS ?? 10_000);
  private readonly warnMs = Number(process.env.EVENT_LOOP_LAG_WARN_MS ?? 100);

  onModuleInit() {
    if (!Number.isFinite(this.intervalMs) || this.intervalMs < 1000) return;

    let expected = Date.now() + this.intervalMs;
    this.timer = setInterval(() => {
      const now = Date.now();
      const lagMs = now - expected;
      expected = now + this.intervalMs;
      if (lagMs >= this.warnMs) {
        this.logger.warn(`event_loop_lag ms=${Math.round(lagMs)}`);
      }
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
