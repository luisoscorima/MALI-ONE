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
  VIDEO_PRELOAD_BUDGET_MS,
  clockSample,
  MAX_CLOCK_RTT_MS,
  measureAllDurations,
  positionAt,
  primeVideoSrc,
  reloadVideoSource,
  resolveDurations,
  videoSrcMatches,
  warmupItem,
  type PlayGoPayload,
  type PlaylistClock,
  type PlaylistSyncPayload,
} from '@/lib/screen-cast-sync';
import {
  cachedVideoUrl,
  invalidateVideoBlob,
  preloadPlaylistVideos,
  releaseUnusedVideoBlobs,
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
    timeout: 20000,
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
  const preloadSignatureRef = useRef<string | null>(null);
  const socketWasConnectedRef = useRef(false);

  const nowServer = useCallback(() => Date.now() + clockOffsetRef.current, []);

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

  const cleanupMedia = useCallback(() => {
    clearTimer();
    clearPlayAtTimer();
    destroyVideo(videoRef.current);
  }, [clearTimer, clearPlayAtTimer]);

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

  /** Prefer the fully downloaded copy; fall back to streaming from S3. */
  const playbackUrl = useCallback((item: ScreenCastPublicItemDto): string => {
    if (item.mediaType !== 'video') return item.mediaUrl;
    return cachedVideoUrl(item.mediaUrl) ?? item.mediaUrl;
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

      const startItem = data.items[nextIndex];
      if (startItem?.mediaType === 'video') {
        scheduleVideoPlay(playbackUrl(startItem), payload.epochMs);
      } else {
        scheduledPlayKeyRef.current = null;
        clearPlayAtTimer();
        setPlaybackGen((g) => g + 1);
      }
      kioskToast('Pantalla sincronizada', 'ok');
      cachePlaylistInBackground(data);
    },
    [
      applyClockOffset,
      cachePlaylistInBackground,
      clearGoFallback,
      clearPlayAtTimer,
      kioskToast,
      nowServer,
      playbackUrl,
      scheduleVideoPlay,
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
      });
    },
    [isPreview, screenKey],
  );

  /**
   * Pull videos into local storage in the background. This must never gate the
   * first paint: on a slow kiosk link a 20 MB file takes minutes, and the screen
   * would sit black the whole time. The first pass streams from S3; once the
   * download lands, the next time the item comes around it plays from the blob.
   */
  const startVideoPreload = useCallback(
    (data: ScreenCastPublicConfigDto) => {
      if (isPreview || data.empty) return;
      if (!data.items.some((item) => item.mediaType === 'video')) return;
      const signature = data.items.map((item) => item.mediaUrl).join('|');
      if (preloadSignatureRef.current === signature) return;
      preloadSignatureRef.current = signature;

      void preloadPlaylistVideos(data, VIDEO_PRELOAD_BUDGET_MS).then(
        (result) => {
          releaseUnusedVideoBlobs(data.items.map((item) => item.mediaUrl));
          if (result.cached > 0) {
            kioskToast(`Video guardado local (${result.cached})`, 'ok');
          }
          if (result.failed > 0) {
            // Allow a retry on the next sync instead of streaming forever.
            preloadSignatureRef.current = null;
            kioskToast('Video en streaming — sin copia local', 'warn');
          }
        },
      );
    },
    [isPreview, kioskToast],
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
      startVideoPreload(data);
      const pos =
        epochMsRef.current != null
          ? positionAt(durations, epochMsRef.current, nowServer())
          : null;
      const startItem = data.items[pos?.index ?? 0];
      if (startItem) {
        const resolved =
          startItem.mediaType === 'video'
            ? { ...startItem, mediaUrl: playbackUrl(startItem) }
            : startItem;
        await warmupItem(resolved, MEASURE_TIMEOUT_MS, videoRef.current);
        if (startItem.mediaType === 'video') {
          videoUrlRef.current = resolved.mediaUrl;
        }
      }
      emitReady(syncId, data.playlistId, durations);
    },
    [applyConfig, emitReady, nowServer, playbackUrl, startVideoPreload],
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
        startVideoPreload(data);
        applyGo({
          syncId: joinClock.syncId,
          epochMs: joinClock.epochMs,
          durationsMs: joinClock.durationsMs,
          serverNow: nowServer(),
        });
        return;
      }
      startVideoPreload(data);
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
    startVideoPreload,
    nowServer,
  ]);

  const handleSync = useCallback(
    async (payload: PlaylistSyncPayload) => {
      if (!screenKey) return;
      const token = ++syncTokenRef.current;
      applyClockOffset(payload.serverNow, Date.now());
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
            startVideoPreload(data);
            const pos = positionAt(durations, payload.epochMs, nowServer());
            const startItem = data.items[pos?.index ?? 0];
            if (startItem) {
              const resolved =
                startItem.mediaType === 'video'
                  ? { ...startItem, mediaUrl: playbackUrl(startItem) }
                  : startItem;
              await warmupItem(resolved, MEASURE_TIMEOUT_MS, videoRef.current);
              if (startItem.mediaType === 'video') {
                videoUrlRef.current = resolved.mediaUrl;
              }
            }
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
      fetchConfig,
      applyConfig,
      applyGo,
      clearGoFallback,
      nowServer,
      prepareAndReady,
      emitReady,
      holdForSync,
      clearPlayAtTimer,
      playbackUrl,
      startVideoPreload,
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

  useEffect(() => {
    if (!screenKey || isPreview) return;

    const socket = connectScreenCastSocket(screenKey);
    socketRef.current = socket;

    socket.on('connect', () => {
      const sentAt = Date.now();
      if (socketWasConnectedRef.current) {
        kioskToast('Conexión restablecida', 'ok');
      } else {
        kioskToast('Pantalla conectada', 'ok');
        socketWasConnectedRef.current = true;
      }
      socket.emit('join', { screenKey }, (ack: JoinAck) => {
        applyClockOffset(ack?.serverNow, sentAt);
        if (ack?.clock?.epochMs) {
          joinClockRef.current = ack.clock;
          if (pendingConfigRef.current && !waitingGoRef.current) {
            applyGo({
              syncId: ack.clock.syncId,
              epochMs: ack.clock.epochMs,
              durationsMs: ack.clock.durationsMs,
              serverNow: ack.serverNow,
            });
          }
        }
      });
    });

    socket.on('disconnect', () => {
      kioskToast('Sin conexión', 'warn');
    });

    socket.on('playlist:sync', (payload: PlaylistSyncPayload) => {
      void handleSync(payload ?? {});
    });

    socket.on('play:go', (payload: PlayGoPayload) => {
      if (!payload?.epochMs) return;
      if (payload.syncId && syncIdRef.current && payload.syncId !== syncIdRef.current) {
        return;
      }
      applyClockOffset(payload.serverNow, Date.now());
      pendingGoRef.current = payload;
      if (waitingGoRef.current && !readyForGoRef.current) return;
      applyGo(payload);
    });

    socket.on('play:tick', (payload: PlayGoPayload) => {
      if (!payload?.epochMs) return;
      if (
        payload.syncId &&
        syncIdRef.current &&
        payload.syncId !== syncIdRef.current
      ) {
        return;
      }
      applyClockOffset(payload.serverNow, Date.now());
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
      socket.emit('heartbeat', { screenKey }, (ack: JoinAck) => {
        applyClockOffset(ack?.serverNow, sentAt);
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
      clearGoFallback();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    screenKey,
    isPreview,
    applyClockOffset,
    applyGo,
    handleSync,
    clearGoFallback,
    kioskToast,
  ]);

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

    const items = itemsRef.current;
    const item = items[index];
    if (!item || !config || config.empty) {
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
    if (epoch != null && item.mediaType !== 'video') {
      const pos = positionAt(durationsRef.current, epoch, nowServer());
      if (pos?.waitMs) {
        timerRef.current = window.setTimeout(() => {
          setPlaybackGen((g) => g + 1);
        }, pos.waitMs);
        return () => {
          clearTimer();
        };
      }
      if (pos && pos.index !== index) {
        indexRef.current = pos.index;
        setIndex(pos.index);
        return;
      }
      if (pos && pos.index === index) {
        remainingMs = pos.remainingMs;
      }
    }

    const scheduleAdvance = () => {
      if (epoch != null) {
        timerRef.current = window.setTimeout(() => {
          if (!jumpToClock()) {
            const pos = positionAt(
              durationsRef.current,
              epochMsRef.current ?? epoch,
              nowServer(),
            );
            const wait = Math.max(40, pos?.remainingMs ?? 40);
            timerRef.current = window.setTimeout(() => {
              if (!jumpToClock()) advance();
            }, wait);
          }
        }, Math.max(40, remainingMs));
        return;
      }
      timerRef.current = window.setTimeout(advance, remainingMs);
    };

    if (item.mediaType === 'video') {
      const video = videoRef.current;
      if (!video) return;

      const src = playbackUrl(item);
      primeVideoSrc(video, src);
      video.loop = items.length <= 1;
      videoUrlRef.current = src;

      let cancelled = false;
      const uncover = () => {
        if (!cancelled && video.currentTime > 0.04) setVideoCovered(false);
      };
      // The cover only exists to hide the white first frame. If playback never
      // reports progress, showing that frame still beats a black screen.
      const coverTimer = window.setTimeout(() => {
        if (!cancelled) setVideoCovered(false);
      }, VIDEO_COVER_MAX_MS);

      /** Restart from S3 when the local copy is truncated or unplayable. */
      const fallBackToStreaming = () => {
        if (cancelled || src === item.mediaUrl) return false;
        void invalidateVideoBlob(item.mediaUrl);
        kioskToast('Copia local dañada — reproduciendo desde S3', 'warn');
        scheduledPlayKeyRef.current = null;
        scheduleVideoPlay(item.mediaUrl, null);
        return true;
      };

      const onMetadata = () => {
        if (cancelled) return;
        const expected = item.durationMs || 0;
        const actual = Number.isFinite(video.duration) ? video.duration * 1000 : 0;
        if (expected > 0 && actual > 0 && actual < expected * 0.75) {
          fallBackToStreaming();
        }
      };

      const onEnded = () => {
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
        const pos = positionAt(
          durationsRef.current,
          epochMsRef.current,
          nowServer(),
        );
        if (pos && pos.index !== indexRef.current) {
          indexRef.current = pos.index;
          setIndex(pos.index);
        }
      };

      const onError = () => {
        emitStatus({
          index,
          total: items.length,
          lastError: 'Error al reproducir video',
        });
        if (fallBackToStreaming()) return;
        if (epochMsRef.current == null) advance();
      };

      video.addEventListener('loadedmetadata', onMetadata);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      video.addEventListener('playing', uncover);
      video.addEventListener('timeupdate', uncover);

      const alreadyPlaying =
        !video.paused && !video.ended && video.currentTime > 0.05;
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
        window.clearTimeout(coverTimer);
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('error', onError);
        video.removeEventListener('playing', uncover);
        video.removeEventListener('timeupdate', uncover);
        clearTimer();
        // Let the next visit to this item schedule its own start.
        scheduledPlayKeyRef.current = null;
      };
    }

    pauseVideoQuiet(videoRef.current);

    scheduleAdvance();
    return () => {
      clearTimer();
    };
  }, [
    index,
    config,
    playbackGen,
    advance,
    clearTimer,
    emitStatus,
    jumpToClock,
    kioskToast,
    nowServer,
    playbackUrl,
    scheduleVideoPlay,
  ]);

  useEffect(() => {
    if (isPreview) return;
    const id = window.setInterval(() => {
      const epoch = epochMsRef.current;
      if (epoch == null || itemsRef.current.length === 0) return;

      const currentItem = itemsRef.current[indexRef.current];
      if (currentItem?.mediaType === 'video') {
        const video = videoRef.current;
        // Videos run natively end to end — only realign once they finish.
        if (video && !video.ended) return;
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
      const item = itemsRef.current[indexRef.current];
      const epoch = epochMsRef.current;
      const src = video?.currentSrc || video?.getAttribute('src') || '';
      const source = src.startsWith('blob:')
        ? 'local'
        : src
          ? 'streaming'
          : '—';
      const dur = video && Number.isFinite(video.duration) ? video.duration : 0;
      setDebugLines([
        `build ${screenCastBuildId()}`,
        `ws ${socketRef.current?.connected ? 'ok' : 'CAÍDA'} · sync ${syncIdRef.current?.slice(0, 6) ?? '—'}`,
        `reloj ${Math.round(clockOffsetRef.current)}ms · rtt ${Number.isFinite(bestRttRef.current) ? Math.round(bestRttRef.current) : '—'}ms`,
        `item ${indexRef.current + 1}/${itemsRef.current.length} ${item?.mediaType ?? '—'} · epoch ${epoch == null ? '—' : `${((nowServer() - epoch) / 1000).toFixed(1)}s`}`,
        item?.mediaType === 'video'
          ? `video ${source} · ${video ? video.currentTime.toFixed(1) : '—'}/${dur ? dur.toFixed(1) : '?'}s · ${video?.paused ? 'pausado' : 'play'}${video?.ended ? ' fin' : ''} · rs${video?.readyState ?? '—'}`
          : 'video —',
      ]);
    }, DEBUG_HUD_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isDebug, nowServer]);

  useEffect(() => {
    if (isPreview) return;
    const onOffline = () => kioskToast('Sin red', 'warn');
    const onOnline = () => kioskToast('Red restablecida', 'ok');
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
  const videoActive = isVideoItem && !holdUi;

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
            opacity: isVideoItem ? 1 : 0,
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
