import {
  useCallback,
  useEffect,
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

function stageStyle(
  isPortraitConfig: boolean,
  viewportPortrait: boolean,
  vw: number,
  vh: number,
): CSSProperties {
  if (!isPortraitConfig) {
    return { width: '100%', height: '100%' };
  }
  // Native portrait viewport (e.g. 1080×1920): fill without CSS rotate.
  if (viewportPortrait) {
    return { width: '100%', height: '100%' };
  }
  // Landscape browser + portrait content: rotate stage (Samsung Signage pattern).
  // Use innerWidth/innerHeight px — more reliable than vh/vw on Tizen chrome.
  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: `${vh}px`,
    height: `${vw}px`,
    transform: 'translate(-50%, -50%) rotate(90deg)',
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
  const [viewportPortrait, setViewportPortrait] = useState(isViewportPortrait);
  const [viewportSize, setViewportSize] = useState(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1920,
    vh: typeof window !== 'undefined' ? window.innerHeight : 1080,
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

  // Lock document scroll for kiosk / Tizen (rotated stage overflows layout box).
  useEffect(() => {
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

    // Immediate heartbeat so presence is fresh without waiting for the interval.
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

  useEffect(() => {
    clearTimer();
    destroyVideo(videoRef.current);
    window.scrollTo(0, 0);

    const items = itemsRef.current;
    const item = items[index];
    if (!item || !config || config.empty) {
      return () => {
        clearTimer();
        destroyVideo(videoRef.current);
      };
    }

    // Preload next still so Samsung first-paint is less delayed.
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
      const onError = () => advance();

      // Only same-origin media may use crossOrigin. S3 signed URLs typically
      // lack bucket CORS; setting anonymous would block the video from loading.
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
  }, [index, config, advance, clearTimer]);

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
    advance();
  }

  return (
    <div className="screen-cast-player z-100 overflow-hidden bg-black text-white">
      <div
        className="flex h-full w-full items-center justify-center"
        style={stageStyle(
          isPortrait,
          viewportPortrait,
          viewportSize.vw,
          viewportSize.vh,
        )}
      >
        {loading && (
          <div className="flex h-full w-full items-center justify-center text-sm opacity-70">
            Cargando…
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-lg font-medium">No se pudo cargar la pantalla</p>
            <p className="text-sm opacity-70">{error}</p>
          </div>
        )}

        {!loading && !error && config?.empty && (
          <div className="flex h-full w-full items-center justify-center px-6 text-center">
            <p className="text-2xl font-medium tracking-wide">
              Sin contenido asignado
            </p>
          </div>
        )}

        <video
          ref={videoRef}
          className={
            showVideo
              ? 'h-full w-full object-cover'
              : 'pointer-events-none hidden'
          }
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
            className="h-full w-full object-cover"
            draggable={false}
            {...(imageUsesCors ? { crossOrigin: 'anonymous' as const } : {})}
            onError={handleImageError}
          />
        )}
      </div>
    </div>
  );
}
