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
import { startScreenCastAutoUpdate } from '@/lib/screen-cast-update';
import {
  CLIENT_GO_FALLBACK_MS,
  DRIFT_INTERVAL_MS,
  MEASURE_TIMEOUT_MS,
  VIDEO_START_SEEK_MS,
  clockOffsetFromAck,
  measureAllDurations,
  positionAt,
  resolveDurations,
  warmupItem,
  type PlayGoPayload,
  type PlaylistClock,
  type PlaylistSyncPayload,
} from '@/lib/screen-cast-sync';

const HEARTBEAT_MS = 30_000;
const KIOSK_CLASS = 'screen-cast-kiosk';

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

function isViewportPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

function KioskLoader() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
      <div
        className="h-16 w-16 rounded-full border-[3px] border-white/20 border-t-white animate-spin"
        role="status"
        aria-label="Cargando"
      />
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
  const [config, setConfig] = useState<ScreenCastPublicConfigDto | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [playbackGen, setPlaybackGen] = useState(0);
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
  const warmVideoRef = useRef<HTMLVideoElement | null>(null);
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
  const syncTokenRef = useRef(0);
  const videoUrlRef = useRef<string | null>(null);

  const nowServer = useCallback(() => Date.now() + clockOffsetRef.current, []);

  const applyClockOffset = useCallback((serverNow: number | undefined, sentAt: number) => {
    if (!serverNow) return;
    clockOffsetRef.current = clockOffsetFromAck(
      serverNow,
      sentAt,
      Date.now(),
    );
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

  const cleanupMedia = useCallback(() => {
    clearTimer();
    destroyVideo(videoRef.current);
  }, [clearTimer]);

  const advance = useCallback(() => {
    const len = itemsRef.current.length;
    if (len === 0) return;
    const next = (indexRef.current + 1) % len;
    indexRef.current = next;
    setIndex(next);
  }, []);

  const holdForSync = useCallback(() => {
    setSyncing(true);
    try {
      videoRef.current?.pause();
    } catch {
      // Tizen may throw if the element is mid-load
    }
  }, []);

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
      void cacheScreenCastPlaylist(screenKey, data);
    },
    [screenKey],
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
      const pos = positionAt(durations, payload.epochMs, nowServer());
      const nextIndex = pos?.index ?? 0;
      indexRef.current = nextIndex;
      setConfig(data);
      setIndex(nextIndex);
      setError('');
      setLoading(false);
      setSyncing(false);
      setPlaybackGen((g) => g + 1);
      void cacheScreenCastPlaylist(screenKey, data);
    },
    [applyClockOffset, clearGoFallback, nowServer, screenKey],
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
      const startItem = data.items[pos?.index ?? 0];
      if (startItem?.mediaType !== 'video') {
        await warmupItem(
          startItem,
          MEASURE_TIMEOUT_MS,
          warmVideoRef.current,
        );
      }
      emitReady(syncId, data.playlistId, durations);
    },
    [applyConfig, emitReady, nowServer],
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
      syncIdRef.current = payload.syncId ?? null;
      pendingGoRef.current = null;
      readyForGoRef.current = false;

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
            const startItem = data.items[pos?.index ?? 0];
            if (startItem?.mediaType !== 'video') {
              await warmupItem(
                startItem,
                MEASURE_TIMEOUT_MS,
                warmVideoRef.current,
              );
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
        pendingGoRef.current = payload;
        if (readyForGoRef.current) applyGo(payload);
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
    if (nextItem && nextItem !== item) {
      if (nextItem.mediaType === 'image' || nextItem.mediaType === 'gif') {
        const pre = new Image();
        preloadRef.current = pre;
        pre.src = nextItem.mediaUrl;
      } else if (nextItem.mediaType === 'video' && warmVideoRef.current) {
        const warm = warmVideoRef.current;
        if (isCorsCacheableMediaUrl(nextItem.mediaUrl)) {
          warm.crossOrigin = 'anonymous';
        } else {
          warm.removeAttribute('crossorigin');
        }
        if (warm.src !== nextItem.mediaUrl) {
          warm.preload = 'auto';
          warm.muted = true;
          warm.src = nextItem.mediaUrl;
        }
      }
    }

    const epoch = epochMsRef.current;
    let startOffsetMs = 0;
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
    } else if (epoch != null && item.mediaType === 'video') {
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
        startOffsetMs = pos.offsetMs;
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

      const sameSource =
        videoUrlRef.current === item.mediaUrl &&
        (video.src === item.mediaUrl || video.src.endsWith(item.mediaUrl));

      const onEnded = () => {
        if (epochMsRef.current != null) {
          if (jumpToClock()) return;
          if (itemsRef.current.length === 1) {
            setPlaybackGen((g) => g + 1);
            return;
          }
          advance();
          return;
        }
        advance();
      };
      const onError = () => {
        emitStatus({
          index,
          total: items.length,
          lastError: 'Error al reproducir video',
        });
        if (epochMsRef.current != null) jumpToClock();
        else advance();
      };

      if (isCorsCacheableMediaUrl(item.mediaUrl)) {
        video.crossOrigin = 'anonymous';
      } else {
        video.removeAttribute('crossorigin');
      }

      const startPlayback = () => {
        if (
          epoch != null &&
          startOffsetMs > VIDEO_START_SEEK_MS &&
          Number.isFinite(video.duration)
        ) {
          const t = Math.min(
            startOffsetMs / 1000,
            Math.max(0, video.duration - 0.12),
          );
          if (t > 0.08) video.currentTime = t;
        }
        void video.play().catch(() => {
          if (epoch == null) scheduleAdvance();
        });
      };

      const onMeta = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          const actualMs = Math.round(video.duration * 1000);
          const durations = [...durationsRef.current];
          if (durations.length > index) {
            durations[index] = Math.max(durations[index] || 0, actualMs);
            durationsRef.current = durations;
          }
        }
        startPlayback();
      };

      if (sameSource && !video.ended) {
        videoUrlRef.current = item.mediaUrl;
        if (video.paused) startPlayback();
        if (epoch == null) scheduleAdvance();
        return () => {
          clearTimer();
        };
      }

      videoUrlRef.current = item.mediaUrl;
      video.addEventListener('loadedmetadata', onMeta);
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      video.src = item.mediaUrl;
      if (epoch == null) scheduleAdvance();

      return () => {
        video.removeEventListener('loadedmetadata', onMeta);
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('error', onError);
        clearTimer();
      };
    }

    destroyVideo(videoRef.current);
    videoUrlRef.current = null;

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
    nowServer,
  ]);

  useEffect(() => {
    if (isPreview) return;
    const id = window.setInterval(() => {
      const epoch = epochMsRef.current;
      if (epoch == null || itemsRef.current.length === 0) return;

      const currentItem = itemsRef.current[indexRef.current];
      if (currentItem?.mediaType === 'video') {
        const video = videoRef.current;
        // Videos play natively — only resync once they finish.
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

  const current = config?.items[index];
  const holdUi = loading || syncing;
  const showVideo = !!current && current.mediaType === 'video' && !holdUi;
  const showImage =
    !!current &&
    !holdUi &&
    (current.mediaType === 'image' || current.mediaType === 'gif');
  const imageUsesCors =
    !!current && isCorsCacheableMediaUrl(current.mediaUrl);

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
        {(loading || syncing) && <KioskLoader />}

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
          className={showVideo ? undefined : 'pointer-events-none hidden'}
          style={showVideo ? MEDIA_FILL_STYLE : undefined}
          autoPlay
          muted
          playsInline
          loop={false}
          preload="auto"
        />

        <video
          ref={warmVideoRef}
          className="pointer-events-none hidden"
          muted
          playsInline
          preload="auto"
        />

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
      </div>
    </div>
  );
}
