import type { ScreenCastPublicConfigDto } from '@mali-one/shared';

const MEDIA_CACHE = 'screen-cast-video-v1';

/** originalUrl -> object URL of the fully downloaded file. */
const blobUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function screenCastMediaProxyUrl(src: string): string {
  return `/api/screen-cast/media?src=${encodeURIComponent(src)}`;
}

/** The API only proxies screen-cast keys from our own S3/CloudFront. */
function isProxyableMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('.amazonaws.com') && !host.endsWith('.cloudfront.net')) {
      return false;
    }
    return decodeURIComponent(parsed.pathname).includes('screen-cast/');
  } catch {
    return false;
  }
}

export function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

export function cachedVideoUrl(src: string): string | null {
  return blobUrls.get(src) ?? null;
}

async function openMediaCache(): Promise<Cache | null> {
  if (!('caches' in window)) return null;
  try {
    return await caches.open(MEDIA_CACHE);
  } catch {
    return null;
  }
}

async function downloadBlob(
  proxyUrl: string,
  signal: AbortSignal,
): Promise<Blob | null> {
  const cache = await openMediaCache();
  if (cache) {
    try {
      const hit = await cache.match(proxyUrl);
      if (hit?.ok) {
        const blob = await hit.blob();
        if (blob.size > 0) return blob;
      }
    } catch {
      // fall through to network
    }
  }

  const res = await fetch(proxyUrl, { credentials: 'same-origin', signal });
  if (!res.ok) return null;
  if (cache) {
    try {
      await cache.put(proxyUrl, res.clone());
    } catch {
      // quota — playback still works from memory
    }
  }
  const blob = await res.blob();
  return blob.size > 0 ? blob : null;
}

/**
 * Download the whole video so playback never touches the network.
 * Returns null when the file cannot be proxied — caller streams from S3.
 */
export async function ensureVideoBlobUrl(
  src: string,
  timeoutMs: number,
): Promise<string | null> {
  const existing = blobUrls.get(src);
  if (existing) return existing;
  const running = inflight.get(src);
  if (running) return running;
  if (!isProxyableMediaUrl(src)) return null;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const task = (async () => {
    try {
      const blob = await downloadBlob(
        screenCastMediaProxyUrl(src),
        controller.signal,
      );
      if (!blob) return null;
      const objectUrl = URL.createObjectURL(blob);
      blobUrls.set(src, objectUrl);
      return objectUrl;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
      inflight.delete(src);
    }
  })();

  inflight.set(src, task);
  return task;
}

export type VideoPreloadResult = {
  total: number;
  cached: number;
  failed: number;
};

export async function preloadPlaylistVideos(
  config: ScreenCastPublicConfigDto,
  timeoutMs: number,
): Promise<VideoPreloadResult> {
  const videos = config.items.filter((item) => item.mediaType === 'video');
  const result: VideoPreloadResult = {
    total: videos.length,
    cached: 0,
    failed: 0,
  };
  // Sequential on purpose: parallel downloads starve each other on kiosk links.
  for (const item of videos) {
    const url = await ensureVideoBlobUrl(item.mediaUrl, timeoutMs);
    if (url) result.cached += 1;
    else result.failed += 1;
  }
  return result;
}

export function releaseUnusedVideoBlobs(keep: Iterable<string>) {
  const keepSet = new Set(keep);
  for (const [src, objectUrl] of [...blobUrls]) {
    if (keepSet.has(src)) continue;
    URL.revokeObjectURL(objectUrl);
    blobUrls.delete(src);
  }
}
