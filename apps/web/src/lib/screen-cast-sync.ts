import type { ScreenCastPublicItemDto } from '@mali-one/shared';
import { isCorsCacheableMediaUrl } from '@/lib/screen-cast-offline';

export const MEASURE_TIMEOUT_MS = 10_000;
export const CLIENT_GO_FALLBACK_MS = 18_000;
export const DRIFT_INTERVAL_MS = 400;
/**
 * Per-video budget for the background download. Generous on purpose: it never
 * blocks playback, and a kiosk link needs minutes for a 20 MB clip.
 */
export const VIDEO_PRELOAD_BUDGET_MS = 4 * 60_000;
/** Ignore clock samples with huge RTT — they shift the wall by 1–2s. */
export const MAX_CLOCK_RTT_MS = 400;
/** Seconds of forward buffer before a screen reports ready. */
export const VIDEO_BUFFER_GOAL_S = 2;

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

export function mediaHasForwardBuffer(
  video: HTMLVideoElement,
  seconds = VIDEO_BUFFER_GOAL_S,
): boolean {
  if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return true;
  if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return false;
  try {
    const t = video.currentTime || 0;
    if (video.buffered.length === 0) return false;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= t + 0.15 && video.buffered.end(i) >= t + seconds) {
        return true;
      }
    }
    return false;
  } catch {
    return video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA;
  }
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
        if (
          mediaHasForwardBuffer(warmVideo) ||
          warmVideo.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
        ) {
          finish();
        }
      };
      const onError = () => finish();
      warmVideo.addEventListener('canplay', onProgress);
      warmVideo.addEventListener('canplaythrough', onProgress);
      warmVideo.addEventListener('loadeddata', onProgress);
      warmVideo.addEventListener('progress', onProgress);
      warmVideo.addEventListener('error', onError, { once: true });
      onProgress();
    }),
    waitMs(timeoutMs),
  ]);
  try {
    warmVideo.pause();
  } catch {
    // Tizen
  }
}
