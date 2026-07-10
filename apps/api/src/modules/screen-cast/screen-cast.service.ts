import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ScreenCastMediaType,
  ScreenCastMonitor,
  ScreenCastPlaylist,
  ScreenCastPlaylistItem,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { S3Service } from '../../core/s3/s3.service';
import {
  CreateScreenCastMonitorDto,
  CreateScreenCastPlaylistDto,
  CreateScreenCastPlaylistItemDto,
  UpdateScreenCastMonitorDto,
  UpdateScreenCastPlaylistDto,
  UpdateScreenCastPlaylistItemDto,
} from './dto/screen-cast.dto';

const ONLINE_THRESHOLD_MS = 90_000;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
]);

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class ScreenCastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {}

  async uploadMedia(file: UploadedFile | undefined) {
    if (!file) {
      throw new BadRequestException('Archivo requerido');
    }

    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Formato no permitido. Usa JPG, PNG, GIF o MP4.',
      );
    }

    const maxMb = Number(
      this.config.get('SCREEN_CAST_UPLOAD_MAX_MB') ??
        this.config.get('UPLOAD_MAX_MB') ??
        50,
    );
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`El archivo supera ${maxMb} MB`);
    }

    const key = this.s3.buildScreenCastKey(file.originalname);
    const url = await this.s3.uploadFile(key, file.buffer, file.mimetype);

    let mediaType: ScreenCastMediaType = ScreenCastMediaType.image;
    if (mime === 'video/mp4') mediaType = ScreenCastMediaType.video;
    else if (mime === 'image/gif') mediaType = ScreenCastMediaType.gif;

    return { url, key, mediaType, fileName: file.originalname };
  }

  // --- Playlists ---

  listPlaylists() {
    return this.prisma.screenCastPlaylist.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { monitors: true, items: true } },
      },
    });
  }

  async getPlaylist(id: string) {
    const playlist = await this.prisma.screenCastPlaylist.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { monitors: true } },
      },
    });
    if (!playlist) throw new NotFoundException('Playlist no encontrada');
    return playlist;
  }

  createPlaylist(dto: CreateScreenCastPlaylistDto) {
    return this.prisma.screenCastPlaylist.create({
      data: {
        name: dto.name.trim(),
        activo: dto.activo ?? true,
      },
    });
  }

  async updatePlaylist(id: string, dto: UpdateScreenCastPlaylistDto) {
    await this.findPlaylist(id);
    return this.prisma.screenCastPlaylist.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async deletePlaylist(id: string) {
    await this.findPlaylist(id);
    await this.prisma.screenCastPlaylist.delete({ where: { id } });
    return { ok: true };
  }

  async createPlaylistItem(playlistId: string, dto: CreateScreenCastPlaylistItemDto) {
    await this.findPlaylist(playlistId);
    return this.prisma.screenCastPlaylistItem.create({
      data: {
        playlistId,
        mediaUrl: dto.mediaUrl.trim(),
        mediaType: dto.mediaType,
        durationMs: dto.durationMs ?? 10_000,
        sortOrder: dto.sortOrder ?? 0,
        activo: dto.activo ?? true,
      },
    });
  }

  async updatePlaylistItem(id: string, dto: UpdateScreenCastPlaylistItemDto) {
    await this.findPlaylistItem(id);
    return this.prisma.screenCastPlaylistItem.update({
      where: { id },
      data: {
        ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl.trim() } : {}),
        ...(dto.mediaType !== undefined ? { mediaType: dto.mediaType } : {}),
        ...(dto.durationMs !== undefined ? { durationMs: dto.durationMs } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
  }

  async deletePlaylistItem(id: string) {
    const item = await this.findPlaylistItem(id);
    await this.prisma.screenCastPlaylistItem.delete({ where: { id } });
    return { ok: true, playlistId: item.playlistId };
  }

  async getScreenKeysForPlaylist(playlistId: string): Promise<string[]> {
    const monitors = await this.prisma.screenCastMonitor.findMany({
      where: { playlistId },
      select: { screenKey: true },
    });
    return monitors.map((m) => m.screenKey);
  }

  // --- Monitors ---

  async listMonitors() {
    const rows = await this.prisma.screenCastMonitor.findMany({
      orderBy: { name: 'asc' },
      include: { playlist: { select: { id: true, name: true } } },
    });
    return rows.map((row) => this.toMonitorDto(row));
  }

  async getMonitor(id: string) {
    const row = await this.prisma.screenCastMonitor.findUnique({
      where: { id },
      include: { playlist: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException('Monitor no encontrado');
    return this.toMonitorDto(row);
  }

  async createMonitor(dto: CreateScreenCastMonitorDto) {
    await this.ensureUniqueScreenKey(dto.screenKey);
    if (dto.playlistId) await this.findPlaylist(dto.playlistId);
    const row = await this.prisma.screenCastMonitor.create({
      data: {
        screenKey: dto.screenKey.trim().toLowerCase(),
        name: dto.name.trim(),
        location: dto.location?.trim() || null,
        orientation: dto.orientation ?? 'LANDSCAPE',
        playlistId: dto.playlistId || null,
      },
      include: { playlist: { select: { id: true, name: true } } },
    });
    return this.toMonitorDto(row);
  }

  async updateMonitor(id: string, dto: UpdateScreenCastMonitorDto) {
    const existing = await this.findMonitor(id);
    if (dto.screenKey && dto.screenKey !== existing.screenKey) {
      await this.ensureUniqueScreenKey(dto.screenKey);
    }
    if (dto.playlistId) await this.findPlaylist(dto.playlistId);

    const row = await this.prisma.screenCastMonitor.update({
      where: { id },
      data: {
        ...(dto.screenKey !== undefined
          ? { screenKey: dto.screenKey.trim().toLowerCase() }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.location !== undefined
          ? { location: dto.location?.trim() || null }
          : {}),
        ...(dto.orientation !== undefined
          ? { orientation: dto.orientation }
          : {}),
        ...(dto.playlistId !== undefined
          ? { playlistId: dto.playlistId || null }
          : {}),
      },
      include: { playlist: { select: { id: true, name: true } } },
    });
    return this.toMonitorDto(row);
  }

  async deleteMonitor(id: string) {
    await this.findMonitor(id);
    await this.prisma.screenCastMonitor.delete({ where: { id } });
    return { ok: true };
  }

  // --- Public + heartbeat ---

  async getPublicConfig(screenKey: string) {
    const monitor = await this.prisma.screenCastMonitor.findUnique({
      where: { screenKey: screenKey.trim().toLowerCase() },
      include: {
        playlist: {
          include: {
            items: {
              where: { activo: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!monitor) throw new NotFoundException('Pantalla no encontrada');

    const playlist = monitor.playlist;
    const empty =
      !playlist ||
      !playlist.activo ||
      playlist.items.length === 0;

    return {
      screenKey: monitor.screenKey,
      name: monitor.name,
      orientation: monitor.orientation,
      empty,
      playlistId: playlist?.id ?? null,
      playlistName: playlist?.name ?? null,
      items: empty
        ? []
        : playlist!.items.map((item) => ({
            mediaUrl: item.mediaUrl,
            mediaType: item.mediaType as ScreenCastMediaType,
            durationMs: item.durationMs,
          })),
    };
  }

  async recordHeartbeat(screenKey: string) {
    const key = screenKey.trim().toLowerCase();
    const result = await this.prisma.screenCastMonitor.updateMany({
      where: { screenKey: key },
      data: { lastSeenAt: new Date() },
    });
    return { ok: result.count > 0 };
  }

  // --- helpers ---

  private toMonitorDto(
    row: ScreenCastMonitor & {
      playlist?: { id: string; name: string } | null;
    },
  ) {
    const online =
      !!row.lastSeenAt &&
      Date.now() - row.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS;
    return {
      id: row.id,
      screenKey: row.screenKey,
      name: row.name,
      location: row.location,
      orientation: row.orientation,
      playlistId: row.playlistId,
      playlistName: row.playlist?.name ?? null,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      online,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async findPlaylist(id: string): Promise<ScreenCastPlaylist> {
    const row = await this.prisma.screenCastPlaylist.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Playlist no encontrada');
    return row;
  }

  private async findPlaylistItem(id: string): Promise<ScreenCastPlaylistItem> {
    const row = await this.prisma.screenCastPlaylistItem.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Ítem no encontrado');
    return row;
  }

  private async findMonitor(id: string): Promise<ScreenCastMonitor> {
    const row = await this.prisma.screenCastMonitor.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Monitor no encontrado');
    return row;
  }

  private async ensureUniqueScreenKey(screenKey: string) {
    const existing = await this.prisma.screenCastMonitor.findUnique({
      where: { screenKey: screenKey.trim().toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Ya existe un monitor con ese ID');
    }
  }
}
