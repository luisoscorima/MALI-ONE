import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import type {
  ScreenCastOrientation,
  ScreenCastPublicConfigDto,
  ScreenCastPublicItemDto,
} from '@mali-one/shared';
import { api } from '@/lib/api';
import {
  cacheScreenCastPlaylist,
  isCorsCacheableMediaUrl,
  registerScreenCastServiceWorker,
} from '@/lib/screen-cast-offline';
import {
  screenCastBuildId,
  startScreenCastAutoUpdate,
} from '@/lib/screen-cast-update';
import {
  KioskToastStack,
  type KioskToast,
  type KioskToastTone,
} from '@/components/screen-cast-kiosk-toasts';
import { KioskDebugHud } from '@/components/screen-cast-debug-hud';
import {
  CLIENT_GO_FALLBACK_MS,
  DRIFT_INTERVAL_MS,
  MEASURE_TIMEOUT_MS,
  VIDEO_END_GRACE_MS,
  VIDEO_HOLD_COOLDOWN_MS,
  VIDEO_LATE_JOIN_MS,
  VIDEO_PLAY_RETRY_MAX,
  VIDEO_PLAY_RETRY_MS,
  VIDEO_STALL_GIVEUP_MS,
  VIDEO_START_GRACE_MS,
  VIDEO_WATCHDOG_MS,
  bufferedAheadSeconds,
  clockSample,
  MAX_CLOCK_RTT_MS,
  measureAllDurations,
  positionAt,
  primeVideoSrc,
  reloadVideoSource,
  resolveDurations,
  sameUrlSet,
  videoSrcMatches,
  warmupItem,
  type PlayGoPayload,
  type PlaylistClock,
  type PlaylistSyncPayload,
} from '@/lib/screen-cast-sync';
import {
  cachedVideoUrl,
  invalidateVideoBlob,
  isVideoStreamOnly,
  readyVideoUrls,
  releaseUnusedVideoBlobs,
  retryVideoDownload,
  startVideoPreloadLoop,
  videoCacheStats,
  type VideoCacheState,
} from '@/lib/screen-cast-video-cache';

const HEARTBEAT_MS = 30_000;
const KIOSK_CLASS = 'screen-cast-kiosk';

/** Long enough to be read from across a room on a kiosk TV. */
const TOAST_TTL_MS = 9_000;
const DEBUG_HUD_INTERVAL_MS = 500;
/** Ceiling for a coordinated start; beyond this the shared clock is bogus. */
const MAX_PLAY_SCHEDULE_MS = 5_000;
/** Never keep the video hidden longer than this, even if play() never lands. */
const VIDEO_COVER_MAX_MS = 2_500;
/** How often a held slot re-checks whether its clip became playable. */
const HOLD_RECHECK_MS = 3_000;

const MEDIA_FILL_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  maxHeight: 'none',
  objectFit: 'fill',
  display: 'block',
};

function destroyVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('crossorigin');
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }
    video.load();
  } catch {
    // ignore cleanup errors on Tizen
  }
}

function pauseVideoQuiet(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    video.pause();
  } catch {
    // Tizen
  }
}

function isViewportPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

