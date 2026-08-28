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

/**
 * Upper bound for a slow screen to report ready. Videos download in the
 * background now, so this only covers buffering the first item.
 */
const BARRIER_MS = 12_000;
/** Lead after every screen is buffered so both can schedule play() before epoch. */
const EPOCH_LEAD_MS = 1_000;
const TICK_MS = 5_000;
/**
 * A burst of admin writes (reorder, then patch, then patch) must produce a
 * single restart, not one per request.
 */
const RESTART_COALESCE_MS = 2_500;
/**
 * A kiosk that drops and comes back within this window never left as far as
 * the wall is concerned: it must not collapse the barrier for the screens that
 * are still playing. Kept above BARRIER_MS so a live session always waits for
 * the barrier instead of finishing the moment one screen blinks.
 */
const OFFLINE_GRACE_MS = 15_000;
/**
 * The Tizen 6.1 browser blocks its JS thread for many seconds while decoding
 * and while pulling a video over a slow link, so a tight pong deadline reads a
 * busy screen as a dead one. play:tick already puts a frame on the wire every
 * 5s, so idle proxies are not a concern; only genuine outages are.
 */
const PING_INTERVAL_MS = 20_000;
const PING_TIMEOUT_MS = 45_000;

type PlaylistClock = {
  syncId: string;
  epochMs: number;
  durationsMs: number[];
  /** Content fingerprint this clock was started for. */
  signature: string | null;
};

type SyncSession = {
  playlistId: string;
  syncId: string;
  signature: string | null;
  /** Every screen assigned to the playlist, connected or not. */
  members: Set<string>;
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

const MAX_LOCAL_URLS = 64;
const MAX_LOCAL_URL_LEN = 2048;

function sanitizeLocalUrls(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const url = value.trim();
    if (!url || url.length > MAX_LOCAL_URL_LEN || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_LOCAL_URLS) break;
  }
  return out;
}

function sameUrlSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((url) => set.has(url));
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
  // The kiosk connects with upgrade:false, so there is nothing to negotiate.
  allowUpgrades: false,
  allowEIO3: true,
  pingInterval: PING_INTERVAL_MS,
  pingTimeout: PING_TIMEOUT_MS,
  // Compression buys nothing on these tiny JSON frames and costs CPU per screen.
  perMessageDeflate: false,
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
  /** Screens whose disconnect is still inside the reconnect grace window. */
  private readonly offlineTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  /** Pending coalesced restarts, keyed by playlist. */
  private readonly restartTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  /** Original media URLs each screen has fully downloaded. */
  private readonly localUrlsByScreen = new Map<string, Set<string>>();
  /** Intersection of connected screens' local sets, per playlist. */
  private readonly playableByPlaylist = new Map<string, string[]>();
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
    for (const timer of this.offlineTimers.values()) clearTimeout(timer);
    for (const timer of this.restartTimers.values()) clearTimeout(timer);
    this.sessions.clear();
    this.offlineTimers.clear();
    this.restartTimers.clear();
  }

  handleConnection(client: Socket) {
    const transport = client.conn?.transport?.name ?? 'unknown';
    this.logger.debug(`WS connected: ${client.id} transport=${transport}`);
    // engine.io reports why the socket really went away ("ping timeout",
    // "transport close", "transport error"...). Without it every drop looks
    // the same in the logs and a proxy problem is indistinguishable from a
    // screen that stopped answering pings.
    client.conn?.on('close', (reason: string, description?: unknown) => {
      const key = (client.data.screenKey as string | undefined) ?? '-';
      const detail =
        description instanceof Error ? ` detail=${description.message}` : '';
      this.logger.debug(
        `WS closed: ${client.id} screen=${key} reason=${reason}${detail}`,
      );
    });
  }

  handleDisconnect(client: Socket) {
    const key = client.data.screenKey as string | undefined;
    if (key) {
      this.removeConnection(key, client.id);
      this.scheduleOffline(key);
    }
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { screenKey?: string; localUrls?: string[] } | string,
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
    if (typeof body !== 'string') {
      this.recordLocalUrls(key, body?.localUrls, playlistId);
    }

    // A screen that comes back while its group is still buffering has to
    // rejoin that barrier, otherwise it is left out of the count and gets a
    // play:go it never prepared for.
    this.rejoinLiveSession(client, key, playlistId);

    return {
      ok: true,
      screenKey: key,
      serverNow: Date.now(),
      clock: this.publicClock(playlistId),
      playableUrls: this.playableUrls(playlistId),
    };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { screenKey?: string; localUrls?: string[] } | string,
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
    if (typeof body !== 'string') {
      this.recordLocalUrls(key, body?.localUrls, playlistId);
    }
    return {
      ...result,
      serverNow: Date.now(),
      clock: this.publicClock(playlistId),
      playableUrls: this.playableUrls(playlistId),
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
      localUrls?: string[];
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
    this.recordLocalUrls(
      key,
      body?.localUrls,
      playlistId ||
        (client.data.playlistId as string | undefined) ||
        this.playlistByScreen.get(key) ||
        null,
    );

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
      if (this.allPendingReady(session)) this.finishSession(session, 'ready');
      return { ok: true };
    }

    const clock = this.clocks.get(pid);
    if (clock && durations.length && clock.durationsMs.length === 0) {
      clock.durationsMs = durations;
    }
    // Do not emit play:go here — that restarts every screen that reports
    // ready (reconnect, heartbeat race) and causes mid-video seeks.
    if (!clock) {
      this.clocks.set(pid, {
        syncId: 'live',
        epochMs: Date.now(),
        durationsMs: durations,
        signature: null,
      });
    }
    return { ok: true };
  }

  @SubscribeMessage('local')
  handleLocal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { screenKey?: string; localUrls?: string[] },
  ) {
    const key = (
      body?.screenKey?.trim() ||
      (client.data.screenKey as string | undefined) ||
      ''
    ).toLowerCase();
    if (!key) return { ok: false };
    const playlistId =
      (client.data.playlistId as string | undefined) ||
      this.playlistByScreen.get(key) ||
      null;
    this.recordLocalUrls(key, body?.localUrls, playlistId);
    return { ok: true, playableUrls: this.playableUrls(playlistId) };
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

  /**
   * Re-sync each playlist group that intersects these screens.
   *
   * Restarting the wall is destructive: every screen drops what it is playing,
   * re-fetches and re-buffers. So it only happens when the playlist content
   * actually changed, or when an operator explicitly forces it. Repeated calls
   * that change nothing are a no-op — the screens already share the clock, and
   * play:tick keeps them on it.
   */
  async restartSync(
    screenKeys: string[],
    options: {
      force?: boolean;
      /** Re-anchor screens to the running clock instead of doing nothing. */
      catchUpWhenUnchanged?: boolean;
      reason?: string;
    } = {},
  ) {
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

    const reason = options.reason ?? 'unknown';
    for (const playlistId of playlistIds) {
      const signature = await this.service.getPlaylistSignature(playlistId);
      const clock = this.clocks.get(playlistId);
      // An unknown fingerprint (no clock yet, or a clock improvised from a
      // `ready` before any session ran) always counts as changed.
      const unchanged =
        !options.force &&
        !!clock &&
        clock.signature !== null &&
        signature !== null &&
        clock.signature === signature;
      if (unchanged) {
        this.logger.log(
          `sync sin cambios playlist=${playlistId} reason=${reason} — se mantiene el reloj`,
        );
        this.server.to(this.playlistRoom(playlistId)).emit('playlist:updated');
        if (options.catchUpWhenUnchanged && clock) {
          this.server.to(this.playlistRoom(playlistId)).emit('playlist:sync', {
            syncId: clock.syncId,
            playlistId,
            catchUp: true,
            epochMs: clock.epochMs,
            durationsMs: clock.durationsMs,
            playableUrls: this.playableUrls(playlistId),
            serverNow: Date.now(),
          });
        }
        continue;
      }
      const keys = await this.service.getScreenKeysForPlaylist(playlistId);
      this.scheduleSession(playlistId, keys, signature, reason);
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
      playableUrls: this.playableUrls(playlistId),
      serverNow: Date.now(),
    });
  }

  notifyPlaylistUpdated(screenKeys: string[]) {
    void this.restartSync(screenKeys, { reason: 'playlist:updated' });
  }

  /**
   * Collapse a burst of writes into one restart. Saving a playlist fires
   * several endpoints in a row, and each one used to tear the wall down.
   */
  private scheduleSession(
    playlistId: string,
    screenKeys: string[],
    signature: string | null,
    reason: string,
  ) {
    const pendingRestart = this.restartTimers.get(playlistId);
    if (pendingRestart) {
      clearTimeout(pendingRestart);
      this.logger.debug(
        `restart coalescido playlist=${playlistId} reason=${reason}`,
      );
    }
    this.restartTimers.set(
      playlistId,
      setTimeout(() => {
        this.restartTimers.delete(playlistId);
        this.startSession(playlistId, screenKeys, signature, reason);
      }, RESTART_COALESCE_MS),
    );
  }

  private startSession(
    playlistId: string,
    screenKeys: string[],
    signature: string | null,
    reason: string,
  ) {
    const prev = this.sessions.get(playlistId);
    if (prev?.timer) clearTimeout(prev.timer);
    if (prev) prev.done = true;

    const keys = screenKeys.map((k) => k.trim().toLowerCase()).filter(Boolean);
    const syncId = randomUUID();
    const pending = new Set(keys.filter((k) => this.isScreenConnected(k)));
    const session: SyncSession = {
      playlistId,
      syncId,
      signature,
      members: new Set(keys),
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
      playableUrls: this.playableUrls(playlistId),
      serverNow: Date.now(),
    };
    for (const key of keys) {
      this.server.to(this.room(key)).emit('playlist:sync', payload);
      this.server.to(this.room(key)).emit('playlist:updated');
    }

    this.logger.log(
      `sync start playlist=${playlistId} reason=${reason} pantallas=${pending.size}/${keys.length}`,
    );

    if (pending.size === 0) {
      this.sessions.delete(playlistId);
      return;
    }

    session.timer = setTimeout(
      () => this.finishSession(session, 'barrier'),
      BARRIER_MS,
    );
  }

  private finishSession(session: SyncSession, cause: string) {
    if (session.done) return;
    session.done = true;
    if (session.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }
    if (this.sessions.get(session.playlistId) === session) {
      this.sessions.delete(session.playlistId);
    }

    const clock: PlaylistClock = {
      syncId: session.syncId,
      epochMs: Date.now() + EPOCH_LEAD_MS,
      durationsMs: session.durations ?? [],
      signature: session.signature,
    };
    this.clocks.set(session.playlistId, clock);
    this.server
      .to(this.playlistRoom(session.playlistId))
      .emit('play:go', this.goPayload(session.playlistId, clock));
    this.logger.log(
      `play:go playlist=${session.playlistId} ready=${session.ready.size}/${session.pending.size} cause=${cause}`,
    );
  }

  /** An empty pending set must never read as "everybody is ready". */
  private allPendingReady(session: SyncSession): boolean {
    if (session.pending.size === 0) return false;
    for (const key of session.pending) {
      if (!session.ready.has(key)) return false;
    }
    return true;
  }

  /**
   * Hold the barrier open for a screen that reconnected mid-session so it is
   * counted once, on its new socket, instead of being silently dropped.
   */
  private rejoinLiveSession(
    client: Socket,
    screenKey: string,
    playlistId: string | null,
  ) {
    if (!playlistId) return;
    const session = this.sessions.get(playlistId);
    if (!session || session.done || !session.members.has(screenKey)) return;
    session.pending.add(screenKey);
    session.ready.delete(screenKey);
    client.emit('playlist:sync', {
      syncId: session.syncId,
      playlistId,
      catchUp: false,
      playableUrls: this.playableUrls(playlistId),
      serverNow: Date.now(),
    });
  }

  /**
   * A flapping link must not count as a screen leaving: dropping it from the
   * barrier immediately lets the session finish early and re-seeks every other
   * screen in the group.
   */
  private scheduleOffline(screenKey: string) {
    const existing = this.offlineTimers.get(screenKey);
    if (existing) clearTimeout(existing);
    this.offlineTimers.set(
      screenKey,
      setTimeout(() => {
        this.offlineTimers.delete(screenKey);
        if (this.isScreenConnected(screenKey)) return;
        this.onScreenOffline(screenKey);
      }, OFFLINE_GRACE_MS),
    );
  }

  private onScreenOffline(screenKey: string) {
    if (this.isScreenConnected(screenKey)) return;
    for (const session of this.sessions.values()) {
      if (session.done || !session.pending.has(screenKey)) continue;
      session.pending.delete(screenKey);
      session.ready.delete(screenKey);
      if (session.pending.size === 0) {
        // Nobody left to wait for. Only publish a clock if a screen actually
        // reported ready; otherwise the group is dark and a play:go would just
        // reset whoever comes back.
        if (session.ready.size > 0) this.finishSession(session, 'last-offline');
        else {
          session.done = true;
          if (session.timer) clearTimeout(session.timer);
          if (this.sessions.get(session.playlistId) === session) {
            this.sessions.delete(session.playlistId);
          }
        }
        continue;
      }
      if (this.allPendingReady(session)) {
        this.finishSession(session, 'offline-unblocked');
      }
    }
  }

  private broadcastTicks() {
    if (!this.server) return;
    const serverNow = Date.now();
    const live = new Set(this.playlistByScreen.values());
    for (const [playlistId, clock] of this.clocks) {
      if (!live.has(playlistId)) continue;
      this.server.to(this.playlistRoom(playlistId)).emit('play:tick', {
        playlistId,
        syncId: clock.syncId,
        epochMs: clock.epochMs,
        durationsMs: clock.durationsMs,
        playableUrls: this.playableUrls(playlistId),
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
      playableUrls: this.playableUrls(playlistId),
      serverNow: Date.now(),
    };
  }

  private playableUrls(playlistId: string | null): string[] {
    if (!playlistId) return [];
    return this.playableByPlaylist.get(playlistId) ?? this.computePlayable(playlistId);
  }

  private recordLocalUrls(
    screenKey: string,
    raw: unknown,
    playlistId: string | null,
  ) {
    const urls = sanitizeLocalUrls(raw);
    if (!urls) return;
    const next = new Set(urls);
    const prev = this.localUrlsByScreen.get(screenKey);
    const unchanged =
      !!prev && prev.size === next.size && [...next].every((url) => prev.has(url));
    this.localUrlsByScreen.set(screenKey, next);
    if (!unchanged && playlistId) this.publishPlayable(playlistId);
  }

  private connectedKeysForPlaylist(playlistId: string): string[] {
    const keys: string[] = [];
    for (const [key, pid] of this.playlistByScreen) {
      if (pid === playlistId && this.isScreenConnected(key)) keys.push(key);
    }
    return keys;
  }

  private computePlayable(playlistId: string): string[] {
    const screens = this.connectedKeysForPlaylist(playlistId);
    if (screens.length === 0) return [];
    let acc: Set<string> | null = null;
    for (const key of screens) {
      const urls = this.localUrlsByScreen.get(key) ?? new Set<string>();
      if (!acc) {
        acc = new Set(urls);
        continue;
      }
      for (const url of [...acc]) {
        if (!urls.has(url)) acc.delete(url);
      }
    }
    return acc ? [...acc] : [];
  }

  /**
   * A video is only "playable" for the wall when every connected screen has
   * the file locally. Publish as soon as that set changes so both TVs start
   * (or keep holding) on the same decision.
   */
  private publishPlayable(playlistId: string) {
    const next = this.computePlayable(playlistId);
    const prev = this.playableByPlaylist.get(playlistId) ?? [];
    if (sameUrlSet(next, prev)) return;
    this.playableByPlaylist.set(playlistId, next);
    this.logger.log(
      `playable playlist=${playlistId} clips=${next.length} pantallas=${this.connectedKeysForPlaylist(playlistId).length}`,
    );
    const clock = this.clocks.get(playlistId);
    this.server.to(this.playlistRoom(playlistId)).emit('play:tick', {
      playlistId,
      syncId: clock?.syncId,
      epochMs: clock?.epochMs,
      durationsMs: clock?.durationsMs,
      playableUrls: next,
      serverNow: Date.now(),
    });
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
    const pendingOffline = this.offlineTimers.get(screenKey);
    if (pendingOffline) {
      clearTimeout(pendingOffline);
      this.offlineTimers.delete(screenKey);
    }
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
      const playlistId = this.playlistByScreen.get(screenKey) ?? null;
      this.connections.delete(screenKey);
      this.playback.delete(screenKey);
      this.playlistByScreen.delete(screenKey);
      if (playlistId) this.publishPlayable(playlistId);
    }
  }

  private room(screenKey: string) {
    return `screen:${screenKey}`;
  }

  private playlistRoom(playlistId: string) {
    return `playlist:${playlistId}`;
  }
}
