import type { ScreenCastPublicItemDto } from '@mali-one/shared';
import { isCorsCacheableMediaUrl } from '@/lib/screen-cast-offline';

export const MEASURE_TIMEOUT_MS = 10_000;
export const CLIENT_GO_FALLBACK_MS = 15_000;
/** Only seek videos on item start — in-playback seeks cause visible freezes on TVs. */
export const VIDEO_START_SEEK_MS = 120;
export const DRIFT_INTERVAL_MS = 750;

export type PlaylistClock = {
  syncId: string;
  epochMs: number;
  durationsMs: number[];
};

export type PlaylistSyncPayload = {
  syncId?: string | null;
  playlistId?: string | null;
  empty?: boolean;
  catchUp?: boolean;
  epochMs?: number;
  durationsMs?: number[];
  serverNow?: number;
};

export type PlayGoPayload = {
  syncId?: string;
  playlistId?: string;
  epochMs: number;
  durationsMs?: number[];
  serverNow?: number;
};

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Offset so Date.now() + offset ≈ server time. Uses mid-RTT. */
export function clockOffsetFromAck(
  serverNow: number,
  sentAt: number,
  receivedAt: number,
): number {
  const localMid = (sentAt + receivedAt) / 2;
  return serverNow - localMid;
}

export function resolveDurations(
  items: ScreenCastPublicItemDto[],
  canonical: number[] | undefined,
  fallback: number[] | undefined,
): number[] {
  return items.map((item, i) => {
    const candidates = [
      canonical?.[i],
      fallback?.[i],
      item.durationMs,
    ].filter(
      (value): value is number =>
        Number.isFinite(value) && (value as number) > 0,
    );
    if (candidates.length === 0) return 10_000;
    return Math.max(...candidates);
  });
}

export type TimelinePos = {
  index: number;
  offsetMs: number;
  remainingMs: number;
  waitMs: number;
};

export function positionAt(
  durationsMs: number[],
  epochMs: number,
  nowMs: number,
): TimelinePos | null {
  if (durationsMs.length === 0) return null;
  if (nowMs < epochMs) {
    const first = durationsMs[0] || 10_000;
    return {
      index: 0,
      offsetMs: 0,
      remainingMs: first,
      waitMs: epochMs - nowMs,
    };
  }
  const cycle = durationsMs.reduce((sum, d) => sum + Math.max(0, d), 0);
  if (cycle <= 0) {
    return { index: 0, offsetMs: 0, remainingMs: 10_000, waitMs: 0 };
  }
  let t = (nowMs - epochMs) % cycle;
  for (let i = 0; i < durationsMs.length; i++) {
    const d = Math.max(1, durationsMs[i] || 10_000);
    if (t < d) {
      return {
        index: i,
        offsetMs: t,
        remainingMs: d - t,
        waitMs: 0,
      };
    }
    t -= d;
  }
  return { index: 0, offsetMs: 0, remainingMs: durationsMs[0] || 10_000, waitMs: 0 };
}

function fallbackDuration(item: ScreenCastPublicItemDto): number {
  return item.durationMs || 10_000;
}

export async function measureItemDurationMs(
  item: ScreenCastPublicItemDto,
  timeoutMs: number,
): Promise<number> {
  if (item.mediaType !== 'video') return fallbackDuration(item);

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    let done = false;
    const finish = (ms: number) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try {
        video.removeAttribute('src');
        video.load();
      } catch {
        // Tizen may throw on cleanup
      }
      resolve(ms);
    };
    const readDuration = () => {
      const d = video.duration;
      if (Number.isFinite(d) && d > 0) {
        finish(Math.round(d * 1000));
        return true;
      }
      return false;
    };
    const timer = window.setTimeout(
      () => finish(fallbackDuration(item)),
      timeoutMs,
    );
    video.onloadedmetadata = () => {
      if (readDuration()) return;
      finish(fallbackDuration(item));
    };
    video.ondurationchange = () => {
      readDuration();
    };
    video.onerror = () => finish(fallbackDuration(item));
    if (isCorsCacheableMediaUrl(item.mediaUrl)) {
      video.crossOrigin = 'anonymous';
    }
    video.src = item.mediaUrl;
    video.load();
  });
}

export async function measureAllDurations(
  items: ScreenCastPublicItemDto[],
  timeoutMs: number,
): Promise<number[]> {
  return Promise.all(
    items.map((item) => measureItemDurationMs(item, timeoutMs)),
  );
}

/** Decode/buffer the item we are about to show so play() is instant. */
export async function warmupItem(
  item: ScreenCastPublicItemDto | undefined,
  timeoutMs: number,
  warmVideo: HTMLVideoElement | null,
): Promise<void> {
  if (!item) return;
  if (item.mediaType === 'image' || item.mediaType === 'gif') {
    await Promise.race([
      (async () => {
        const img = new Image();
        if (isCorsCacheableMediaUrl(item.mediaUrl)) {
          img.crossOrigin = 'anonymous';
        }
        img.src = item.mediaUrl;
        if (typeof img.decode === 'function') {
          await img.decode();
        } else {
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('img'));
          });
        }
      })().catch(() => undefined),
      waitMs(timeoutMs),
    ]);
    return;
  }

  if (item.mediaType !== 'video' || !warmVideo) return;
  await Promise.race([
    new Promise<void>((resolve) => {
      const finish = () => {
        warmVideo.removeEventListener('canplay', finish);
        warmVideo.removeEventListener('error', finish);
        resolve();
      };
      warmVideo.muted = true;
      warmVideo.preload = 'auto';
      if (isCorsCacheableMediaUrl(item.mediaUrl)) {
        warmVideo.crossOrigin = 'anonymous';
      } else {
        warmVideo.removeAttribute('crossorigin');
      }
      warmVideo.addEventListener('canplay', finish, { once: true });
      warmVideo.addEventListener('error', finish, { once: true });
      warmVideo.src = item.mediaUrl;
      warmVideo.load();
    }),
    waitMs(timeoutMs),
  ]);
}
