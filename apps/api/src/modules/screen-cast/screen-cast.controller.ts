import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AppModule } from '@prisma/client';
import { Public } from '../../core/guards/public.decorator';
import { RequireModule } from '../../core/guards/module.decorator';
import { S3ManagerService } from '../s3-manager/s3-manager.service';
import {
  CreateScreenCastMonitorDto,
  CreateScreenCastPlaylistDto,
  CreateScreenCastPlaylistItemDto,
  UpdateScreenCastMonitorDto,
  UpdateScreenCastPlaylistDto,
  UpdateScreenCastPlaylistItemDto,
} from './dto/screen-cast.dto';
import { ScreenCastGateway } from './screen-cast.gateway';
import { ScreenCastService } from './screen-cast.service';

@Controller('screen-cast')
export class ScreenCastController {
  constructor(
    private readonly service: ScreenCastService,
    private readonly gateway: ScreenCastGateway,
    private readonly s3Manager: S3ManagerService,
  ) {}

  // --- Public ---

  @Public()
  @Get('screens/:screenKey/config')
  getPublicConfig(@Param('screenKey') screenKey: string) {
    return this.service.getPublicConfig(screenKey);
  }

  // --- Playlists ---

  @Get('playlists')
  @RequireModule(AppModule.screen_cast)
  listPlaylists() {
    return this.service.listPlaylists();
  }

  @Get('playlists/:id')
  @RequireModule(AppModule.screen_cast)
  getPlaylist(@Param('id') id: string) {
    return this.service.getPlaylist(id);
  }

  @Post('playlists')
  @RequireModule(AppModule.screen_cast)
  createPlaylist(@Body() body: CreateScreenCastPlaylistDto) {
    return this.service.createPlaylist(body);
  }

  @Patch('playlists/:id')
  @RequireModule(AppModule.screen_cast)
  async updatePlaylist(
    @Param('id') id: string,
    @Body() body: UpdateScreenCastPlaylistDto,
  ) {
    const playlist = await this.service.updatePlaylist(id, body);
    const keys = await this.service.getScreenKeysForPlaylist(id);
    this.gateway.notifyPlaylistUpdated(keys);
    return playlist;
  }

  @Delete('playlists/:id')
  @RequireModule(AppModule.screen_cast)
  async deletePlaylist(@Param('id') id: string) {
    const keys = await this.service.getScreenKeysForPlaylist(id);
    const result = await this.service.deletePlaylist(id);
    this.gateway.notifyPlaylistUpdated(keys);
    return result;
  }

  @Post('playlists/:id/items')
  @RequireModule(AppModule.screen_cast)
  async createItem(
    @Param('id') playlistId: string,
    @Body() body: CreateScreenCastPlaylistItemDto,
  ) {
    const item = await this.service.createPlaylistItem(playlistId, body);
    const keys = await this.service.getScreenKeysForPlaylist(playlistId);
    this.gateway.notifyPlaylistUpdated(keys);
    return item;
  }

  @Patch('items/:id')
  @RequireModule(AppModule.screen_cast)
  async updateItem(
    @Param('id') id: string,
    @Body() body: UpdateScreenCastPlaylistItemDto,
  ) {
    const item = await this.service.updatePlaylistItem(id, body);
    const keys = await this.service.getScreenKeysForPlaylist(item.playlistId);
    this.gateway.notifyPlaylistUpdated(keys);
    return item;
  }

  @Delete('items/:id')
  @RequireModule(AppModule.screen_cast)
  async deleteItem(@Param('id') id: string) {
    const result = await this.service.deletePlaylistItem(id);
    const keys = await this.service.getScreenKeysForPlaylist(result.playlistId);
    this.gateway.notifyPlaylistUpdated(keys);
    return { ok: true };
  }

  // --- Monitors ---

  @Get('monitors')
  @RequireModule(AppModule.screen_cast)
  listMonitors() {
    return this.service.listMonitors();
  }

  @Get('monitors/:id')
  @RequireModule(AppModule.screen_cast)
  getMonitor(@Param('id') id: string) {
    return this.service.getMonitor(id);
  }

  @Post('monitors')
  @RequireModule(AppModule.screen_cast)
  async createMonitor(@Body() body: CreateScreenCastMonitorDto) {
    const monitor = await this.service.createMonitor(body);
    if (monitor.screenKey) {
      this.gateway.notifyPlaylistUpdated([monitor.screenKey]);
    }
    return monitor;
  }

  @Patch('monitors/:id')
  @RequireModule(AppModule.screen_cast)
  async updateMonitor(
    @Param('id') id: string,
    @Body() body: UpdateScreenCastMonitorDto,
  ) {
    const before = await this.service.getMonitor(id);
    const monitor = await this.service.updateMonitor(id, body);
    const keys = new Set<string>([before.screenKey, monitor.screenKey]);
    this.gateway.notifyPlaylistUpdated([...keys]);
    return monitor;
  }

  @Delete('monitors/:id')
  @RequireModule(AppModule.screen_cast)
  deleteMonitor(@Param('id') id: string) {
    return this.service.deleteMonitor(id);
  }

  // --- S3 picker (reuses S3 manager, gated by screen_cast) ---

  @Get('s3/buckets')
  @RequireModule(AppModule.screen_cast)
  listS3Buckets() {
    return this.s3Manager.listBuckets();
  }

  @Get('s3/buckets/:bucket/objects')
  @RequireModule(AppModule.screen_cast)
  listS3Objects(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix?: string,
    @Query('continuationToken') continuationToken?: string,
  ) {
    return this.s3Manager.listObjects(bucket, prefix ?? '', continuationToken);
  }

  @Get('s3/buckets/:bucket/public-url')
  @RequireModule(AppModule.screen_cast)
  getS3PublicUrl(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
  ) {
    return this.s3Manager.getPublicUrl(bucket, key);
  }
}
