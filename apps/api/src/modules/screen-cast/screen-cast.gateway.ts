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

@Public()
@WebSocketGateway({
  namespace: '/screen-cast',
  cors: { origin: true, credentials: true },
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