function KioskLoader({ hint }: { hint?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black">
      <div
        className="h-16 w-16 rounded-full border-[3px] border-white/20 border-t-white animate-spin"
        role="status"
        aria-label="Cargando"
      />
      {hint ? (
        <p className="max-w-[80vw] px-4 text-center text-sm tracking-wide text-white/70">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function connectScreenCastSocket(screenKey: string): Socket {
  const isSecure = window.location.protocol === 'https:';
  return io(`${window.location.origin}/screen-cast`, {
    path: '/socket.io/',
    transports: ['websocket'],
    upgrade: false,
    withCredentials: true,
    secure: isSecure,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    // Default is 5s, so a wall of screens retries in lockstep against the API.
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.5,
    // Handshake budget. A link busy pulling a clip needs far more than the
    // 20s we used to allow: the manager gave up and opened the next attempt on
    // top of one that was still in flight.
    timeout: 45000,
    // Tizen fires beforeunload spuriously and would drop a healthy socket.
    closeOnBeforeunload: false,
    auth: { screenKey },
  });
}

function stageStyle(
  isPortraitConfig: boolean,
  viewportPortrait: boolean,
  vw: number,
  vh: number,
): CSSProperties {
  const fill: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  };

  if (!isPortraitConfig) return fill;
  if (viewportPortrait) return fill;

  return {
    position: 'absolute',
    width: `${vh}px`,
    height: `${vw}px`,
    top: `${(vh - vw) / 2}px`,
    left: `${(vw - vh) / 2}px`,
    transform: 'rotate(90deg)',
    transformOrigin: 'center center',
  };
}

type JoinAck = {
  ok?: boolean;
  serverNow?: number;
  clock?: PlaylistClock | null;
  playableUrls?: string[];
};

export function ScreenCastPlayerPage() {
  const [params] = useSearchParams();
  const screenKey = (params.get('id') ?? '').trim().toLowerCase();
  const isPreview = params.get('preview') === '1';
  const isDebug = params.get('debug') === '1';
  const [config, setConfig] = useState<ScreenCastPublicConfigDto | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [playbackGen, setPlaybackGen] = useState(0);
  const [loaderHint, setLoaderHint] = useState('Cargando');
  const [toasts, setToasts] = useState<KioskToast[]>([]);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [videoCovered, setVideoCovered] = useState(true);
  const [videoHolding, setVideoHolding] = useState(false);
  const [holdFrameUrl, setHoldFrameUrl] = useState<string | null>(null);
  const [viewportPortrait, setViewportPortrait] = useState(() =>
    typeof window !== 'undefined' ? isViewportPortrait() : true,
  );
  const [viewportSize, setViewportSize] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1080,
    vh: typeof window !== 'undefined' ? window.innerHeight : 1920,
  }));

  const timerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const goFallbackRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const indexRef = useRef(0);
  const itemsRef = useRef<ScreenCastPublicItemDto[]>([]);
  const preloadRef = useRef<HTMLImageElement | null>(null);
  const pendingConfigRef = useRef<ScreenCastPublicConfigDto | null>(null);
  const pendingGoRef = useRef<PlayGoPayload | null>(null);
  const joinClockRef = useRef<PlaylistClock | null>(null);
  const waitingGoRef = useRef(false);
  const readyForGoRef = useRef(false);
  const syncIdRef = useRef<string | null>(null);
  const epochMsRef = useRef<number | null>(null);
  const durationsRef = useRef<number[]>([]);
  const localDurationsRef = useRef<number[]>([]);
  const clockOffsetRef = useRef(0);
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);
  const syncTokenRef = useRef(0);
  const videoUrlRef = useRef<string | null>(null);
  const lastGoSyncRef = useRef<string | null>(null);
  const playAtTimerRef = useRef<number | null>(null);
  const scheduledPlayKeyRef = useRef<string | null>(null);
  const toastIdRef = useRef(0);
  const cachedUrlsRef = useRef<Set<string>>(new Set());
  const socketWasConnectedRef = useRef(false);
  /** True only while a clip is genuinely decoding — a held slot must not
   * freeze the shared timeline. */
  const videoPlaybackActiveRef = useRef(false);
  const videoHoldingRef = useRef(false);
  /** Last still shown, reused as the backdrop while a video slot is held. */
  const lastStillUrlRef = useRef<string | null>(null);
  /** mediaUrl -> timestamp until which the clip is not offered for playback. */
  const holdCooldownRef = useRef<Map<string, number>>(new Map());
  const stallCountRef = useRef(0);
  const heldCountRef = useRef(0);
  const preloadDoneRef = useRef(false);
  const holdRecheckRef = useRef<number | null>(null);
  /** Videos every connected screen in this playlist already has locally. */
  const playableUrlsRef = useRef<string[]>([]);
  const playableKnownRef = useRef(false);

  const nowServer = useCallback(() => Date.now() + clockOffsetRef.current, []);

  const setHold = useCallback((holding: boolean) => {
    videoHoldingRef.current = holding;
    setVideoHolding(holding);
  }, []);

  /**
   * Backdrop for a held video slot. Right after a boot nothing has been shown
   * yet, so fall back to the nearest still before this slot instead of leaving
   * the panel black.
   */
  const holdFrameFor = useCallback((slotIndex: number): string | null => {
    if (lastStillUrlRef.current) return lastStillUrlRef.current;
    const items = itemsRef.current;
    for (let back = 1; back <= items.length; back++) {
      const entry = items[(slotIndex - back + items.length * 2) % items.length];
      if (entry?.mediaType === 'image' || entry?.mediaType === 'gif') {
        return entry.mediaUrl;
      }
    }
    return null;
  }, []);

  const kioskToast = useCallback(
    (text: string, tone: KioskToastTone = 'info') => {
      if (isPreview) return;
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, TOAST_TTL_MS);
    },
    [isPreview],
  );

  const cachePlaylistInBackground = useCallback(
    (data: ScreenCastPublicConfigDto) => {
      if (isPreview || data.empty || data.items.length === 0) return;
      const urls = data.items.map((item) => item.mediaUrl);
      const prev = cachedUrlsRef.current;
      const isNew = urls.some((url) => !prev.has(url));
      if (isNew) {
        releaseUnusedVideoBlobs(urls);
        preloadDoneRef.current = false;
      }
      if (prev.size > 0 && isNew) {
        kioskToast('Nuevo ítem — actualizando caché', 'info');
      }
      void cacheScreenCastPlaylist(screenKey, data).then((result) => {
        cachedUrlsRef.current = new Set(urls);
        if (result.downloaded > 0) {
          kioskToast(
            result.downloaded === 1
              ? '1 imagen en caché'
              : `${result.downloaded} imágenes en caché`,
            'ok',
          );
        }
        if (result.failed > 0) {
          kioskToast(
            `No se pudo cachear ${result.failed} medio${result.failed === 1 ? '' : 's'}`,
            'warn',
          );
        }
      });
    },
    [isPreview, kioskToast, screenKey],
  );

  const applyClockOffset = useCallback((serverNow: number | undefined, sentAt: number) => {
    const sample = clockSample(serverNow, sentAt);
    if (!sample) return;
    // A kiosk link may never reach the ideal round trip, and dropping every
    // slow sample leaves the TV on its own clock — routinely minutes off, which
    // turns the shared epoch into a timer that never fires. Keep the best
    // reading so far instead of none at all.
    if (sample.rttMs > MAX_CLOCK_RTT_MS && sample.rttMs >= bestRttRef.current) {
      return;
    }
    bestRttRef.current = sample.rttMs;
    clockOffsetRef.current = sample.offsetMs;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearGoFallback = useCallback(() => {
    if (goFallbackRef.current !== null) {
      window.clearTimeout(goFallbackRef.current);
      goFallbackRef.current = null;
    }
  }, []);

  const clearPlayAtTimer = useCallback(() => {
    if (playAtTimerRef.current != null) {
      window.clearTimeout(playAtTimerRef.current);
      playAtTimerRef.current = null;
    }
  }, []);

  const clearHoldRecheck = useCallback(() => {
    if (holdRecheckRef.current != null) {
      window.clearInterval(holdRecheckRef.current);
      holdRecheckRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    clearTimer();
    clearPlayAtTimer();
    clearHoldRecheck();
    destroyVideo(videoRef.current);
  }, [clearTimer, clearPlayAtTimer, clearHoldRecheck]);

  const advance = useCallback(() => {
    const len = itemsRef.current.length;
    if (len === 0) return;
    const next = (indexRef.current + 1) % len;
    indexRef.current = next;
    setIndex(next);
  }, []);

  const holdForSync = useCallback(() => {
    setSyncing(true);
    setLoaderHint('Sincronizando…');
    setVideoCovered(true);
  }, []);

  /**
   * A slow kiosk link cannot feed a <video> element and the background
   * download at the same time — both starve, which is what makes a clip die a
   * couple of seconds in. So a video only plays once the whole file is local.
   * Returns null when the slot has to be held instead of played.
   */
  const resolveVideoPlayback = useCallback(
    (
      item: ScreenCastPublicItemDto,
    ): { url: string; local: boolean } | null => {
      const local = cachedVideoUrl(item.mediaUrl);
      if (local) {
        // Until the server reports the group's intersection, this screen
        // decides alone. After that, a clip only plays when every TV has it.
        if (
          playableKnownRef.current &&
          !playableUrlsRef.current.includes(item.mediaUrl)
        ) {
          return null;
        }
        return { url: local, local: true };
      }
      const cooldownUntil = holdCooldownRef.current.get(item.mediaUrl) ?? 0;
      if (Date.now() < cooldownUntil) return null;
      // No local copy will ever land (not proxyable, or the download keeps
      // failing): streaming is the only way this clip is ever seen.
      if (isVideoStreamOnly(item.mediaUrl)) {
        return { url: item.mediaUrl, local: false };
      }
      // Holding needs something to hold on. A playlist without a single still
      // would go black instead, and a rough clip beats a dead screen.
      const hasStill = itemsRef.current.some(
        (entry) => entry.mediaType === 'image' || entry.mediaType === 'gif',
      );
      if (!hasStill) return { url: item.mediaUrl, local: false };
      return null;
    },
    [],
  );

  const localUrlsForReport = useCallback(() => {
    return readyVideoUrls(
      itemsRef.current
        .filter((entry) => entry.mediaType === 'video')
        .map((entry) => entry.mediaUrl),
    );
  }, []);

  const applyPlayableUrls = useCallback((urls: string[] | undefined) => {
    if (!urls) return;
    const next = [...urls];
    const wasKnown = playableKnownRef.current;
    const prev = playableUrlsRef.current;
    playableUrlsRef.current = next;
    playableKnownRef.current = true;
    if (wasKnown && sameUrlSet(prev, next)) return;
    if (videoHoldingRef.current) setPlaybackGen((g) => g + 1);
  }, []);

  const scheduleVideoPlay = useCallback(
    (url: string, epochMs: number | null) => {
      const video = videoRef.current;
      if (!video) return;
      // Reload instead of rewinding: assigning currentTime freezes Tizen.
      const needsRewind =
        videoSrcMatches(video, url) &&
        (video.ended || video.currentTime > 0.25);
      if (needsRewind) reloadVideoSource(video, url);
      else primeVideoSrc(video, url);
      videoUrlRef.current = url;
      scheduledPlayKeyRef.current = `${url}@${epochMs ?? 'now'}`;
      clearPlayAtTimer();
      const start = () => {
        playAtTimerRef.current = null;
        void video.play().catch(() => undefined);
      };
      const delay = epochMs == null ? 0 : epochMs - nowServer();
      // A skewed TV clock can put the epoch minutes away; waiting that long is
      // a black screen. Past the lead window the clock is not trustworthy, so
      // start now and let the next item realign.
      if (delay > 16 && delay <= MAX_PLAY_SCHEDULE_MS) {
        playAtTimerRef.current = window.setTimeout(start, delay);
      } else {
        start();
      }
    },
    [clearPlayAtTimer, nowServer],
  );

  const applyConfig = useCallback(
    (data: ScreenCastPublicConfigDto, startIndex: number) => {
      pendingConfigRef.current = data;
      itemsRef.current = data.items;
      indexRef.current = startIndex;
      setConfig(data);
      setIndex(startIndex);
      setError('');
      setLoading(false);
      setSyncing(false);
      cachePlaylistInBackground(data);
    },
    [cachePlaylistInBackground],
  );

  const applyGo = useCallback(
    (payload: PlayGoPayload) => {
      const data = pendingConfigRef.current;
      if (!data) {
        pendingGoRef.current = payload;
        return;
      }
      if (payload.syncId && syncIdRef.current && payload.syncId !== syncIdRef.current) {
        return;
      }
      waitingGoRef.current = false;
      clearGoFallback();
      pendingGoRef.current = null;
      readyForGoRef.current = false;
      applyClockOffset(payload.serverNow, Date.now());
      applyPlayableUrls(payload.playableUrls);
      const durations = resolveDurations(
        data.items,
        payload.durationsMs,
        localDurationsRef.current,
      );
      durationsRef.current = durations;
      epochMsRef.current = payload.epochMs;
      itemsRef.current = data.items;

      const sameSession =
        !!payload.syncId && payload.syncId === lastGoSyncRef.current;
      if (sameSession) {
        setSyncing(false);
        setLoading(false);
        return;
      }
      lastGoSyncRef.current = payload.syncId ?? lastGoSyncRef.current;

      const pos = positionAt(durations, payload.epochMs, nowServer());
      const nextIndex = pos?.index ?? 0;
      indexRef.current = nextIndex;
      setConfig(data);
      setIndex(nextIndex);
      setError('');
      setLoading(false);
      setSyncing(false);
      setVideoCovered(true);
      setLoaderHint('Arrancando…');

      // The playback effect owns the start: it is the only place that knows
      // whether this clip has a local copy or the slot has to be held.
      scheduledPlayKeyRef.current = null;
      clearPlayAtTimer();
      setPlaybackGen((g) => g + 1);
      kioskToast('Pantalla sincronizada', 'ok');
      cachePlaylistInBackground(data);
    },
    [
      applyClockOffset,
      applyPlayableUrls,
      cachePlaylistInBackground,
      clearGoFallback,
      clearPlayAtTimer,
      kioskToast,
      nowServer,
    ],
  );

  const fetchConfig = useCallback(async () => {
    if (!screenKey) {
      throw new Error('Falta el parámetro id en la URL');
    }
    const data = await api.getScreenCastPublicConfig(screenKey);
    pendingConfigRef.current = data;
    return data;
  }, [screenKey]);

  const emitReady = useCallback(
    (syncId: string | null, playlistId: string | null, durationsMs: number[]) => {
      if (isPreview) return;
      const socket = socketRef.current;
      if (!socket?.connected || !screenKey) return;
      socket.emit('ready', {
        screenKey,
        syncId,
        playlistId,
        durationsMs,
        localUrls: localUrlsForReport(),
      });
    },
    [isPreview, localUrlsForReport, screenKey],
  );

  /**
   * Decode the item we are about to show. Videos are only warmed from a local
   * copy — reading a streamed clip here just to report ready burns the same
   * bandwidth the background download needs, and delays the barrier by seconds.
   */
  const warmupStartItem = useCallback(
    async (item: ScreenCastPublicItemDto | undefined) => {
      if (!item) return;
      if (item.mediaType !== 'video') {
        await warmupItem(item, MEASURE_TIMEOUT_MS, null);
        return;
      }
      const resolved = resolveVideoPlayback(item);
      if (!resolved?.local) return;
      await warmupItem(
        { ...item, mediaUrl: resolved.url },
        MEASURE_TIMEOUT_MS,
        videoRef.current,
      );
      videoUrlRef.current = resolved.url;
    },
    [resolveVideoPlayback],
  );

  const prepareAndReady = useCallback(
    async (data: ScreenCastPublicConfigDto, syncId: string | null) => {
      if (data.empty || data.items.length === 0) {
        epochMsRef.current = null;
        applyConfig(data, 0);
        return;
      }
      const durations = await measureAllDurations(data.items, MEASURE_TIMEOUT_MS);
      localDurationsRef.current = durations;
      const pos =
        epochMsRef.current != null
          ? positionAt(durations, epochMsRef.current, nowServer())
          : null;
      await warmupStartItem(data.items[pos?.index ?? 0]);
      emitReady(syncId, data.playlistId, durations);
    },
    [applyConfig, emitReady, nowServer, warmupStartItem],
  );

  const loadConfigImmediate = useCallback(async () => {
    if (!screenKey) {
      setError('Falta el parámetro id en la URL');
      setLoading(false);
      return;
    }
    try {
      const data = await fetchConfig();
      const joinClock = joinClockRef.current;
      if (joinClock?.epochMs && !isPreview && !data.empty) {
        const durations = await measureAllDurations(
          data.items,
          MEASURE_TIMEOUT_MS,
        );
        localDurationsRef.current = durations;
        applyGo({
          syncId: joinClock.syncId,
          epochMs: joinClock.epochMs,
          durationsMs: joinClock.durationsMs,
          serverNow: nowServer(),
        });
        return;
      }
      applyConfig(data, 0);
      if (!isPreview && !data.empty) {
        void prepareAndReady(data, null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar contenido');
      setConfig(null);
      itemsRef.current = [];
      setLoading(false);
      setSyncing(false);
    }
  }, [
    screenKey,
    fetchConfig,
    applyConfig,
    applyGo,
    isPreview,
    prepareAndReady,
    nowServer,
  ]);

  const handleSync = useCallback(
    async (payload: PlaylistSyncPayload) => {
      if (!screenKey) return;
      const token = ++syncTokenRef.current;
      applyClockOffset(payload.serverNow, Date.now());
      applyPlayableUrls(payload.playableUrls);
      syncIdRef.current = payload.syncId ?? null;
      pendingGoRef.current = null;
      readyForGoRef.current = false;
      if (!payload.catchUp && !payload.empty) {
        lastGoSyncRef.current = null;
        scheduledPlayKeyRef.current = null;
        clearPlayAtTimer();
      }

      if (payload.empty) {
        waitingGoRef.current = false;
        clearGoFallback();
        setSyncing(false);
        try {
          const data = await fetchConfig();
          if (token !== syncTokenRef.current) return;
          epochMsRef.current = null;
          applyConfig(data, 0);
        } catch (e) {
          if (token !== syncTokenRef.current) return;
          setError(e instanceof Error ? e.message : 'Error al cargar contenido');
          setLoading(false);
          setSyncing(false);
        }
        return;
      }

      if (payload.catchUp) {
        waitingGoRef.current = false;
        holdForSync();
        try {
          const data = await fetchConfig();
          if (token !== syncTokenRef.current) return;
          pendingConfigRef.current = data;
          if (data.empty) {
            epochMsRef.current = null;
            applyConfig(data, 0);
            return;
          }
          const durations = await measureAllDurations(
            data.items,
            MEASURE_TIMEOUT_MS,
          );
          if (token !== syncTokenRef.current) return;
          localDurationsRef.current = durations;
          if (payload.epochMs) {
            const pos = positionAt(durations, payload.epochMs, nowServer());
            await warmupStartItem(data.items[pos?.index ?? 0]);
            if (token !== syncTokenRef.current) return;
            applyGo({
              syncId: payload.syncId ?? undefined,
              playlistId: payload.playlistId ?? data.playlistId ?? undefined,
              epochMs: payload.epochMs,
              durationsMs: payload.durationsMs?.length
                ? payload.durationsMs
                : durations,
              serverNow: payload.serverNow,
            });
            return;
          }
          applyConfig(data, 0);
          emitReady(null, data.playlistId, durations);
        } catch (e) {
          if (token !== syncTokenRef.current) return;
          setError(e instanceof Error ? e.message : 'Error al cargar contenido');
          setLoading(false);
          setSyncing(false);
        }
        return;
      }

      waitingGoRef.current = true;
      holdForSync();
      clearGoFallback();
      goFallbackRef.current = window.setTimeout(() => {
        if (!waitingGoRef.current) return;
        applyGo({
          syncId: payload.syncId ?? undefined,
          epochMs: nowServer(),
          durationsMs: localDurationsRef.current,
          serverNow: nowServer(),
        });
      }, CLIENT_GO_FALLBACK_MS);

      try {
        const data = await fetchConfig();
        if (token !== syncTokenRef.current) return;
        pendingConfigRef.current = data;

        if (data.empty) {
          waitingGoRef.current = false;
          clearGoFallback();
          epochMsRef.current = null;
          applyConfig(data, 0);
          return;
        }

        await prepareAndReady(data, payload.syncId ?? null);
        if (token !== syncTokenRef.current) return;
        readyForGoRef.current = true;
        if (pendingGoRef.current) {
          applyGo(pendingGoRef.current);
        }
      } catch (e) {
        if (token !== syncTokenRef.current) return;
        waitingGoRef.current = false;
        clearGoFallback();
        setError(e instanceof Error ? e.message : 'Error al cargar contenido');
        setLoading(false);
        setSyncing(false);
      }
    },
    [
      screenKey,
      applyClockOffset,
      applyPlayableUrls,
      fetchConfig,
      applyConfig,
      applyGo,
      clearGoFallback,
      nowServer,
      prepareAndReady,
      emitReady,
      holdForSync,
      clearPlayAtTimer,
      warmupStartItem,
    ],
  );

  useLayoutEffect(() => {
    document.documentElement.classList.add(KIOSK_CLASS);
    const meta = document.querySelector('meta[name="viewport"]');
    const prevViewport = meta?.getAttribute('content') ?? '';
    meta?.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    );
    window.scrollTo(0, 0);
    return () => {
      document.documentElement.classList.remove(KIOSK_CLASS);
      if (meta && prevViewport) meta.setAttribute('content', prevViewport);
    };
  }, []);

  useEffect(() => {
    const syncViewport = () => {
      setViewportPortrait(isViewportPortrait());
      setViewportSize({ vw: window.innerWidth, vh: window.innerHeight });
      window.scrollTo(0, 0);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  useEffect(() => {
    void registerScreenCastServiceWorker();
    void loadConfigImmediate();
  }, [loadConfigImmediate]);

  useEffect(() => {
    if (isPreview) return;
    startScreenCastAutoUpdate({
      isVideoPlaying: () => {
        const video = videoRef.current;
        return !!video && !video.paused && !video.ended;
      },
    });
  }, [isPreview]);

  /**
   * One file at a time, always starting from the clip the playlist is about to
   * reach. Parallel transfers starve each other on a kiosk link, and the queue
   * keeps running for the life of the page so a failed download is retried
   * instead of leaving the screen streaming forever.
   */
  useEffect(() => {
    if (isPreview) return;
    const handle = startVideoPreloadLoop({
      getUrls: () => {
        const items = itemsRef.current;
        if (items.length === 0) return [];
        const start = indexRef.current;
        const urls: string[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[(start + i) % items.length];
          if (entry.mediaType !== 'video') continue;
          if (!urls.includes(entry.mediaUrl)) urls.push(entry.mediaUrl);
        }
        return urls;
      },
      onStateChange: (src: string, state: VideoCacheState) => {
        if (state === 'ready') {
          holdCooldownRef.current.delete(src);
          const socket = socketRef.current;
          if (socket?.connected && screenKey) {
            socket.emit('local', {
              screenKey,
              localUrls: localUrlsForReport(),
            });
          }
          const urls = itemsRef.current
            .filter((entry) => entry.mediaType === 'video')
            .map((entry) => entry.mediaUrl);
          const stats = videoCacheStats(urls);
          // One line when the whole playlist is local, not one per file.
          if (
            !preloadDoneRef.current &&
            stats.total > 0 &&
            stats.ready + stats.unavailable >= stats.total
          ) {
            preloadDoneRef.current = true;
            kioskToast(`Videos listos (${stats.ready}/${stats.total})`, 'ok');
          }
          return;
        }
        if (state === 'unavailable') {
          kioskToast('Sin copia local — video en streaming', 'warn');
        }
      },
    });
    return () => handle.stop();
  }, [isPreview, kioskToast, localUrlsForReport, screenKey]);

  /**
   * The socket has to outlive every re-render of the player. Reading the
   * handlers through a ref keeps the connection effect's dependency list down
   * to the two values that actually identify a connection, so no amount of
   * churn in `config`, `index` or `playbackGen` can ever reach it — a
   * disconnect on every slot change is exactly the storm we are chasing.
   */
  const socketHandlersRef = useRef({
    applyClockOffset,
    applyGo,
    applyPlayableUrls,
    handleSync,
    kioskToast,
    clearGoFallback,
    localUrlsForReport,
  });
  useEffect(() => {
    socketHandlersRef.current = {
      applyClockOffset,
      applyGo,
      applyPlayableUrls,
      handleSync,
      kioskToast,
      clearGoFallback,
      localUrlsForReport,
    };
  });

  useEffect(() => {
    if (!screenKey || isPreview) return;

    const socket = connectScreenCastSocket(screenKey);
    socketRef.current = socket;

    socket.on('connect', () => {
      const sentAt = Date.now();
      if (socketWasConnectedRef.current) {
        socketHandlersRef.current.kioskToast('Conexión restablecida', 'ok');
      } else {
        socketHandlersRef.current.kioskToast('Pantalla conectada', 'ok');
        socketWasConnectedRef.current = true;
      }
      socket.emit('join', { screenKey, localUrls: socketHandlersRef.current.localUrlsForReport() }, (ack: JoinAck) => {
        socketHandlersRef.current.applyClockOffset(ack?.serverNow, sentAt);
        socketHandlersRef.current.applyPlayableUrls(ack?.playableUrls);
        if (ack?.clock?.epochMs) {
          joinClockRef.current = ack.clock;
          if (pendingConfigRef.current && !waitingGoRef.current) {
            socketHandlersRef.current.applyGo({
              syncId: ack.clock.syncId,
              epochMs: ack.clock.epochMs,
              durationsMs: ack.clock.durationsMs,
              playableUrls: ack.playableUrls,
              serverNow: ack.serverNow,
            });
          }
        }
      });
    });

    socket.on('disconnect', () => {
      socketHandlersRef.current.kioskToast('Sin conexión', 'warn');
    });

    socket.on('playlist:sync', (payload: PlaylistSyncPayload) => {
      void socketHandlersRef.current.handleSync(payload ?? {});
    });

    socket.on('play:go', (payload: PlayGoPayload) => {
      if (!payload?.epochMs) return;
      if (payload.syncId && syncIdRef.current && payload.syncId !== syncIdRef.current) {
        return;
      }
      socketHandlersRef.current.applyClockOffset(payload.serverNow, Date.now());
      socketHandlersRef.current.applyPlayableUrls(payload.playableUrls);
      pendingGoRef.current = payload;
      if (waitingGoRef.current && !readyForGoRef.current) return;
      socketHandlersRef.current.applyGo(payload);
    });

    socket.on('play:tick', (payload: PlayGoPayload) => {
      socketHandlersRef.current.applyPlayableUrls(payload?.playableUrls);
      if (!payload?.epochMs) return;
      if (
        payload.syncId &&
        syncIdRef.current &&
        payload.syncId !== syncIdRef.current
      ) {
        return;
      }
      socketHandlersRef.current.applyClockOffset(payload.serverNow, Date.now());
      if (waitingGoRef.current) {
        // Never replace a pending play:go with a tick from the previous clock.
        return;
      }
      if (payload.durationsMs?.length) {
        durationsRef.current = resolveDurations(
          itemsRef.current,
          payload.durationsMs,
          localDurationsRef.current,
        );
      }
      epochMsRef.current = payload.epochMs;
    });

    const sendHeartbeat = () => {
      if (!socket.connected) return;
      const sentAt = Date.now();
      socket.emit(
        'heartbeat',
        { screenKey, localUrls: socketHandlersRef.current.localUrlsForReport() },
        (ack: JoinAck) => {
        socketHandlersRef.current.applyClockOffset(ack?.serverNow, sentAt);
        socketHandlersRef.current.applyPlayableUrls(ack?.playableUrls);
        if (ack?.clock?.epochMs && !waitingGoRef.current) {
          epochMsRef.current = ack.clock.epochMs;
          if (ack.clock.durationsMs?.length) {
            durationsRef.current = resolveDurations(
              itemsRef.current,
              ack.clock.durationsMs,
              localDurationsRef.current,
            );
          }
        }
      });
    };

    sendHeartbeat();
    heartbeatRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_MS);

    return () => {
      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      socketHandlersRef.current.clearGoFallback();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [screenKey, isPreview]);

  const emitStatus = useCallback(
    (payload: { index: number; total: number; lastError?: string | null }) => {
      if (isPreview) return;
      const socket = socketRef.current;
      if (!socket?.connected || !screenKey) return;
      socket.emit('status', {
        screenKey,
        index: payload.index,
        total: payload.total,
        lastError: payload.lastError ?? null,
      });
    },
    [isPreview, screenKey],
  );

  const jumpToClock = useCallback(() => {
    const epoch = epochMsRef.current;
    if (epoch == null || itemsRef.current.length === 0) return false;
    const pos = positionAt(durationsRef.current, epoch, nowServer());
    if (!pos) return false;
    if (pos.index !== indexRef.current) {
      indexRef.current = pos.index;
      setIndex(pos.index);
      return true;
    }
    return false;
  }, [nowServer]);

  useEffect(() => {
    clearTimer();
    clearHoldRecheck();

    const items = itemsRef.current;
    const item = items[index];
    if (!item || !config || config.empty) {
      videoPlaybackActiveRef.current = false;
      setHold(false);
      destroyVideo(videoRef.current);
      videoUrlRef.current = null;
      emitStatus({ index: 0, total: 0 });
      return () => {
        clearTimer();
        destroyVideo(videoRef.current);
        videoUrlRef.current = null;
      };
    }

    emitStatus({ index, total: items.length });
    window.scrollTo(0, 0);

    const nextItem = items[(index + 1) % items.length];
    if (
      nextItem &&
      nextItem !== item &&
      (nextItem.mediaType === 'image' || nextItem.mediaType === 'gif')
    ) {
      const pre = new Image();
      preloadRef.current = pre;
      pre.src = nextItem.mediaUrl;
    }

    const epoch = epochMsRef.current;
    let remainingMs = item.durationMs || 10_000;
    let slotOffsetMs = 0;
    const pos =
      epoch != null ? positionAt(durationsRef.current, epoch, nowServer()) : null;

    if (pos && pos.index !== index) {
      indexRef.current = pos.index;
      setIndex(pos.index);
      return;
    }
    if (pos) {
      remainingMs = pos.remainingMs;
      slotOffsetMs = pos.offsetMs;
      if (pos.waitMs > 0) {
        if (item.mediaType !== 'video') {
          timerRef.current = window.setTimeout(() => {
            setPlaybackGen((g) => g + 1);
          }, pos.waitMs);
          return () => {
            clearTimer();
          };
        }
        // Videos wait for the epoch inside scheduleVideoPlay, so the element
        // is primed now and the slot guard covers the lead as well.
        remainingMs = pos.waitMs + pos.remainingMs;
      }
    }

    /** Leave this slot when the shared clock says the next one starts. */
    const scheduleAdvance = () => {
      clearTimer();
      const epochNow = epochMsRef.current;
      if (epochNow == null) {
        timerRef.current = window.setTimeout(advance, Math.max(40, remainingMs));
        return;
      }
      // Recomputed on every call: this also runs mid-slot after a clip is
      // dropped, where the value captured at mount would overshoot.
      const live = positionAt(durationsRef.current, epochNow, nowServer());
      const wait = live
        ? Math.max(40, live.waitMs + live.remainingMs)
        : Math.max(40, remainingMs);
      timerRef.current = window.setTimeout(() => {
        if (jumpToClock()) return;
        // Rounding can leave us a few ms short of the boundary.
        timerRef.current = window.setTimeout(() => {
          if (!jumpToClock()) advance();
        }, 150);
      }, wait);
    };

    if (item.mediaType === 'video') {
      const video = videoRef.current;
      if (!video) return;

      const soloItem = items.length <= 1;
      const resolved = resolveVideoPlayback(item);
      const holdFrame = holdFrameFor(index);
      // Entering a slot late cannot be corrected by seeking (currentTime is
      // fatal on Tizen), so a clip that would be chopped at the end is better
      // held for one pass — but only when there is a still to hold on, since
      // a cut clip still beats a black panel.
      const joinedLate =
        !soloItem && slotOffsetMs > VIDEO_LATE_JOIN_MS && !!holdFrame;

      /** Hand the slot back to the timeline and show the last still. */
      const holdSlot = () => {
        videoPlaybackActiveRef.current = false;
        scheduledPlayKeyRef.current = null;
        clearPlayAtTimer();
        // Drop a streaming src so the whole link is left to the downloader.
        if (videoUrlRef.current && !videoUrlRef.current.startsWith('blob:')) {
          destroyVideo(video);
          videoUrlRef.current = null;
        } else {
          pauseVideoQuiet(video);
        }
        setHoldFrameUrl(holdFrame);
        setVideoCovered(true);
        setHold(true);
        scheduleAdvance();
        clearHoldRecheck();
        holdRecheckRef.current = window.setInterval(() => {
          if (!resolveVideoPlayback(item)) return;
          const epochNow = epochMsRef.current;
          if (epochNow != null && itemsRef.current.length > 1) {
            const live = positionAt(
              durationsRef.current,
              epochNow,
              nowServer(),
            );
            if (live && live.offsetMs > VIDEO_LATE_JOIN_MS) return;
          }
          clearHoldRecheck();
          setPlaybackGen((g) => g + 1);
        }, HOLD_RECHECK_MS);
      };

      if (!resolved || joinedLate) {
        heldCountRef.current += 1;
        holdSlot();
        return () => {
          clearTimer();
          clearHoldRecheck();
        };
      }

      const src = resolved.url;
      const isLocal = resolved.local;
      primeVideoSrc(video, src);
      video.loop = soloItem;
      videoUrlRef.current = src;
      videoPlaybackActiveRef.current = true;
      setHold(false);

      let cancelled = false;
      let gaveUp = false;
      const uncover = () => {
        if (!cancelled && video.currentTime > 0.04) setVideoCovered(false);
      };
      // The cover only exists to hide the white first frame. If playback never
      // reports progress, showing that frame still beats a black screen.
      const coverTimer = window.setTimeout(() => {
        if (!cancelled) setVideoCovered(false);
      }, VIDEO_COVER_MAX_MS);

      /**
       * Abandon a clip that is not decoding. Freezing on a half-loaded frame
       * for the rest of the slot is the worst possible outcome on a wall of
       * screens, so the slot is handed back to the timeline immediately.
       */
      const giveUp = (reason: 'stall' | 'nostart' | 'overrun') => {
        if (cancelled || gaveUp) return;
        gaveUp = true;
        if (reason === 'overrun') {
          videoPlaybackActiveRef.current = false;
          if (!jumpToClock()) scheduleAdvance();
          return;
        }
        stallCountRef.current += 1;
        // A local clip that simply never opened is usually a decoder hiccup,
        // so it gets another try next lap. Everything else waits out a
        // cooldown instead of failing on every pass.
        if (reason === 'stall' || !isLocal) {
          holdCooldownRef.current.set(
            item.mediaUrl,
            Date.now() + VIDEO_HOLD_COOLDOWN_MS,
          );
        }
        if (isLocal && reason === 'stall') {
          // A local file that dies mid-playback is truncated or corrupt: drop
          // it so the queue fetches a clean copy.
          destroyVideo(video);
          videoUrlRef.current = null;
          void invalidateVideoBlob(item.mediaUrl);
          kioskToast('Copia local ilegible — se descarga de nuevo', 'warn');
        } else if (!isLocal) {
          kioskToast('Video sin datos — se omite este pase', 'warn');
        }
        holdSlot();
      };

      const onMetadata = () => {
        if (cancelled) return;
        const expected = item.durationMs || 0;
        const actual = Number.isFinite(video.duration) ? video.duration * 1000 : 0;
        // A file that is much shorter than expected is a truncated download.
        if (expected > 0 && actual > 0 && actual < expected * 0.75) {
          giveUp('stall');
        }
      };

      const onEnded = () => {
        if (cancelled) return;
        videoPlaybackActiveRef.current = false;
        setVideoCovered(true);
        if (itemsRef.current.length <= 1) {
          scheduleVideoPlay(src, null);
          return;
        }
        if (epochMsRef.current == null) {
          advance();
          return;
        }
        // Let the shared timeline move us. Advancing here while the clock is
        // still inside this item makes the drift check pull us back, which
        // restarts the clip over and over.
        const at = positionAt(
          durationsRef.current,
          epochMsRef.current,
          nowServer(),
        );
        if (at && at.index !== indexRef.current) {
          indexRef.current = at.index;
          setIndex(at.index);
        }
      };

      const onError = () => {
        if (cancelled) return;
        emitStatus({
          index,
          total: items.length,
          lastError: 'Error al reproducir video',
        });
        giveUp('stall');
      };

      video.addEventListener('loadedmetadata', onMetadata);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      video.addEventListener('playing', uncover);
      video.addEventListener('timeupdate', uncover);

      const slotStartedAt = Date.now();
      let lastTime = -1;
      let lastProgressAt = Date.now();
      let lastNudgeAt = Date.now();
      let playRetries = 0;

      /**
       * Tizen fires `waiting`/`stalled` inconsistently, so progress is measured
       * off currentTime instead. The same pass catches a play() that was
       * rejected silently and a clip running past its slot.
       */
      const watchdog = window.setInterval(() => {
        if (cancelled || gaveUp) return;
        const durationMs =
          Number.isFinite(video.duration) && video.duration > 0
            ? video.duration * 1000
            : 0;
        const budgetMs =
          Math.max(remainingMs, durationMs) + VIDEO_END_GRACE_MS;
        if (Date.now() - slotStartedAt > budgetMs) {
          giveUp('overrun');
          return;
        }
        if (video.ended) return;

        if (video.paused) {
          // Still holding for the coordinated start.
          if (playAtTimerRef.current != null) return;
          if (
            playRetries < VIDEO_PLAY_RETRY_MAX &&
            Date.now() - lastNudgeAt > VIDEO_PLAY_RETRY_MS
          ) {
            playRetries += 1;
            lastNudgeAt = Date.now();
            lastProgressAt = Date.now();
            void video.play().catch(() => undefined);
          }
          return;
        }

        const t = video.currentTime;
        if (t > lastTime + 0.01) {
          lastTime = t;
          lastProgressAt = Date.now();
          return;
        }
        // Before the first frame the decoder is still opening, which is not a
        // stall and must not cost us a healthy clip.
        const started = lastTime > 0;
        const limitMs = started ? VIDEO_STALL_GIVEUP_MS : VIDEO_START_GRACE_MS;
        if (Date.now() - lastProgressAt > limitMs) {
          giveUp(started ? 'stall' : 'nostart');
        }
      }, VIDEO_WATCHDOG_MS);

      const alreadyPlaying =
        videoSrcMatches(video, src) &&
        !video.paused &&
        !video.ended &&
        video.currentTime > 0.05;
      const playKey = `${src}@${epochMsRef.current ?? 'now'}`;

      if (alreadyPlaying) {
        setVideoCovered(false);
      } else if (waitingGoRef.current) {
        setVideoCovered(true);
      } else if (scheduledPlayKeyRef.current !== playKey) {
        setVideoCovered(true);
        scheduleVideoPlay(src, epochMsRef.current);
      }

      return () => {
        cancelled = true;
        videoPlaybackActiveRef.current = false;
        window.clearTimeout(coverTimer);
        window.clearInterval(watchdog);
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('error', onError);
        video.removeEventListener('playing', uncover);
        video.removeEventListener('timeupdate', uncover);
        clearTimer();
        clearHoldRecheck();
        // Let the next visit to this item schedule its own start.
        scheduledPlayKeyRef.current = null;
      };
    }

    videoPlaybackActiveRef.current = false;
    setHold(false);
    pauseVideoQuiet(videoRef.current);
    lastStillUrlRef.current = item.mediaUrl;

    scheduleAdvance();
    return () => {
      clearTimer();
    };
  }, [
    index,
    config,
    playbackGen,
    advance,
    clearHoldRecheck,
    clearPlayAtTimer,
    clearTimer,
    emitStatus,
    holdFrameFor,
    jumpToClock,
    kioskToast,
    nowServer,
    resolveVideoPlayback,
    scheduleVideoPlay,
    setHold,
  ]);

  useEffect(() => {
    if (isPreview) return;
    const id = window.setInterval(() => {
      const epoch = epochMsRef.current;
      if (epoch == null || itemsRef.current.length === 0) return;

      const currentItem = itemsRef.current[indexRef.current];
      if (currentItem?.mediaType === 'video' && videoPlaybackActiveRef.current) {
        const video = videoRef.current;
        // A clip that is genuinely decoding owns its slot and realigns when it
        // ends. A held or abandoned one must never freeze the wall.
        if (video && !video.ended && !video.paused) return;
      }

      const pos = positionAt(durationsRef.current, epoch, nowServer());
      if (!pos) return;
      if (pos.index !== indexRef.current) {
        indexRef.current = pos.index;
        setIndex(pos.index);
      }
    }, DRIFT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isPreview, nowServer, config]);

  useEffect(() => {
    return () => {
      cleanupMedia();
      clearGoFallback();
    };
  }, [cleanupMedia, clearGoFallback]);

  useEffect(() => {
    if (!isDebug) return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      const items = itemsRef.current;
      const item = items[indexRef.current];
      const epoch = epochMsRef.current;
      const src = video?.currentSrc || video?.getAttribute('src') || '';
      const holding = videoHoldingRef.current;
      const source = holding
        ? 'EN ESPERA'
        : src.startsWith('blob:')
          ? 'local'
          : src
            ? 'streaming'
            : '—';
      const dur = video && Number.isFinite(video.duration) ? video.duration : 0;
      const buffered = video ? bufferedAheadSeconds(video) : 0;
      const stats = videoCacheStats(
        items
          .filter((entry) => entry.mediaType === 'video')
          .map((entry) => entry.mediaUrl),
      );
      const slot =
        epoch == null
          ? null
          : positionAt(durationsRef.current, epoch, nowServer());
      setDebugLines([
        `build ${screenCastBuildId()}`,
        `ws ${socketRef.current?.connected ? 'ok' : 'CAÍDA'} · sync ${syncIdRef.current?.slice(0, 6) ?? '—'}`,
        `reloj ${Math.round(clockOffsetRef.current)}ms · rtt ${Number.isFinite(bestRttRef.current) ? Math.round(bestRttRef.current) : '—'}ms`,
        `item ${indexRef.current + 1}/${items.length} ${item?.mediaType ?? '—'} · slot ${slot ? `${(slot.offsetMs / 1000).toFixed(1)}s` : '—'} · epoch ${epoch == null ? '—' : `${((nowServer() - epoch) / 1000).toFixed(1)}s`}`,
        item?.mediaType === 'video'
          ? `video ${source} · ${video ? video.currentTime.toFixed(1) : '—'}/${dur ? dur.toFixed(1) : '?'}s · ${video?.paused ? 'pausado' : 'play'}${video?.ended ? ' fin' : ''} · rs${video?.readyState ?? '—'} · buf ${buffered.toFixed(1)}s`
          : 'video —',
        `local ${stats.ready}/${stats.total}${stats.activeSrc ? ` · bajando ${stats.activePercent}%` : ''}${stats.unavailable ? ` · sin copia ${stats.unavailable}` : ''}`,
        `grupo ${playableKnownRef.current ? `${playableUrlsRef.current.length}/${stats.total}` : '—'} · esperas ${heldCountRef.current} · cortes ${stallCountRef.current}`,
      ]);
    }, DEBUG_HUD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isDebug, nowServer]);

  useEffect(() => {
    if (isPreview) return;
    const onOffline = () => kioskToast('Sin red', 'warn');
    const onOnline = () => {
      kioskToast('Red restablecida', 'ok');
      // Downloads that exhausted their retries deserve a fresh chance.
      for (const entry of itemsRef.current) {
        if (entry.mediaType === 'video') retryVideoDownload(entry.mediaUrl);
      }
      holdCooldownRef.current.clear();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [isPreview, kioskToast]);

  const current = config?.items[index];
  const holdUi = loading || syncing;
  const showImage =
    !!current &&
    !holdUi &&
    (current.mediaType === 'image' || current.mediaType === 'gif');
  const imageUsesCors =
    !!current && isCorsCacheableMediaUrl(current.mediaUrl);
  const isVideoItem =
    !!current && current.mediaType === 'video' && !error && !config?.empty;
  /** The element is only on screen when a clip is actually running. */
  const videoVisible = isVideoItem && !videoHolding;
  const videoActive = videoVisible && !holdUi;
  const showHoldFrame =
    isVideoItem && videoHolding && !holdUi && !!holdFrameUrl;

  const orientation: ScreenCastOrientation =
    config?.orientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE';
  const isPortrait = orientation === 'PORTRAIT';

  function handleImageError(_e: SyntheticEvent<HTMLImageElement>) {
    emitStatus({
      index,
      total: itemsRef.current.length,
      lastError: 'Error al cargar imagen',
    });
    if (epochMsRef.current != null) jumpToClock();
    else advance();
  }

  return (
    <div className="screen-cast-player fixed inset-0 z-100 overflow-hidden bg-black text-white">
      <div
        className="screen-cast-stage"
        style={stageStyle(
          isPortrait,
          viewportPortrait,
          viewportSize.vw,
          viewportSize.vh,
        )}
      >
        {(loading || syncing) && <KioskLoader hint={loaderHint} />}

        {!holdUi && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-medium">No se pudo cargar la pantalla</p>
            <p className="text-sm opacity-70">{error}</p>
          </div>
        )}

        {!holdUi && !error && config?.empty && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-2xl font-medium tracking-wide">
              Sin contenido asignado
            </p>
          </div>
        )}

        <video
          ref={videoRef}
          className="pointer-events-none"
          style={{
            ...MEDIA_FILL_STYLE,
            opacity: videoVisible ? 1 : 0,
          }}
          muted
          playsInline
          autoPlay={false}
          controls={false}
          loop={false}
          preload="auto"
        />

        {videoActive && videoCovered && (
          <div className="absolute inset-0 z-2 bg-black" aria-hidden />
        )}

        {showHoldFrame && holdFrameUrl && (
          <img
            key={`hold-${holdFrameUrl}`}
            src={holdFrameUrl}
            alt=""
            style={MEDIA_FILL_STYLE}
            draggable={false}
            {...(isCorsCacheableMediaUrl(holdFrameUrl)
              ? { crossOrigin: 'anonymous' as const }
              : {})}
          />
        )}

        {showImage && current && (
          <img
            key={`${current.mediaUrl}-${index}`}
            src={current.mediaUrl}
            alt=""
            style={MEDIA_FILL_STYLE}
            draggable={false}
            {...(imageUsesCors ? { crossOrigin: 'anonymous' as const } : {})}
            onError={handleImageError}
          />
        )}
        {isDebug && <KioskDebugHud lines={debugLines} />}
        <KioskToastStack toasts={toasts} />
      </div>
    </div>
  );
}
