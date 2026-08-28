const MEDIA_CACHE = 'screen-cast-video-v1';

/**
 * A kiosk link is slow, not dead. Abort only when no byte has arrived for this
 * long — a total-time budget kills transfers that were about to finish.
 */
const DOWNLOAD_QUIET_TIMEOUT_MS = 45_000;
/** Absolute ceiling so a single file cannot own the queue forever. */
const DOWNLOAD_CEILING_MS = 20 * 60_000;
const QUIET_CHECK_MS = 2_000;
/** Range resumes inside one download attempt before the queue backs off. */
const RESUME_RETRIES = 3;
const RESUME_DELAY_MS = 3_000;
/** Past this many failures the player may stream the file instead. */
const MAX_DOWNLOAD_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [8_000, 30_000, 90_000];
/** Breathing room for the socket between files. */
const BETWEEN_FILES_MS = 400;
const IDLE_POLL_MS = 5_000;
/**
 * Bytes allowed to pile up in the page heap before they are folded into a
 * Blob. Holding a whole clip as typed arrays — and copying it a second time to
 * build the final Blob — is tens of MB on the same thread that has to answer
 * socket pings, and on Tizen the GC pause that follows is long enough to be
 * read as a dead screen.
 */
const HEAP_FLUSH_BYTES = 2 * 1024 * 1024;

export type VideoCacheState =
  /** Not downloaded yet, and worth another attempt. */
  | 'pending'
  | 'downloading'
  /** Fully downloaded — playback never touches the network. */
  | 'ready'
  /** Cannot be downloaded at all; the player has to stream it. */
  | 'unavailable';

type CacheEntry = {
  state: VideoCacheState;
  objectUrl: string | null;
  receivedBytes: number;
  totalBytes: number;
  attempts: number;
  nextAttemptAt: number;
};

const entries = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

export type VideoCacheListener = (src: string, state: VideoCacheState) => void;
const listeners = new Set<VideoCacheListener>();

function emptyEntry(): CacheEntry {
  return {
    state: 'pending',
    objectUrl: null,
    receivedBytes: 0,
    totalBytes: 0,
    attempts: 0,
    nextAttemptAt: 0,
  };
}

function getEntry(src: string): CacheEntry {
  let entry = entries.get(src);
  if (!entry) {
    entry = emptyEntry();
    entries.set(src, entry);
  }
  return entry;
}

function setState(src: string, entry: CacheEntry, state: VideoCacheState) {
  if (entry.state === state) return;
  entry.state = state;
  for (const listener of [...listeners]) {
    try {
      listener(src, state);
    } catch {
      // a bad listener must not stall the queue
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

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
  return entries.get(src)?.objectUrl ?? null;
}

/** Original media URLs that already have a complete local copy. */
export function readyVideoUrls(candidates: Iterable<string>): string[] {
  const seen = new Set<string>();
  const ready: string[] = [];
  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);
    if (cachedVideoUrl(url)) ready.push(url);
  }
  return ready;
}

export function videoCacheState(src: string): VideoCacheState {
  return entries.get(src)?.state ?? 'pending';
}

/**
 * True when a local copy will never arrive, so streaming from S3 is the only
 * way to ever show this clip.
 */
export function isVideoStreamOnly(src: string): boolean {
  return videoCacheState(src) === 'unavailable';
}

export type VideoCacheStats = {
  total: number;
  ready: number;
  unavailable: number;
  /** File currently being pulled, if any. */
  activeSrc: string | null;
  activePercent: number;
};

export function videoCacheStats(urls: string[]): VideoCacheStats {
  // The same clip can appear twice in a playlist but is downloaded once.
  const unique = [...new Set(urls)];
  const stats: VideoCacheStats = {
    total: unique.length,
    ready: 0,
    unavailable: 0,
    activeSrc: null,
    activePercent: 0,
  };
  for (const url of unique) {
    const entry = entries.get(url);
    if (!entry) continue;
    if (entry.state === 'ready') stats.ready += 1;
    if (entry.state === 'unavailable') stats.unavailable += 1;
    if (entry.state === 'downloading' && !stats.activeSrc) {
      stats.activeSrc = url;
      stats.activePercent =
        entry.totalBytes > 0
          ? Math.min(100, Math.round((entry.receivedBytes / entry.totalBytes) * 100))
          : 0;
    }
  }
  return stats;
}

async function openMediaCache(): Promise<Cache | null> {
  if (!('caches' in window)) return null;
  try {
    return await caches.open(MEDIA_CACHE);
  } catch {
    return null;
  }
}

/**
 * A short read yields a video that ends after a couple of seconds, so the
 * bytes must match Content-Length before we trust (or store) them.
 */
