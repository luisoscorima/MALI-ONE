import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
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
  transports: ['websocket', 'polling'],
  allowEIO3: true,
})
export class ScreenCastGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ScreenCastGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly service: ScreenCastService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`WS connected: ${client.id}`);
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
    await client.join(this.room(key));
    await this.service.recordHeartbeat(key);
    return { ok: true, screenKey: key };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() _client: Socket,
    @MessageBody() body: { screenKey?: string } | string,
  ) {
    const screenKey =
      typeof body === 'string' ? body : body?.screenKey?.trim() ?? '';
    if (!screenKey) {
      return { ok: false };
    }
    const result = await this.service.recordHeartbeat(screenKey);
    return result;
  }

  notifyPlaylistUpdated(screenKeys: string[]) {
    for (const key of screenKeys) {
      this.server.to(this.room(key)).emit('playlist:updated');
    }
  }

  private room(screenKey: string) {
    return `screen:${screenKey}`;
  }
}
