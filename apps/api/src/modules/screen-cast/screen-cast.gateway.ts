import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { Public } from '../../core/guards/public.decorator';
import { ScreenCastService } from './screen-cast.service';

const BARRIER_MS = 12_000;
/** Buffer time after all screens report ready — lets every player decode before play(). */
const EPOCH_LEAD_MS = 2_500;
const TICK_MS = 5_000;

type PlaylistClock = {
  syncId: string;
  epochMs: number;
  durationsMs: number[];
};

type SyncSession = {
  playlistId: string;
  syncId: string;
  pending: Set<string>;
  ready: Set<string>;
  durations: number[] | null;
  done: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

function isAllowedSocketOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (hostname === 'mali.pe' || hostname.endsWith('.mali.pe')) return true;
    const appUrl = process.env.APP_URL?.replace(/\/$/, '');
    if (appUrl && origin.replace(/\/$/, '') === appUrl) return true;
    const extra = process.env.CORS_ORIGINS?.split(',') ?? [];
    for (const raw of extra) {
      const allowed = raw.trim().replace(/\/$/, '');
      if (allowed && origin.replace(/\/$/, '') === allowed) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function mergeDurations(a: number[] | null, b: number[]): number[] {
  if (!a || a.length === 0) return b;
  const len = Math.max(a.length, b.length);
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    out.push(Math.max(a[i] ?? 0, b[i] ?? 0));
  }
  return out;
}

@Public()
@WebSocketGateway({
  namespace: '/screen-cast',
  path: '/socket.io',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, isAllowedSocketOrigin(origin));
    },
    credentials: true,
  },
  transports: ['websocket'],
  allowEIO3: true,
  pingInterval: 10_000,
  pingTimeout: 10_000,
})
export class ScreenCastGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(ScreenCastGateway.name);
  /** Live player sockets per screenKey (excludes preview tabs). */
  private readonly connections = new Map<string, Set<string>>();
  /** Last playback status reported by each screen. */
  private readonly playback = new Map<
    string,
    { index: number; total: number; lastError: string | null; updatedAt: number }
  >();
  private readonly playlistByScreen = new Map<string, string>();
  private readonly clocks = new Map<string, PlaylistClock>();
  private readonly sessions = new Map<string, SyncSession>();
  private readonly tickTimer: ReturnType<typeof setInterval>;

  @WebSocketServer()
  server!: Server;

  constructor(private readonly service: ScreenCastService) {
    this.tickTimer = setInterval(() => this.broadcastTicks(), TICK_MS);
  }

  onModuleDestroy() {
    clearInterval(this.tickTimer);
    for (const session of this.sessions.values()) {
      if (session.timer) clearTimeout(session.timer);
    }
    this.sessions.clear();
  }

  handleConnection(client: Socket) {
    this.logger.debug(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const key = client.data.screenKey as string | undefined;
    if (key) {
      this.removeConnection(key, client.id);
      this.onScreenOffline(key);
    }
    this.logger.debug(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { screenKey?: string } | string,
  ) {
    const screenKey =
      typeof body === 'string' ? body : body?.screenKey?.trim() ?? '';
    if (!screenKey) {
      return { ok: false, error: 'screenKey requerido' };
    }
    const key = screenKey.toLowerCase();
    const previous = client.data.screenKey as string | undefined;
    if (previous && previous !== key) {
      this.removeConnection(previous, client.id);
    }
    client.data.screenKey = key;
    this.addConnection(key, client.id);
    await client.join(this.room(key));

    const playlistId = await this.service.getMonitorPlaylistId(key);
    await this.bindPlaylistRoom(client, playlistId);
    await this.service.recordHeartbeat(key);

    return {
      ok: true,
      screenKey: key,
      serverNow: Date.now(),
      clock: this.publicClock(playlistId),
    };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { screenKey?: string } | string,
  ) {
    const screenKey =
      typeof body === 'string' ? body : body?.screenKey?.trim() ?? '';
    if (!screenKey) {
      return { ok: false, serverNow: Date.now() };
    }
    const key = screenKey.toLowerCase();
    if (!client.data.screenKey) {
      client.data.screenKey = key;
      this.addConnection(key, client.id);
      await client.join(this.room(key));
    }
    const result = await this.service.recordHeartbeat(key);
    const playlistId =
      (client.data.playlistId as string | undefined) ||
      this.playlistByScreen.get(key) ||
      null;
    return {
      ...result,
      serverNow: Date.now(),
      clock: this.publicClock(playlistId),
    };
  }

  @SubscribeMessage('status')
  handleStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      screenKey?: string;
      index?: number;
      total?: number;
      lastError?: string | null;
    },
  ) {
    const key = (
      body?.screenKey?.trim() ||
      (client.data.screenKey as string | undefined) ||
      ''
    ).toLowerCase();
    if (!key) return { ok: false };
    const index = Number(body?.index);
    const total = Number(body?.total);
    this.playback.set(key, {
      index: Number.isFinite(index) ? index : 0,
      total: Number.isFinite(total) ? total : 0,
      lastError: body?.lastError?.trim() || null,
      updatedAt: Date.now(),
    });
    return { ok: true };
  }

  @SubscribeMessage('ready')
  async handleReady(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      screenKey?: string;
      syncId?: string | null;
      playlistId?: string | null;
      durationsMs?: number[];
    },
  ) {
    const key = (
      body?.screenKey?.trim() ||
      (client.data.screenKey as string | undefined) ||
      ''
    ).toLowerCase();
    if (!key) return { ok: false };

    const playlistId = (body?.playlistId || '').trim() || null;
    if (playlistId) {
      this.playlistByScreen.set(key, playlistId);
      await this.bindPlaylistRoom(client, playlistId);
    }

    const pid =
      playlistId ||
      (client.data.playlistId as string | undefined) ||
      this.playlistByScreen.get(key);
    if (!pid) return { ok: true };

    const durations = Array.isArray(body?.durationsMs)
      ? body.durationsMs.map((n) =>
          Number.isFinite(n) && n > 0 ? n : 0,
        )
      : [];

    const session = this.sessions.get(pid);
    if (session && !session.done && body.syncId && body.syncId === session.syncId) {
      session.ready.add(key);
      if (durations.length) {
        session.durations = mergeDurations(session.durations, durations);
      }
      const allReady = [...session.pending].every((k) => session.ready.has(k));
      if (allReady) this.finishSession(session);
      return { ok: true };
    }

    const clock = this.clocks.get(pid);
    if (clock) {
      if (durations.length && clock.durationsMs.length === 0) {
        clock.durationsMs = durations;
      }
      client.emit('play:go', this.goPayload(pid, clock));
      return { ok: true };
    }

    const created: PlaylistClock = {
      syncId: 'live',
      epochMs: Date.now(),
      durationsMs: durations,
    };
    this.clocks.set(pid, created);
    return { ok: true };
  }

  isScreenConnected(screenKey: string): boolean {
    const set = this.connections.get(screenKey.trim().toLowerCase());
    return !!set && set.size > 0;
  }

  getPlaybackStatus(screenKey: string): {
    index: number;
    total: number;
    lastError: string | null;
  } | null {
    const row = this.playback.get(screenKey.trim().toLowerCase());
    if (!row) return null;
    if (Date.now() - row.updatedAt > 120_000) return null;
    return {
      index: row.index,
      total: row.total,
      lastError: row.lastError,
    };
  }

  /** Restart each playlist group that intersects these screens. */
  async restartSync(screenKeys: string[]) {
    const unique = [
      ...new Set(
        screenKeys.map((k) => k.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (unique.length === 0) return;

    const map = await this.service.getScreenPlaylistMap(unique);
    const playlistIds = new Set<string>();
    const withoutPlaylist: string[] = [];
    for (const key of unique) {
      const pid = map.get(key);
      if (pid) playlistIds.add(pid);
      else withoutPlaylist.push(key);
    }

    for (const key of withoutPlaylist) {
      this.server.to(this.room(key)).emit('playlist:sync', {
        empty: true,
        serverNow: Date.now(),
      });
      this.server.to(this.room(key)).emit('playlist:updated');
    }

    for (const playlistId of playlistIds) {
      const keys = await this.service.getScreenKeysForPlaylist(playlistId);
      this.startSession(playlistId, keys);
    }
  }

  /** Reload one screen onto the group's clock, without restarting the wall. */
  async catchUpScreen(screenKey: string) {
    const key = screenKey.trim().toLowerCase();
    const playlistId = await this.service.getMonitorPlaylistId(key);
    if (!playlistId) {
      this.server.to(this.room(key)).emit('playlist:sync', {
        empty: true,
        serverNow: Date.now(),
      });
      this.server.to(this.room(key)).emit('playlist:updated');
      return;
    }
    const clock = this.clocks.get(playlistId);
    this.server.to(this.room(key)).emit('playlist:sync', {
      syncId: clock?.syncId ?? randomUUID(),
      playlistId,
      catchUp: true,
      epochMs: clock?.epochMs,
      durationsMs: clock?.durationsMs ?? [],
      serverNow: Date.now(),
    });
  }

  notifyPlaylistUpdated(screenKeys: string[]) {
    void this.restartSync(screenKeys);
  }

  private startSession(playlistId: string, screenKeys: string[]) {
    const prev = this.sessions.get(playlistId);
    if (prev?.timer) clearTimeout(prev.timer);
    if (prev) prev.done = true;

    const keys = screenKeys.map((k) => k.trim().toLowerCase()).filter(Boolean);
    const syncId = randomUUID();
    const pending = new Set(keys.filter((k) => this.isScreenConnected(k)));
    const session: SyncSession = {
      playlistId,
      syncId,
      pending,
      ready: new Set(),
      durations: null,
      done: false,
      timer: null,
    };
    this.sessions.set(playlistId, session);

    const payload = {
      syncId,
      playlistId,
      catchUp: false,
      serverNow: Date.now(),
    };
    for (const key of keys) {
      this.server.to(this.room(key)).emit('playlist:sync', payload);
      this.server.to(this.room(key)).emit('playlist:updated');
    }

    if (pending.size === 0) {
      this.sessions.delete(playlistId);
      return;
    }

    session.timer = setTimeout(() => this.finishSession(session), BARRIER_MS);
  }

  private finishSession(session: SyncSession) {
    if (session.done) return;
    session.done = true;
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }
    this.sessions.delete(session.playlistId);

    const clock: PlaylistClock = {
      syncId: session.syncId,
      epochMs: Date.now() + EPOCH_LEAD_MS,
      durationsMs: session.durations ?? [],
    };
    this.clocks.set(session.playlistId, clock);
    this.server
      .to(this.playlistRoom(session.playlistId))
      .emit('play:go', this.goPayload(session.playlistId, clock));
    this.logger.log(
      `play:go playlist=${session.playlistId} ready=${session.ready.size}/${session.pending.size}`,
    );
  }

  private onScreenOffline(screenKey: string) {
    if (this.isScreenConnected(screenKey)) return;
    for (const session of this.sessions.values()) {
      if (session.done || !session.pending.has(screenKey)) continue;
      session.pending.delete(screenKey);
      if (session.pending.size === 0) {
        if (session.ready.size > 0) this.finishSession(session);
        else {
          session.done = true;
          if (session.timer) clearTimeout(session.timer);
          this.sessions.delete(session.playlistId);
        }
        continue;
      }
      const allReady = [...session.pending].every((k) => session.ready.has(k));
      if (allReady) this.finishSession(session);
    }
  }

  private broadcastTicks() {
    if (!this.server) return;
    const serverNow = Date.now();
    for (const [playlistId, clock] of this.clocks) {
      this.server.to(this.playlistRoom(playlistId)).emit('play:tick', {
        playlistId,
        syncId: clock.syncId,
        epochMs: clock.epochMs,
        durationsMs: clock.durationsMs,
        serverNow,
      });
    }
  }

  private publicClock(playlistId: string | null): PlaylistClock | null {
    if (!playlistId) return null;
    return this.clocks.get(playlistId) ?? null;
  }

  private goPayload(playlistId: string, clock: PlaylistClock) {
    return {
      playlistId,
      syncId: clock.syncId,
      epochMs: clock.epochMs,
      durationsMs: clock.durationsMs,
      serverNow: Date.now(),
    };
  }

  private async bindPlaylistRoom(client: Socket, playlistId: string | null) {
    const previous = client.data.playlistId as string | undefined;
    if (previous && previous !== playlistId) {
      await client.leave(this.playlistRoom(previous));
    }
    client.data.playlistId = playlistId;
    if (playlistId) {
      const key = client.data.screenKey as string | undefined;
      if (key) this.playlistByScreen.set(key, playlistId);
      await client.join(this.playlistRoom(playlistId));
    }
  }

  private addConnection(screenKey: string, socketId: string) {
    let set = this.connections.get(screenKey);
    if (!set) {
      set = new Set();
      this.connections.set(screenKey, set);
    }
    set.add(socketId);
  }

  private removeConnection(screenKey: string, socketId: string) {
    const set = this.connections.get(screenKey);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) {
      this.connections.delete(screenKey);
      this.playback.delete(screenKey);
      this.playlistByScreen.delete(screenKey);
    }
  }

  private room(screenKey: string) {
    return `screen:${screenKey}`;
  }

  private playlistRoom(playlistId: string) {
    return `playlist:${playlistId}`;
  }
}