async function readCompleteBlob(res: Response): Promise<Blob | null> {
  const declared = Number(res.headers.get('Content-Length') || '0');
  const blob = await res.blob();
  if (blob.size === 0) return null;
  if (declared > 0 && blob.size !== declared) return null;
  return blob;
}

async function cachedBlob(proxyUrl: string): Promise<Blob | null> {
  const cache = await openMediaCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(proxyUrl);
    if (!hit?.ok) return null;
    const blob = await readCompleteBlob(hit);
    if (blob) return blob;
    await cache.delete(proxyUrl);
  } catch {
    // fall through to the network
  }
  return null;
}

async function storeBlob(proxyUrl: string, blob: Blob): Promise<void> {
  const cache = await openMediaCache();
  if (!cache) return;
  try {
    // Store the validated bytes, never the live stream.
    await cache.put(
      proxyUrl,
      new Response(blob, {
        headers: {
          'Content-Type': blob.type || 'video/mp4',
          'Content-Length': String(blob.size),
        },
      }),
    );
  } catch {
    // quota — playback still works from memory
  }
}

/** Total size out of `Content-Range: bytes 100-999/1000`. */
function totalFromContentRange(header: string | null): number {
  if (!header) return 0;
  const total = Number(header.split('/')[1]);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/**
 * Pull the file while tracking progress. A slow-but-alive transfer is never
 * cancelled, and a connection that dies part way is resumed with a Range
 * request instead of starting the whole clip over.
 *
 * Bytes are handed to the browser as Blob parts as they arrive, so the page
 * heap never holds more than one flush window of the clip.
 */
async function downloadWithProgress(
  proxyUrl: string,
  entry: CacheEntry,
): Promise<Blob | null> {
  /** Already handed over to the browser's blob store. */
  const parts: Blob[] = [];
  let pending: BlobPart[] = [];
  let pendingBytes = 0;
  let received = 0;
  let total = 0;
  let contentType = 'video/mp4';
  entry.receivedBytes = 0;
  entry.totalBytes = 0;

  const flush = () => {
    if (pendingBytes === 0) return;
    parts.push(new Blob(pending));
    pending = [];
    pendingBytes = 0;
  };
  const discard = () => {
    parts.length = 0;
    pending = [];
    pendingBytes = 0;
  };

  for (let attempt = 0; attempt <= RESUME_RETRIES; attempt++) {
    const controller = new AbortController();
    const startedAt = Date.now();
    let lastByteAt = startedAt;
    let progressed = false;
    let completed = false;
    const quietWatch = window.setInterval(() => {
      if (
        Date.now() - lastByteAt > DOWNLOAD_QUIET_TIMEOUT_MS ||
        Date.now() - startedAt > DOWNLOAD_CEILING_MS
      ) {
        controller.abort();
      }
    }, QUIET_CHECK_MS);

    try {
      // no-store: our own cache is the only copy we trust.
      const res = await fetch(proxyUrl, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
        ...(received > 0
          ? { headers: { Range: `bytes=${received}-` } }
          : {}),
      });
      if (!res.ok) return null;

      // A server (or proxy) that ignores Range answers 200 with the whole
      // file — the bytes we already had would corrupt the result.
      if (received > 0 && res.status !== 206) {
        discard();
        received = 0;
        entry.receivedBytes = 0;
      }

      contentType = res.headers.get('Content-Type') || contentType;
      const declared = Number(res.headers.get('Content-Length') || '0');
      const ranged = totalFromContentRange(res.headers.get('Content-Range'));
      total = ranged || (declared > 0 ? received + declared : total);
      entry.totalBytes = total;

      const body = res.body;
      if (!body || typeof body.getReader !== 'function') {
        // Old WebKit without streaming fetch: one shot, no progress reporting.
        const blob = await res.blob();
        if (blob.size === 0) return null;
        parts.push(blob);
        received += blob.size;
        entry.receivedBytes = received;
      } else {
        const reader = body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          lastByteAt = Date.now();
          progressed = true;
          pending.push(value as BlobPart);
          pendingBytes += value.byteLength;
          received += value.byteLength;
          entry.receivedBytes = received;
          if (pendingBytes >= HEAP_FLUSH_BYTES) flush();
        }
      }
      completed = true;
    } catch {
      // Aborted or dropped: resume below if anything at all came through.
      if (!progressed) return null;
    } finally {
      window.clearInterval(quietWatch);
    }

    flush();
    if (received === 0) return null;
    if (total > 0 && received > total) return null;
    // A truncated file plays for a couple of seconds and then ends, so it is
    // never handed to the player. Without a declared length the only proof of
    // completeness is having drained the stream.
    const incomplete = total > 0 ? received < total : !completed;
    if (incomplete) {
      if (attempt === RESUME_RETRIES) return null;
      await sleep(RESUME_DELAY_MS);
      continue;
    }
    // Concatenating Blobs references the parts the browser already stored; it
    // does not copy the clip back into the heap.
    return new Blob(parts, { type: contentType });
  }
  return null;
}

