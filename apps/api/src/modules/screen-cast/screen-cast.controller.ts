import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule } from '@prisma/client';
import type { Request, Response } from 'express';
import { Public } from '../../core/guards/public.decorator';
import { RequireModule } from '../../core/guards/module.decorator';
import { S3ManagerService } from '../s3-manager/s3-manager.service';
import {
  CreateScreenCastMonitorDto,
  CreateScreenCastPlaylistDto,
  CreateScreenCastPlaylistItemDto,
  CreateScreenCastScheduleOverrideDto,
  UpdateScreenCastMonitorDto,
  UpdateScreenCastPlaylistDto,
  UpdateScreenCastPlaylistItemDto,
  UpdateScreenCastScheduleOverrideDto,
} from './dto/screen-cast.dto';
import { ScreenCastGateway } from './screen-cast.gateway';
import { ScreenCastService } from './screen-cast.service';

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

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

  /** Same-origin media for kiosk cache/playback (S3 screen-cast keys only). */
  @Public()
  @Get('media')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async proxyMedia(
    @Query('src') src: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const range =
      typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const media = await this.service.getPublicMedia(src, range);

    res.setHeader('Accept-Ranges', 'bytes');
    if (media.etag) res.setHeader('ETag', media.etag);
    if (media.lastModified) res.setHeader('Last-Modified', media.lastModified);
    if (media.contentRange) {
      res.status(206);
      res.setHeader('Content-Range', media.contentRange);
    }

    return new StreamableFile(media.stream, {
      type: media.contentType,
      ...(media.contentLength ? { length: media.contentLength } : {}),
    });
  }

  // --- Playlists ---

  @Get('playlists')
  @RequireModule(AppModule.screen_cast)
  async listPlaylists() {
    const playlists = await this.service.listPlaylists();
    return playlists.map((playlist) => ({
      ...playlist,
      monitors: playlist.monitors.map((monitor) => ({
        ...monitor,
        online: this.gateway.isScreenConnected(monitor.screenKey),
      })),
    }));
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
    // Capture keys before deactivate clears monitor assignments.
    const keysBefore = await this.service.getScreenKeysForPlaylist(id);
    const playlist = await this.service.updatePlaylist(id, body);
    const keysAfter = await this.service.getScreenKeysForPlaylist(id);
    const keys = [...new Set([...keysBefore, ...keysAfter])];
    await this.gateway.restartSync(keys, { reason: 'playlist:update' });
    return playlist;
  }

  @Post('playlists/:id/duplicate')
  @RequireModule(AppModule.screen_cast)
  duplicatePlaylist(@Param('id') id: string) {
    return this.service.duplicatePlaylist(id);
  }

  @Delete('playlists/:id')
  @RequireModule(AppModule.screen_cast)
  async deletePlaylist(@Param('id') id: string) {
    const keys = await this.service.getScreenKeysForPlaylist(id);
    const result = await this.service.deletePlaylist(id);
    await this.gateway.restartSync(keys, { reason: 'playlist:delete' });
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
    await this.gateway.restartSync(keys, { reason: 'item:create' });
    return item;
  }

  @Post('playlists/:id/items/reorder')
  @RequireModule(AppModule.screen_cast)
  async reorderItems(
    @Param('id') playlistId: string,
    @Body() body: { orderedIds?: string[] },
  ) {
    const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : [];
    const items = await this.service.reorderPlaylistItems(
      playlistId,
      orderedIds,
    );
    const keys = await this.service.getScreenKeysForPlaylist(playlistId);
    await this.gateway.restartSync(keys, { reason: 'item:reorder' });
    return items;
  }

  @Post('items/:id/duplicate')
  @RequireModule(AppModule.screen_cast)
  async duplicateItem(@Param('id') id: string) {
    const item = await this.service.duplicatePlaylistItem(id);
    const keys = await this.service.getScreenKeysForPlaylist(item.playlistId);
    await this.gateway.restartSync(keys, { reason: 'item:duplicate' });
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
    await this.gateway.restartSync(keys, { reason: 'item:update' });
    return item;
  }

  @Delete('items/:id')
  @RequireModule(AppModule.screen_cast)
  async deleteItem(@Param('id') id: string) {
    const result = await this.service.deletePlaylistItem(id);
    const keys = await this.service.getScreenKeysForPlaylist(result.playlistId);
    await this.gateway.restartSync(keys, { reason: 'item:delete' });
    return { ok: true };
  }

  // --- Monitors ---

  @Get('monitors')
  @RequireModule(AppModule.screen_cast)
  async listMonitors() {
    const monitors = await this.service.listMonitors();
    return monitors.map((m) => this.withLivePresence(m));
  }

  /**
   * Manual "sincronizar todo". Restarting the wall is only worth the black
   * frames when the content changed; otherwise the screens are re-anchored to
   * the clock they already share. `force=1` still allows a hard restart.
   */
  @Post('monitors/sync')
  @RequireModule(AppModule.screen_cast)
  async syncAllMonitors(@Query('force') force?: string) {
    const keys = await this.service.getAllScreenKeys();
    await this.gateway.restartSync(keys, {
      force: force === '1' || force === 'true',
      catchUpWhenUnchanged: true,
      reason: 'admin:sync-all',
    });
    return { ok: true, notified: keys.length };
  }

  @Post('monitors/:id/sync')
  @RequireModule(AppModule.screen_cast)
  async syncMonitor(@Param('id') id: string) {
    const monitor = await this.service.getMonitor(id);
    await this.gateway.catchUpScreen(monitor.screenKey);
    return { ok: true, notified: 1, screenKey: monitor.screenKey };
  }

  @Get('monitors/:id')
  @RequireModule(AppModule.screen_cast)
  async getMonitor(@Param('id') id: string) {
    const monitor = await this.service.getMonitor(id);
    return this.withLivePresence(monitor);
  }

  @Post('monitors')
  @RequireModule(AppModule.screen_cast)
  async createMonitor(@Body() body: CreateScreenCastMonitorDto) {
    const monitor = await this.service.createMonitor(body);
    if (monitor.screenKey) {
      await this.gateway.catchUpScreen(monitor.screenKey);
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
    for (const key of keys) {
      await this.gateway.catchUpScreen(key);
    }
    return monitor;
  }

  @Delete('monitors/:id')
  @RequireModule(AppModule.screen_cast)
  deleteMonitor(@Param('id') id: string) {
    return this.service.deleteMonitor(id);
  }

  // --- Schedule overrides ---

  @Get('schedule-overrides')
  @RequireModule(AppModule.screen_cast)
  listScheduleOverrides(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from?.trim() || !to?.trim()) {
      throw new BadRequestException('from y to son requeridos');
    }
    return this.service.listScheduleOverrides(from, to);
  }

  @Post('schedule-overrides')
  @RequireModule(AppModule.screen_cast)
  async createScheduleOverride(
    @Body() body: CreateScreenCastScheduleOverrideDto,
  ) {
    const created = await this.service.createScheduleOverride(body);
    if (
      this.service.scheduleOverrideTouchesNow(created.startsAt, created.endsAt)
    ) {
      await this.gateway.applyScheduleTransition(created.screenKey);
    }
    return created;
  }

  @Patch('schedule-overrides/:id')
  @RequireModule(AppModule.screen_cast)
  async updateScheduleOverride(
    @Param('id') id: string,
    @Body() body: UpdateScreenCastScheduleOverrideDto,
  ) {
    const previous = await this.service.getScheduleOverride(id);
    const updated = await this.service.updateScheduleOverride(id, body);
    const keys = new Set<string>([previous.screenKey, updated.screenKey]);
    const touchesNow =
      this.service.scheduleOverrideTouchesNow(
        updated.startsAt,
        updated.endsAt,
      ) ||
      this.service.scheduleOverrideTouchesNow(
        previous.startsAt,
        previous.endsAt,
      );
    if (touchesNow) {
      for (const key of keys) {
        await this.gateway.applyScheduleTransition(key);
      }
    }
    return updated;
  }

  @Delete('schedule-overrides/:id')
  @RequireModule(AppModule.screen_cast)
  async deleteScheduleOverride(@Param('id') id: string) {
    const result = await this.service.deleteScheduleOverride(id);
    if (
      this.service.scheduleOverrideTouchesNow(result.startsAt, result.endsAt)
    ) {
      await this.gateway.applyScheduleTransition(result.screenKey);
    }
    return { ok: true };
  }

  // --- S3 picker + upload (gated by screen_cast) ---

  @Post('s3/upload')
  @RequireModule(AppModule.screen_cast)
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(@UploadedFile() file: UploadedMediaFile) {
    return this.service.uploadMedia(file);
  }

  @Get('s3/config')
  @RequireModule(AppModule.screen_cast)
  getS3PickerConfig() {
    return this.s3Manager.getScreenCastPickerConfig();
  }

  @Get('s3/buckets')
  @RequireModule(AppModule.screen_cast)
  listS3Buckets() {
    return this.s3Manager.listScreenCastBuckets();
  }

  @Get('s3/buckets/:bucket/objects')
  @RequireModule(AppModule.screen_cast)
  listS3Objects(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix?: string,
    @Query('continuationToken') continuationToken?: string,
  ) {
    return this.s3Manager.listScreenCastObjects(
      bucket,
      prefix ?? '',
      continuationToken,
    );
  }

  @Get('s3/buckets/:bucket/public-url')
  @RequireModule(AppModule.screen_cast)
  getS3PublicUrl(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
  ) {
    return this.s3Manager.getScreenCastPublicUrl(bucket, key);
  }

  private withLivePresence<
    T extends { screenKey: string; online: boolean },
  >(monitor: T): T & {
    playbackIndex: number | null;
    playbackTotal: number | null;
    lastError: string | null;
  } {
    const playback = this.gateway.getPlaybackStatus(monitor.screenKey);
    return {
      ...monitor,
      online: this.gateway.isScreenConnected(monitor.screenKey),
      playbackIndex: playback?.index ?? null,
      playbackTotal: playback?.total ?? null,
      lastError: playback?.lastError ?? null,
    };
  }
}
