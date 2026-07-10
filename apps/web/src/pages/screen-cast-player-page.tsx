import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import type {
  ScreenCastPublicConfigDto,
  ScreenCastPublicItemDto,
} from '@mali-one/shared';
import { api } from '@/lib/api';
import {
  cacheScreenCastPlaylist,
  registerScreenCastServiceWorker,
} from '@/lib/screen-cast-offline';

const HEARTBEAT_MS = 30_000;

function destroyVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  try {
    video.pause();
    video.removeAttribute('src');
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }
    video.load();
  } catch {
    // ignore cleanup errors on Tizen
  }
}

export function ScreenCastPlayerPage() {
  const [params] = useSearchParams();
  const screenKey = (params.get('id') ?? '').trim().toLowerCase();
  const [config, setConfig] = useState<ScreenCastPublicConfigDto | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const timerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const indexRef = useRef(0);
  const itemsRef = useRef<ScreenCastPublicItemDto[]>([]);

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

  useEffect(() => {
    void registerScreenCastServiceWorker();
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!screenKey) return;

    const socket = io('/screen-cast', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
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
  }, [screenKey, loadConfig]);

  useEffect(() => {
    clearTimer();
    destroyVideo(videoRef.current);

    const items = itemsRef.current;
    const item = items[index];
    if (!item || !config || config.empty) {
      return () => {
        clearTimer();
        destroyVideo(videoRef.current);
      };
    }

    if (item.mediaType === 'video') {
      const video = videoRef.current;
      if (!video) return;

      const onEnded = () => advance();
      const onError = () => advance();
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

  return (
    <div className="screen-cast-player fixed inset-0 z-100 bg-black text-white">
      {loading && (
        <div className="flex h-full items-center justify-center text-sm opacity-70">
          Cargando…
        </div>
      )}

      {!loading && error && (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-lg font-medium">No se pudo cargar la pantalla</p>
          <p className="text-sm opacity-70">{error}</p>
        </div>
      )}

      {!loading && !error && config?.empty && (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-2xl font-medium tracking-wide">
            Sin contenido asignado
          </p>
        </div>
      )}

      {/* Keep a single video element mounted to allow strict cleanup */}
      <video
        ref={videoRef}
        className={
          showVideo ? 'h-full w-full object-contain' : 'pointer-events-none hidden'
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
          className="h-full w-full object-contain"
          draggable={false}
        />
      )}
    </div>
  );
}
