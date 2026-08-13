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

/**
 * Socket.IO over WebSocket only (no long-polling).
 * Uses the page origin so https → wss and http → ws automatically via /socket.io/.
 */
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

/**
 * Portrait on landscape browser: size stage to vh×vw and center with margins
 * (not translate+rotate — that mis-centers on Tizen and leaves a top gap).
 */
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

  // Panel/browser already portrait (1080×1920): no CSS rotate.
  if (viewportPortrait) return fill;

  // Landscape browser + portrait content (Samsung Signage pattern).
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

export function ScreenCastPlayerPage() {
  const [params] = useSearchParams();
  const screenKey = (params.get('id') ?? '').trim().toLowerCase();
  const isPreview = params.get('preview') === '1';
  const [config, setConfig] = useState<ScreenCastPublicConfigDto | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewportPortrait, setViewportPortrait] = useState(() =>
    typeof window !== 'undefined' ? isViewportPortrait() : true,
  );
  const [viewportSize, setViewportSize] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1080,
    vh: typeof window !== 'undefined' ? window.innerHeight : 1920,
  }));

  const timerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const indexRef = useRef(0);
  const itemsRef = useRef<ScreenCastPublicItemDto[]>([]);
  const preloadRef = useRef<HTMLImageElement | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
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

  const loadConfig = useCallback(async () => {
    if (!screenKey) {
      setError('Falta el parámetro id en la URL');
      setLoading(false);
      return;
    }
    cleanupMedia();
    try {
      const data = await api.getScreenCastPublicConfig(screenKey);
      setConfig(data);
      itemsRef.current = data.items;
      indexRef.current = 0;
      setIndex(0);
      setError('');
      void cacheScreenCastPlaylist(screenKey, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar contenido');
      setConfig(null);
      itemsRef.current = [];
    } finally {
      setLoading(false);
    }
  }, [screenKey, cleanupMedia]);

  // Before paint: lock kiosk styles so the first frame is already full-bleed.
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
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!screenKey || isPreview) return;

    const socket = connectScreenCastSocket(screenKey);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { screenKey });
    });

    socket.on('playlist:updated', () => {
      void loadConfig();
    });

    const sendHeartbeat = () => {
      if (socket.connected) {
        socket.emit('heartbeat', { screenKey });
      }
    };

    sendHeartbeat();
    heartbeatRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_MS);

    return () => {
      if (heartbeatRef.current !== null) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [screenKey, isPreview, loadConfig]);

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

  useEffect(() => {
    clearTimer();
    destroyVideo(videoRef.current);
    window.scrollTo(0, 0);

    const items = itemsRef.current;
    const item = items[index];
    if (!item || !config || config.empty) {
      emitStatus({ index: 0, total: 0 });
      return () => {
        clearTimer();
        destroyVideo(videoRef.current);
      };
    }

    emitStatus({ index, total: items.length });

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

    if (item.mediaType === 'video') {
      const video = videoRef.current;
      if (!video) return;

      const onEnded = () => advance();
      const onError = () => {
        emitStatus({
          index,
          total: items.length,
          lastError: 'Error al reproducir video',
        });
        advance();
      };

      if (isCorsCacheableMediaUrl(item.mediaUrl)) {
        video.crossOrigin = 'anonymous';
      } else {
        video.removeAttribute('crossorigin');
      }
      video.src = item.mediaUrl;
      video.addEventListener('ended', onEnded);
      video.addEventListener('error', onError);
      void video.play().catch(() => {
        timerRef.current = window.setTimeout(
          advance,
          item.durationMs || 10_000,
        );
      });

      return () => {
        video.removeEventListener('ended', onEnded);
        video.removeEventListener('error', onError);
        destroyVideo(video);
        clearTimer();
      };
    }

    timerRef.current = window.setTimeout(advance, item.durationMs || 10_000);
    return () => {
      clearTimer();
    };
  }, [index, config, advance, clearTimer, emitStatus]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, [cleanupMedia]);

  const current = config?.items[index];
  const showVideo = !!current && current.mediaType === 'video';
  const showImage =
    !!current &&
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
    advance();
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
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm opacity-70">
            Cargando…
          </div>
        )}

        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-medium">No se pudo cargar la pantalla</p>
            <p className="text-sm opacity-70">{error}</p>
          </div>
        )}

        {!loading && !error && config?.empty && (
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
