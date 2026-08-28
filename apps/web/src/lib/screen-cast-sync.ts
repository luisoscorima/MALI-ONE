import type { ScreenCastPublicItemDto } from '@mali-one/shared';
import { isCorsCacheableMediaUrl } from '@/lib/screen-cast-offline';

export const MEASURE_TIMEOUT_MS = 10_000;
export const CLIENT_GO_FALLBACK_MS = 18_000;
export const DRIFT_INTERVAL_MS = 400;
/** Ignore clock samples with huge RTT — they shift the wall by 1–2s. */
export const MAX_CLOCK_RTT_MS = 400;
/**
 * Seconds of forward buffer a streamed clip needs before it may start. Only
 * reachable when the link is fast; a local copy skips the check entirely.
 */
export const VIDEO_BUFFER_GOAL_S = 8;
/** Warming a local file is instant — never wait on it like a network read. */
export const VIDEO_WARMUP_TIMEOUT_MS = 4_000;
/** How often playback is inspected for stalls and overruns. */
export const VIDEO_WATCHDOG_MS = 300;
/** No decoded progress for this long means the clip is starving, not slow. */
export const VIDEO_STALL_GIVEUP_MS = 1_400;
/**
 * Opening a decoder is not stalling. Until the first frame lands, playback gets
 * this much slack — dropping a healthy clip that was merely slow to start is
 * far worse than a few seconds of patience.
 */
export const VIDEO_START_GRACE_MS = 6_000;
/** play() can be rejected silently on Tizen; nudge it again after this. */
export const VIDEO_PLAY_RETRY_MS = 700;
export const VIDEO_PLAY_RETRY_MAX = 4;
/** Slack over the timeline slot before playback is considered overrun. */
export const VIDEO_END_GRACE_MS = 2_000;
/**
 * currentTime cannot be assigned on Tizen, so a clip entered this far into its
 * slot would be cut short at the end. Hold the slot instead of starting it.
 */
export const VIDEO_LATE_JOIN_MS = 1_000;
/** Cooldown before a clip that starved is offered to the player again. */
export const VIDEO_HOLD_COOLDOWN_MS = 5 * 60_000;

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
  /** Videos every connected screen already has locally. */
  playableUrls?: string[];
};

export type PlayGoPayload = {
  syncId?: string;
  playlistId?: string;
  epochMs: number;
  durationsMs?: number[];
  serverNow?: number;
  /** Videos every connected screen already has locally. */
  playableUrls?: string[];
};

export function sameUrlSet(
  a: readonly string[] | null | undefined,
  b: readonly string[] | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((url) => set.has(url));
}

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

export type ClockSample = { offsetMs: number; rttMs: number };

/**
 * Offset plus the round trip it came from, so the caller can keep the best
 * reading instead of discarding every slow one.
 */
export function clockSample(
  serverNow: number | undefined,
  sentAt: number,
  receivedAt: number = Date.now(),
): ClockSample | null {
  if (!serverNow) return null;
  const rttMs = receivedAt - sentAt;
  if (rttMs < 0) return null;
  return { offsetMs: clockOffsetFromAck(serverNow, sentAt, receivedAt), rttMs };
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

export function videoSrcMatches(
  video: HTMLVideoElement,
  url: string,
): boolean {
  const attr = video.getAttribute('src') || '';
  const src = video.currentSrc || video.src || '';
  return attr === url || src === url;
}

export function prepareKioskVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = false;
  video.controls = false;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.disablePictureInPicture = true;
}

/** Seconds of contiguous data decoded ahead of the playhead. */
export function bufferedAheadSeconds(video: HTMLVideoElement): number {
  try {
    const t = video.currentTime || 0;
    const ranges = video.buffered;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= t + 0.15 && ranges.end(i) > t) {
        return ranges.end(i) - t;
      }
    }
  } catch {
    // Tizen throws on buffered before metadata lands
  }
  return 0;
}

/** True once the buffered range reaches the end of the clip. */
export function bufferedToEnd(video: HTMLVideoElement): boolean {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return false;
  return bufferedAheadSeconds(video) >= duration - (video.currentTime || 0) - 0.4;
}

export function mediaHasForwardBuffer(
  video: HTMLVideoElement,
  seconds = VIDEO_BUFFER_GOAL_S,
): boolean {
  if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return true;
  if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return false;
  // A short clip can never buffer the full goal — reaching its end is enough.
  if (bufferedToEnd(video)) return true;
  return bufferedAheadSeconds(video) >= seconds;
}

export function primeVideoSrc(video: HTMLVideoElement, url: string) {
  prepareKioskVideo(video);
  // blob: URLs are already local — crossOrigin would only break the load.
  if (!url.startsWith('blob:') && isCorsCacheableMediaUrl(url)) {
    video.crossOrigin = 'anonymous';
  } else {
    video.removeAttribute('crossorigin');
  }
  if (!videoSrcMatches(video, url)) {
    video.src = url;
  }
}

/**
 * Reload src to return to t=0. Never assign currentTime — Tizen/WebKit freeze.
 */
export function reloadVideoSource(video: HTMLVideoElement, url: string) {
  try {
    video.pause();
  } catch {
    // Tizen
  }
  video.removeAttribute('src');
  try {
    video.load();
  } catch {
    // Tizen
  }
  video.src = url;
}

export async function measureItemDurationMs(
  item: ScreenCastPublicItemDto,
  _timeoutMs: number,
): Promise<number> {
  // Never fetch the file just to read duration — that competes with playback
  // buffering on slow kiosk TVs. Use the playlist value (probed on save).
  void _timeoutMs;
  return fallbackDuration(item);
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

  // Only a local copy is worth warming. Pulling bytes through the <video>
  // element for a clip we may not even play competes with the background
  // download for the same narrow link, and both end up starved.
  if (!item.mediaUrl.startsWith('blob:')) return;
  const warmTimeoutMs = Math.min(timeoutMs, VIDEO_WARMUP_TIMEOUT_MS);

  const alreadyReady =
    videoSrcMatches(warmVideo, item.mediaUrl) &&
    mediaHasForwardBuffer(warmVideo) &&
    !warmVideo.ended &&
    warmVideo.currentTime < 0.25;

  if (alreadyReady) {
    try {
      warmVideo.pause();
    } catch {
      // Tizen
    }
    return;
  }

  const needsReload =
    !videoSrcMatches(warmVideo, item.mediaUrl) ||
    warmVideo.ended ||
    warmVideo.currentTime >= 0.25;

  if (needsReload) {
    reloadVideoSource(warmVideo, item.mediaUrl);
  } else {
    primeVideoSrc(warmVideo, item.mediaUrl);
  }

  await Promise.race([
    new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        warmVideo.removeEventListener('canplay', onProgress);
        warmVideo.removeEventListener('canplaythrough', onProgress);
        warmVideo.removeEventListener('loadeddata', onProgress);
        warmVideo.removeEventListener('progress', onProgress);
        warmVideo.removeEventListener('error', onError);
        resolve();
      };
      const onProgress = () => {
        if (mediaHasForwardBuffer(warmVideo)) finish();
      };
      const onError = () => finish();
      warmVideo.addEventListener('canplay', onProgress);
      warmVideo.addEventListener('canplaythrough', onProgress);
      warmVideo.addEventListener('loadeddata', onProgress);
      warmVideo.addEventListener('progress', onProgress);
      warmVideo.addEventListener('error', onError, { once: true });
      onProgress();
    }),
    waitMs(warmTimeoutMs),
  ]);
  try {
    warmVideo.pause();
  } catch {
    // Tizen
  }
}
