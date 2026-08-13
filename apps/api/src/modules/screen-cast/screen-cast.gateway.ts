import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Public } from '../../core/guards/public.decorator';
import { ScreenCastService } from './screen-cast.service';

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
  // Detect dead clients faster (laptop off / network drop).
  pingInterval: 10_000,
  pingTimeout: 10_000,
})
export class ScreenCastGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ScreenCastGateway.name);
  /** Live player sockets per screenKey (excludes preview tabs). */
  private readonly connections = new Map<string, Set<string>>();
  /** Last playback status reported by each screen. */
  private readonly playback = new Map<
    string,
    { index: number; total: number; lastError: string | null; updatedAt: number }
  >();

  @WebSocketServer()
  server!: Server;

  constructor(private readonly service: ScreenCastService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const key = client.data.screenKey as string | undefined;
    if (key) {
      this.removeConnection(key, client.id);
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
    await this.service.recordHeartbeat(key);
    return { ok: true, screenKey: key };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { screenKey?: string } | string,
  ) {
    const screenKey =
      typeof body === 'string' ? body : body?.screenKey?.trim() ?? '';
    if (!screenKey) {
      return { ok: false };
    }
    const key = screenKey.toLowerCase();
    if (!client.data.screenKey) {
      client.data.screenKey = key;
      this.addConnection(key, client.id);
      await client.join(this.room(key));
    }
    const result = await this.service.recordHeartbeat(key);
    return result;
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
    // Stale after 2 minutes without updates.
    if (Date.now() - row.updatedAt > 120_000) return null;
    return {
      index: row.index,
      total: row.total,
      lastError: row.lastError,
    };
  }

  notifyPlaylistUpdated(screenKeys: string[]) {
    for (const key of screenKeys) {
      this.server.to(this.room(key)).emit('playlist:updated');
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
    }
  }

  private room(screenKey: string) {
    return `screen:${screenKey}`;
  }
}
