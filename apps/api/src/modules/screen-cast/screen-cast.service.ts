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
import { createHash } from 'crypto';
import sharp from 'sharp';
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
import {
  convertMovBufferToMp4,
  isMovUpload,
  probeVideoDurationMs,
} from './screen-cast-video.util';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/x-quicktime',
]);

/** Still images (not GIF) are normalized to JPEG for TV decode + size. */
const OPTIMIZE_TO_JPEG = new Set(['image/jpeg', 'image/png']);

const JPEG_QUALITY = 90;
/** Max edge so 1080×1920 portrait and 1920×1080 landscape both fit. */
const MAX_EDGE = 1920;

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

function toJpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.jpg`;
}

function toMp4FileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'video';
  return `${base}.mp4`;
}

function isAllowedUpload(mime: string, fileName: string): boolean {
  if (ALLOWED_MIME.has(mime)) return true;
  // iPhone sometimes sends odd MIME; trust .mov extension.
  return isMovUpload(mime, fileName);
}

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
    const originalName = file.originalname || 'upload';
    if (!isAllowedUpload(mime, originalName)) {
      throw new BadRequestException(
        'Formato no permitido. Usa JPG, PNG, GIF, MP4 o MOV (iPhone).',
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

    const originalBytes = file.size;
    let uploadBuffer = file.buffer;
    let uploadMime = mime;
    let uploadName = originalName;
    let width: number | null = null;
    let height: number | null = null;

    if (OPTIMIZE_TO_JPEG.has(mime)) {
      try {
        uploadBuffer = await sharp(file.buffer)
          .rotate()
          .resize({
            width: MAX_EDGE,
            height: MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .flatten({ background: { r: 0, g: 0, b: 0 } })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        const outMeta = await sharp(uploadBuffer).metadata();
        width = outMeta.width ?? null;
        height = outMeta.height ?? null;
        uploadMime = 'image/jpeg';
        uploadName = toJpegFileName(originalName);
      } catch {
        throw new BadRequestException(
          'No se pudo procesar la imagen. Prueba otro JPG/PNG.',
        );
      }
    } else if (isMovUpload(mime, originalName)) {
      try {
        uploadBuffer = await convertMovBufferToMp4(file.buffer);
        uploadMime = 'video/mp4';
        uploadName = toMp4FileName(originalName);
      } catch (e) {
        const detail = e instanceof Error ? e.message : 'error desconocido';
        throw new BadRequestException(
          `No se pudo convertir el MOV a MP4. ${detail}`,
        );
      }
    }

    const key = this.s3.buildScreenCastKey(uploadName);
    const url = await this.s3.uploadFile(key, uploadBuffer, uploadMime);

    let mediaType: ScreenCastMediaType = ScreenCastMediaType.image;
    if (uploadMime === 'video/mp4' || mime === 'video/mp4') {
      mediaType = ScreenCastMediaType.video;
    } else if (mime === 'image/gif') {
      mediaType = ScreenCastMediaType.gif;
    }

    let durationMs: number | null = null;
    if (mediaType === ScreenCastMediaType.video) {
      durationMs = await probeVideoDurationMs(uploadBuffer);
    }

    return {
      url,
      key,
      mediaType,
      fileName: uploadName,
      originalBytes,
      optimizedBytes: uploadBuffer.length,
      width,
      height,
      durationMs,
    };
  }

  /**
   * Stream a screen-cast S3 object through the API so kiosk players can
   * cache/play it same-origin (S3 bucket CORS is not required).
   *
   * The body is piped straight from S3: buffering a 20 MB clip in memory for
   * every screen stalls the event loop long enough for every WebSocket to hit
   * its pong deadline at once.
   */
  async getPublicMedia(src: string | undefined, range?: string) {
    const raw = (src || '').trim();
    if (!raw) throw new BadRequestException('src requerido');
    const key = this.parseAllowedScreenCastKey(raw);
    return this.s3.getFileStream(key, range);
  }

  private parseAllowedScreenCastKey(raw: string): string {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new BadRequestException('URL de media inválida');
    }
    const host = url.hostname.toLowerCase();
    const bucket = this.config.getOrThrow<string>('AWS_S3_BUCKET').toLowerCase();
    const allowedHost =
      host.endsWith('.amazonaws.com') || host.endsWith('.cloudfront.net');
    if (!allowedHost) {
      throw new BadRequestException('Origen de media no permitido');
    }

    let key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (host === 's3.amazonaws.com' || /^s3[.-]/.test(host)) {
      const [pathBucket, ...rest] = key.split('/');
      if (pathBucket.toLowerCase() !== bucket) {
        throw new BadRequestException('Bucket no permitido');
      }
      key = rest.join('/');
    } else if (
      !host.startsWith(`${bucket}.`) &&
      !host.endsWith('.cloudfront.net')
    ) {
      throw new BadRequestException('Bucket no permitido');
    }

    if (!key.startsWith('screen-cast/') || key.includes('..')) {
      throw new BadRequestException('Solo media de screen-cast');
    }
    return key;
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

  async duplicatePlaylist(id: string) {
    const source = await this.prisma.screenCastPlaylist.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!source) throw new NotFoundException('Playlist no encontrada');

    return this.prisma.screenCastPlaylist.create({
      data: {
        name: `${source.name} (copia)`,
        activo: source.activo,
        items: {
          create: source.items.map((item) => ({
            mediaUrl: item.mediaUrl,
            mediaType: item.mediaType,
            durationMs: item.durationMs,
            sortOrder: item.sortOrder,
            activo: item.activo,
          })),
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { monitors: true, items: true } },
      },
    });
  }

  async createPlaylistItem(playlistId: string, dto: CreateScreenCastPlaylistItemDto) {
    await this.findPlaylist(playlistId);
    const mediaUrl = dto.mediaUrl.trim();
    const durationMs = await this.resolveItemDurationMs(
      mediaUrl,
      dto.mediaType,
      dto.durationMs,
    );
    return this.prisma.screenCastPlaylistItem.create({
      data: {
        playlistId,
        mediaUrl,
        mediaType: dto.mediaType,
        durationMs,
        sortOrder: dto.sortOrder ?? 0,
        activo: dto.activo ?? true,
      },
    });
  }

  async updatePlaylistItem(id: string, dto: UpdateScreenCastPlaylistItemDto) {
    const existing = await this.findPlaylistItem(id);
    const mediaUrl =
      dto.mediaUrl !== undefined ? dto.mediaUrl.trim() : existing.mediaUrl;
    const mediaType = dto.mediaType ?? existing.mediaType;
    const durationMs = await this.resolveItemDurationMs(
      mediaUrl,
      mediaType,
      dto.durationMs ?? existing.durationMs,
    );
    return this.prisma.screenCastPlaylistItem.update({
      where: { id },
      data: {
        ...(dto.mediaUrl !== undefined ? { mediaUrl } : {}),
        ...(dto.mediaType !== undefined ? { mediaType: dto.mediaType } : {}),
        durationMs,
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

  async duplicatePlaylistItem(id: string) {
    const item = await this.findPlaylistItem(id);
    const maxOrder = await this.prisma.screenCastPlaylistItem.aggregate({
      where: { playlistId: item.playlistId },
      _max: { sortOrder: true },
    });
    return this.prisma.screenCastPlaylistItem.create({
      data: {
        playlistId: item.playlistId,
        mediaUrl: item.mediaUrl,
        mediaType: item.mediaType,
        durationMs: item.durationMs,
        sortOrder: (maxOrder._max.sortOrder ?? item.sortOrder) + 1,
        activo: item.activo,
      },
    });
  }

  async reorderPlaylistItems(
    playlistId: string,
    orderedIds: string[],
  ): Promise<ScreenCastPlaylistItem[]> {
    await this.findPlaylist(playlistId);
    const items = await this.prisma.screenCastPlaylistItem.findMany({
      where: { playlistId },
    });
    if (items.length !== orderedIds.length) {
      throw new BadRequestException('La lista de orden no coincide');
    }
    const idSet = new Set(items.map((i) => i.id));
    for (const id of orderedIds) {
      if (!idSet.has(id)) {
        throw new BadRequestException('Ítem no pertenece a la playlist');
      }
    }
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.screenCastPlaylistItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.prisma.screenCastPlaylistItem.findMany({
      where: { playlistId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getScreenKeysForPlaylist(playlistId: string): Promise<string[]> {
    const monitors = await this.prisma.screenCastMonitor.findMany({
      where: { playlistId },
      select: { screenKey: true },
    });
    return monitors.map((m) => m.screenKey);
  }

  /**
   * Fingerprint of what a playlist actually plays. The gateway compares it
   * against the running clock so a save that changed nothing visible (a rename,
   * a repeated "sincronizar") does not tear the wall down.
   */
  async getPlaylistSignature(playlistId: string): Promise<string | null> {
    const playlist = await this.prisma.screenCastPlaylist.findUnique({
      where: { id: playlistId },
      select: {
        activo: true,
        items: {
          where: { activo: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, mediaUrl: true, mediaType: true, durationMs: true },
        },
      },
    });
    if (!playlist) return null;
    const items = playlist.items
      .map(
        (item) =>
          `${item.id}:${item.mediaType}:${item.durationMs}:${item.mediaUrl}`,
      )
      .join('|');
    return createHash('sha1')
      .update(`${playlist.activo ? 'on' : 'off'}#${items}`)
      .digest('hex');
  }

  async getAllScreenKeys(): Promise<string[]> {
    const monitors = await this.prisma.screenCastMonitor.findMany({
      select: { screenKey: true },
    });
    return monitors.map((m) => m.screenKey);
  }

  async getMonitorPlaylistId(screenKey: string): Promise<string | null> {
    const row = await this.prisma.screenCastMonitor.findUnique({
      where: { screenKey: screenKey.trim().toLowerCase() },
      select: { playlistId: true },
    });
    return row?.playlistId ?? null;
  }

  async getScreenPlaylistMap(
    screenKeys: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    for (const raw of screenKeys) {
      const key = raw.trim().toLowerCase();
      if (key) map.set(key, null);
    }
    if (map.size === 0) return map;
    const rows = await this.prisma.screenCastMonitor.findMany({
      where: { screenKey: { in: [...map.keys()] } },
      select: { screenKey: true, playlistId: true },
    });
    for (const row of rows) {
      map.set(row.screenKey, row.playlistId);
    }
    return map;
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
    return {
      id: row.id,
      screenKey: row.screenKey,
      name: row.name,
      location: row.location,
      orientation: row.orientation,
      playlistId: row.playlistId,
      playlistName: row.playlist?.name ?? null,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      // Live Online/Offline comes from WebSocket presence in the controller.
      online: false,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async resolveItemDurationMs(
    mediaUrl: string,
    mediaType: ScreenCastMediaType,
    fallback?: number,
  ): Promise<number> {
    if (mediaType !== ScreenCastMediaType.video) {
      return fallback ?? 10_000;
    }
    const probed = await probeVideoDurationMs(mediaUrl.trim());
    if (probed && probed > 0) return probed;
    return fallback ?? 10_000;
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