function backoffFor(attempts: number): number {
  const index = Math.min(attempts, RETRY_BACKOFF_MS.length) - 1;
  return RETRY_BACKOFF_MS[Math.max(0, index)];
}

/**
 * Download the whole video so playback never touches the network.
 * Returns null when the file cannot be fetched — the caller decides whether to
 * hold the slot or stream from S3.
 */
export async function ensureVideoBlobUrl(src: string): Promise<string | null> {
  const entry = getEntry(src);
  if (entry.objectUrl) return entry.objectUrl;

  const running = inflight.get(src);
  if (running) return running;

  if (!isProxyableMediaUrl(src)) {
    setState(src, entry, 'unavailable');
    return null;
  }

  const proxyUrl = screenCastMediaProxyUrl(src);
  const task = (async () => {
    setState(src, entry, 'downloading');
    entry.receivedBytes = 0;

    let blob = await cachedBlob(proxyUrl);
    if (!blob) {
      blob = await downloadWithProgress(proxyUrl, entry);
      if (blob) await storeBlob(proxyUrl, blob);
    }

    if (!blob) {
      entry.attempts += 1;
      entry.nextAttemptAt = Date.now() + backoffFor(entry.attempts);
      setState(
        src,
        entry,
        entry.attempts >= MAX_DOWNLOAD_ATTEMPTS ? 'unavailable' : 'pending',
      );
      return null;
    }

    const objectUrl = URL.createObjectURL(blob);
    entry.objectUrl = objectUrl;
    entry.totalBytes = blob.size;
    entry.receivedBytes = blob.size;
    entry.attempts = 0;
    setState(src, entry, 'ready');
    return objectUrl;
  })().finally(() => {
    inflight.delete(src);
  });

  inflight.set(src, task);
  return task;
}

function shouldAttempt(src: string): boolean {
  const entry = entries.get(src);
  if (!entry) return true;
  if (entry.state === 'ready' || entry.state === 'downloading') return false;
  if (entry.state === 'unavailable') return false;
  return Date.now() >= entry.nextAttemptAt;
}

export type VideoPreloadHandle = { stop: () => void };

/**
 * Single-file-at-a-time download queue. Parallel transfers starve each other on
 * a kiosk link, and `getUrls` is re-read every pass so the clip the playlist is
 * about to reach is always fetched first.
 */
export function startVideoPreloadLoop(options: {
  getUrls: () => string[];
  onStateChange?: VideoCacheListener;
}): VideoPreloadHandle {
  let stopped = false;
  const listener = options.onStateChange;
  if (listener) listeners.add(listener);

  void (async () => {
    while (!stopped) {
      const next = options.getUrls().find(shouldAttempt);
      if (!next) {
        await sleep(IDLE_POLL_MS);
        continue;
      }
      await ensureVideoBlobUrl(next);
      if (stopped) break;
      await sleep(BETWEEN_FILES_MS);
    }
  })();

  return {
    stop() {
      stopped = true;
      if (listener) listeners.delete(listener);
    },
  };
}

/** Let a file that exhausted its retries try again (network came back). */
export function retryVideoDownload(src: string) {
  const entry = entries.get(src);
  if (!entry || entry.state === 'ready' || entry.state === 'downloading') return;
  entry.attempts = 0;
  entry.nextAttemptAt = 0;
  setState(src, entry, 'pending');
}

/** Drop a local copy that turned out to be unusable, so we stream instead. */
export async function invalidateVideoBlob(src: string): Promise<void> {
  const entry = entries.get(src);
  if (entry?.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
    entry.objectUrl = null;
    entry.receivedBytes = 0;
    entry.attempts += 1;
    entry.nextAttemptAt = Date.now() + backoffFor(entry.attempts);
    setState(
      src,
      entry,
      entry.attempts >= MAX_DOWNLOAD_ATTEMPTS ? 'unavailable' : 'pending',
    );
  }
  const cache = await openMediaCache();
  if (!cache) return;
  try {
    await cache.delete(screenCastMediaProxyUrl(src));
  } catch {
    // ignore
  }
}

export function releaseUnusedVideoBlobs(keep: Iterable<string>) {
  const keepSet = new Set(keep);
  for (const [src, entry] of [...entries]) {
    if (keepSet.has(src)) continue;
    // Dropping an entry mid-download orphans the blob it is about to create,
    // with no handle left to revoke it. The next sweep collects it.
    if (entry.state === 'downloading' || inflight.has(src)) continue;
    if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    entries.delete(src);
  }
}
