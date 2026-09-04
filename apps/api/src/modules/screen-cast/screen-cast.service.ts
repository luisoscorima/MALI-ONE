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
  CreateScreenCastScheduleOverrideDto,
  UpdateScreenCastMonitorDto,
  UpdateScreenCastPlaylistDto,
  UpdateScreenCastPlaylistItemDto,
  UpdateScreenCastScheduleOverrideDto,
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

  async listPlaylists() {
    const rows = await this.prisma.screenCastPlaylist.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { monitors: true, items: true } },
        monitors: {
          select: { id: true, name: true, screenKey: true, photoUrl: true },
          orderBy: { name: 'asc' },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
          take: 4,
          select: { mediaUrl: true, mediaType: true },
        },
      },
    });
    return rows.map(({ items, ...playlist }) => ({
      ...playlist,
      previewItems: items,
    }));
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
    if (dto.activo === false) {
      const blocking = await this.prisma.screenCastScheduleOverride.count({
        where: { playlistId: id, endsAt: { gt: new Date() } },
      });
      if (blocking > 0) {
        throw new BadRequestException(
          'No se puede desactivar: hay programación futura o activa con esta playlist',
        );
      }
      await this.prisma.screenCastMonitor.updateMany({
        where: { playlistId: id },
        data: { playlistId: null },
      });
    }
    return this.prisma.screenCastPlaylist.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        monitors: {
          select: { id: true, name: true, screenKey: true, photoUrl: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { monitors: true, items: true } },
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
    const at = new Date();
    const monitors = await this.prisma.screenCastMonitor.findMany({
      select: { id: true, screenKey: true, playlistId: true },
    });
    const overrideByMonitor = await this.activeOverridePlaylistByMonitorId(at);
    return monitors
      .filter(
        (m) => (overrideByMonitor.get(m.id) ?? m.playlistId) === playlistId,
      )
      .map((m) => m.screenKey);
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

  async listMonitorEffectivePlaylistIds(
    at = new Date(),
  ): Promise<Array<{ screenKey: string; playlistId: string | null }>> {
    const monitors = await this.prisma.screenCastMonitor.findMany({
      select: { id: true, screenKey: true, playlistId: true },
    });
    const overrideByMonitor = await this.activeOverridePlaylistByMonitorId(at);
    return monitors.map((m) => ({
      screenKey: m.screenKey,
      playlistId: overrideByMonitor.get(m.id) ?? m.playlistId,
    }));
  }

  async getMonitorPlaylistId(screenKey: string): Promise<string | null> {
    const row = await this.prisma.screenCastMonitor.findUnique({
      where: { screenKey: screenKey.trim().toLowerCase() },
      select: { id: true, playlistId: true },
    });
    if (!row) return null;
    return this.resolveEffectivePlaylistIdForMonitor(row, new Date());
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
    const at = new Date();
    const rows = await this.prisma.screenCastMonitor.findMany({
      where: { screenKey: { in: [...map.keys()] } },
      select: { id: true, screenKey: true, playlistId: true },
    });
    const overrideByMonitor = await this.activeOverridePlaylistByMonitorId(at);
    for (const row of rows) {
      map.set(
        row.screenKey,
        overrideByMonitor.get(row.id) ?? row.playlistId,
      );
    }
    return map;
  }

  // --- Monitors ---

  async listMonitors() {
    const at = new Date();
    const rows = await this.prisma.screenCastMonitor.findMany({
      orderBy: { name: 'asc' },
      include: { playlist: this.monitorPlaylistInclude },
    });
    const activeByMonitor = await this.activeOverrideDetailsByMonitorId(at);
    return rows.map((row) =>
      this.toMonitorDto(row, activeByMonitor.get(row.id) ?? null),
    );
  }

  async getMonitor(id: string) {
    const row = await this.prisma.screenCastMonitor.findUnique({
      where: { id },
      include: { playlist: this.monitorPlaylistInclude },
    });
    if (!row) throw new NotFoundException('Monitor no encontrado');
    const active = await this.activeOverrideDetailsByMonitorId(new Date());
    return this.toMonitorDto(row, active.get(row.id) ?? null);
  }

  async createMonitor(dto: CreateScreenCastMonitorDto) {
    await this.ensureUniqueScreenKey(dto.screenKey);
    if (dto.playlistId) await this.assertAssignablePlaylist(dto.playlistId);
    const row = await this.prisma.screenCastMonitor.create({
      data: {
        screenKey: dto.screenKey.trim().toLowerCase(),
        name: dto.name.trim(),
        location: dto.location?.trim() || null,
        photoUrl: dto.photoUrl?.trim() || null,
        orientation: dto.orientation ?? 'LANDSCAPE',
        playlistId: dto.playlistId || null,
      },
      include: { playlist: this.monitorPlaylistInclude },
    });
    return this.toMonitorDto(row, null);
  }

  async updateMonitor(id: string, dto: UpdateScreenCastMonitorDto) {
    const existing = await this.findMonitor(id);
    if (dto.screenKey && dto.screenKey !== existing.screenKey) {
      await this.ensureUniqueScreenKey(dto.screenKey);
    }
    if (dto.playlistId) await this.assertAssignablePlaylist(dto.playlistId);
    if (dto.playlistId !== undefined && !dto.playlistId) {
      await this.assertMonitorHasNoFutureOverrides(id);
    }

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
        ...(dto.photoUrl !== undefined
          ? { photoUrl: dto.photoUrl?.trim() || null }
          : {}),
        ...(dto.orientation !== undefined
          ? { orientation: dto.orientation }
          : {}),
        ...(dto.playlistId !== undefined
          ? { playlistId: dto.playlistId || null }
          : {}),
      },
      include: { playlist: this.monitorPlaylistInclude },
    });
    const active = await this.activeOverrideDetailsByMonitorId(new Date());
    return this.toMonitorDto(row, active.get(row.id) ?? null);
  }

  async deleteMonitor(id: string) {
    await this.findMonitor(id);
    await this.prisma.screenCastMonitor.delete({ where: { id } });
    return { ok: true };
  }

  // --- Schedule overrides ---

  async listScheduleOverrides(fromIso: string, toIso: string) {
    const from = this.parseInstant(fromIso, 'from');
    const to = this.parseInstant(toIso, 'to');
    if (!(to > from)) {
      throw new BadRequestException('to debe ser posterior a from');
    }
    const rows = await this.prisma.screenCastScheduleOverride.findMany({
      where: {
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      include: {
        monitor: { select: { id: true, name: true, screenKey: true } },
        playlist: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => this.toScheduleOverrideDto(row));
  }

  async createScheduleOverride(dto: CreateScreenCastScheduleOverrideDto) {
    const startsAt = this.parseInstant(dto.startsAt, 'startsAt');
    const endsAt = this.parseInstant(dto.endsAt, 'endsAt');
    await this.assertValidOverrideWindow({
      monitorId: dto.monitorId,
      playlistId: dto.playlistId,
      startsAt,
      endsAt,
    });
    const row = await this.prisma.screenCastScheduleOverride.create({
      data: {
        monitorId: dto.monitorId,
        playlistId: dto.playlistId,
        startsAt,
        endsAt,
      },
      include: {
        monitor: { select: { id: true, name: true, screenKey: true } },
        playlist: { select: { id: true, name: true } },
      },
    });
    return this.toScheduleOverrideDto(row);
  }

  async updateScheduleOverride(
    id: string,
    dto: UpdateScreenCastScheduleOverrideDto,
  ) {
    const existing = await this.findScheduleOverride(id);
    const monitorId = dto.monitorId ?? existing.monitorId;
    const playlistId = dto.playlistId ?? existing.playlistId;
    const startsAt = dto.startsAt
      ? this.parseInstant(dto.startsAt, 'startsAt')
      : existing.startsAt;
    const endsAt = dto.endsAt
      ? this.parseInstant(dto.endsAt, 'endsAt')
      : existing.endsAt;
    await this.assertValidOverrideWindow({
      monitorId,
      playlistId,
      startsAt,
      endsAt,
      excludeId: id,
    });
    const row = await this.prisma.screenCastScheduleOverride.update({
      where: { id },
      data: { monitorId, playlistId, startsAt, endsAt },
      include: {
        monitor: { select: { id: true, name: true, screenKey: true } },
        playlist: { select: { id: true, name: true } },
      },
    });
    return this.toScheduleOverrideDto(row);
  }

  async deleteScheduleOverride(id: string) {
    const existing = await this.findScheduleOverride(id);
    await this.prisma.screenCastScheduleOverride.delete({ where: { id } });
    return {
      ok: true as const,
      screenKey: existing.monitor.screenKey,
      startsAt: existing.startsAt.toISOString(),
      endsAt: existing.endsAt.toISOString(),
    };
  }

  async getScheduleOverride(id: string) {
    const row = await this.findScheduleOverride(id);
    return this.toScheduleOverrideDto(row);
  }

  /** True if [startsAt, endsAt) intersects now. */
  scheduleOverrideTouchesNow(
    startsAt: Date | string,
    endsAt: Date | string,
    at = new Date(),
  ): boolean {
    const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
    const end = endsAt instanceof Date ? endsAt : new Date(endsAt);
    return start <= at && end > at;
  }

  // --- Public + heartbeat ---

  async getPublicConfig(screenKey: string) {
    const monitor = await this.prisma.screenCastMonitor.findUnique({
      where: { screenKey: screenKey.trim().toLowerCase() },
    });
    if (!monitor) throw new NotFoundException('Pantalla no encontrada');

    const effectivePlaylistId =
      await this.resolveEffectivePlaylistIdForMonitor(monitor, new Date());

    const playlist = effectivePlaylistId
      ? await this.prisma.screenCastPlaylist.findUnique({
          where: { id: effectivePlaylistId },
          include: {
            items: {
              where: { activo: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        })
      : null;

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

  private readonly monitorPlaylistInclude = {
    select: {
      id: true,
      name: true,
      items: {
        where: { activo: true },
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
        select: { mediaUrl: true, mediaType: true },
      },
    },
  };

  private toMonitorDto(
    row: ScreenCastMonitor & {
      playlist?: {
        id: string;
        name: string;
        items?: Array<{
          mediaUrl: string;
          mediaType: ScreenCastMediaType;
        }>;
      } | null;
    },
    scheduleActive: {
      endsAt: string;
      playlistId: string;
      playlistName: string;
    } | null = null,
  ) {
    const preview = row.playlist?.items?.[0];
    return {
      id: row.id,
      screenKey: row.screenKey,
      name: row.name,
      location: row.location,
      photoUrl: row.photoUrl,
      orientation: row.orientation,
      playlistId: row.playlistId,
      playlistName: row.playlist?.name ?? null,
      playlistPreview: preview
        ? { mediaUrl: preview.mediaUrl, mediaType: preview.mediaType }
        : null,
      scheduleActive,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      // Live Online/Offline comes from WebSocket presence in the controller.
      online: false,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toScheduleOverrideDto(row: {
    id: string;
    monitorId: string;
    playlistId: string;
    startsAt: Date;
    endsAt: Date;
    createdAt: Date;
    updatedAt: Date;
    monitor: { id: string; name: string; screenKey: string };
    playlist: { id: string; name: string };
  }) {
    return {
      id: row.id,
      monitorId: row.monitorId,
      monitorName: row.monitor.name,
      screenKey: row.monitor.screenKey,
      playlistId: row.playlistId,
      playlistName: row.playlist.name,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async resolveEffectivePlaylistIdForMonitor(
    monitor: { id: string; playlistId: string | null },
    at: Date,
  ): Promise<string | null> {
    const override = await this.prisma.screenCastScheduleOverride.findFirst({
      where: {
        monitorId: monitor.id,
        startsAt: { lte: at },
        endsAt: { gt: at },
        playlist: { activo: true },
      },
      select: { playlistId: true },
    });
    return override?.playlistId ?? monitor.playlistId;
  }

  private async activeOverridePlaylistByMonitorId(
    at: Date,
  ): Promise<Map<string, string>> {
    const rows = await this.prisma.screenCastScheduleOverride.findMany({
      where: {
        startsAt: { lte: at },
        endsAt: { gt: at },
        playlist: { activo: true },
      },
      select: { monitorId: true, playlistId: true },
    });
    return new Map(rows.map((r) => [r.monitorId, r.playlistId]));
  }

  private async activeOverrideDetailsByMonitorId(at: Date) {
    const rows = await this.prisma.screenCastScheduleOverride.findMany({
      where: {
        startsAt: { lte: at },
        endsAt: { gt: at },
        playlist: { activo: true },
      },
      select: {
        monitorId: true,
        endsAt: true,
        playlistId: true,
        playlist: { select: { name: true } },
      },
    });
    const map = new Map<
      string,
      { endsAt: string; playlistId: string; playlistName: string }
    >();
    for (const r of rows) {
      map.set(r.monitorId, {
        endsAt: r.endsAt.toISOString(),
        playlistId: r.playlistId,
        playlistName: r.playlist.name,
      });
    }
    return map;
  }

  private async assertValidOverrideWindow(input: {
    monitorId: string;
    playlistId: string;
    startsAt: Date;
    endsAt: Date;
    excludeId?: string;
  }) {
    if (!(input.endsAt > input.startsAt)) {
      throw new BadRequestException('La hora de fin debe ser posterior al inicio');
    }
    const monitor = await this.findMonitor(input.monitorId);
    if (!monitor.playlistId) {
      throw new BadRequestException(
        'El monitor necesita una playlist por defecto antes de programar',
      );
    }
    await this.assertAssignablePlaylist(input.playlistId);

    const overlap = await this.prisma.screenCastScheduleOverride.findFirst({
      where: {
        monitorId: input.monitorId,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
        startsAt: { lt: input.endsAt },
        endsAt: { gt: input.startsAt },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException(
        'Ya existe una programación que se solapa en este monitor',
      );
    }
  }

  private async assertMonitorHasNoFutureOverrides(monitorId: string) {
    const count = await this.prisma.screenCastScheduleOverride.count({
      where: { monitorId, endsAt: { gt: new Date() } },
    });
    if (count > 0) {
      throw new BadRequestException(
        'Quita primero la programación de este monitor',
      );
    }
  }

  private parseInstant(raw: string, field: string): Date {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} no es una fecha válida`);
    }
    return date;
  }

  private async findScheduleOverride(id: string) {
    const row = await this.prisma.screenCastScheduleOverride.findUnique({
      where: { id },
      include: {
        monitor: { select: { id: true, name: true, screenKey: true } },
        playlist: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Programación no encontrada');
    return row;
  }

  private async assertAssignablePlaylist(playlistId: string) {
    const playlist = await this.findPlaylist(playlistId);
    if (!playlist.activo) {
      throw new BadRequestException(
        'No se puede asignar una playlist inactiva',
      );
    }
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
