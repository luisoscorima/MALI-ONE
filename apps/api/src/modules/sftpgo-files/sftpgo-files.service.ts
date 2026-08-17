import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { Readable } from 'stream';
import { extname } from 'path';

export type UploadedFileLike = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/** TIFF no se renderiza en navegadores; se convierte a JPEG en /preview. */
const PREVIEW_CONVERT_EXT = new Set(['.tif', '.tiff']);

const PREVIEW_MAX_EDGE = 1920;
const PREVIEW_JPEG_QUALITY = 85;

const TRASH_STAMP = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;

@Injectable()
export class SftpgoFilesService {
  private readonly logger = new Logger(SftpgoFilesService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly rootPrefix: string;
  private readonly protectedPaths: string[];
  private readonly trashDir: string;
  private readonly trashRetentionDays: number;
  private readonly previewMaxMb: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (config.get<string>('SFTPGO_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.apiKey = config.get<string>('SFTPGO_API_KEY') ?? '';
    this.rootPrefix = this.normalizePrefix(
      config.get<string>('SFTPGO_ROOT_PREFIX') ?? '',
    );
    this.protectedPaths = this.parsePathList(
      config.get<string>('SFTPGO_PROTECTED_PATHS') ?? '',
    );
    this.trashDir = this.normalizePrefix(
      config.get<string>('SFTPGO_TRASH_DIR') ?? '_trash',
    );
    const days = Number(config.get<string>('SFTPGO_TRASH_RETENTION_DAYS') ?? '30');
    this.trashRetentionDays =
      Number.isFinite(days) && days > 0 ? Math.floor(days) : 30;
    const previewMb = Number(config.get<string>('SFTPGO_PREVIEW_MAX_MB') ?? '100');
    this.previewMaxMb =
      Number.isFinite(previewMb) && previewMb > 0 ? previewMb : 100;
  }

  getPublicConfig() {
    return {
      trashPath: this.trashDir ? `/${this.trashDir}` : '',
      protectedPaths: this.protectedPaths.map((p) => `/${p}`),
    };
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new ServiceUnavailableException(
        'SFTPGo no configurado (SFTPGO_BASE_URL / SFTPGO_API_KEY)',
      );
    }
  }

  private assertTrashConfigured() {
    if (!this.trashDir) {
      throw new ServiceUnavailableException(
        'Papelera no configurada (SFTPGO_TRASH_DIR)',
      );
    }
  }

  async list(path = '/') {
    this.assertConfigured();
    const abs = this.toAbsolutePath(path);
    const current = this.toRelativePath(abs);
    const data = await this.listRaw(current);
    const hideTrash = !this.isInTrash(current);
    const items = data
      .map((entry) => this.toListItem(entry, current))
      .filter((item) => !(hideTrash && this.isTrashRoot(item.path)));
    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, 'es');
    });
    return { path: current, items };
  }

  async listTrash(path?: string) {
    this.assertTrashConfigured();
    const root = `/${this.trashDir}`;
    const target = path?.trim() ? this.toRelativePath(this.toAbsolutePath(path)) : root;
    if (!this.isInTrash(target)) {
      throw new BadRequestException('Ruta fuera de la papelera');
    }
    return this.list(target);
  }

  async mkdir(path: string) {
    this.assertConfigured();
    const rel = this.toRelativePath(this.toAbsolutePath(path));
    this.assertMutable(rel);
    await this.mkdirAbs(this.toAbsolutePath(rel));
    return { ok: true, path: rel };
  }

  async rename(from: string, to: string) {
    this.assertConfigured();
    const relFrom = this.toRelativePath(this.toAbsolutePath(from));
    const relTo = this.toRelativePath(this.toAbsolutePath(to));
    this.assertMutable(relFrom);
    this.assertMutable(relTo);
    if (this.isInTrash(relFrom) || this.isInTrash(relTo)) {
      throw new ForbiddenException('Usa restaurar para elementos de la papelera');
    }
    await this.renameAbs(this.toAbsolutePath(relFrom), this.toAbsolutePath(relTo));
    return { ok: true };
  }

  async copy(from: string, to: string) {
    this.assertConfigured();
    const relFrom = this.toRelativePath(this.toAbsolutePath(from));
    const relTo = this.toRelativePath(this.toAbsolutePath(to));
    this.assertMutable(relTo);
    if (this.isProtectedPath(relFrom)) {
      throw new ForbiddenException('No se puede copiar una carpeta protegida');
    }
    if (this.isInTrash(relTo)) {
      throw new ForbiddenException('No se puede copiar a la papelera');
    }
    const absFrom = this.toAbsolutePath(relFrom);
    const absTo = this.toAbsolutePath(relTo);
    await this.requestJson(
      'POST',
      `/api/v2/user/file-actions/copy?path=${encodeURIComponent(absFrom)}&target=${encodeURIComponent(absTo)}`,
    );
    return { ok: true, path: relTo };
  }

  async remove(path: string, isFolder: boolean) {
    this.assertConfigured();
    this.assertTrashConfigured();
    const rel = this.toRelativePath(this.toAbsolutePath(path));
    this.assertMutable(rel);
    if (this.isInTrash(rel)) {
      throw new ForbiddenException('El elemento ya está en la papelera');
    }
    const stamp = this.formatTrashStamp(new Date());
    const original = rel.replace(/^\//, '');
    const dest = `/${this.trashDir}/${stamp}/${original}`;
    await this.ensureDir(this.dirname(dest));
    await this.renameAbs(this.toAbsolutePath(rel), this.toAbsolutePath(dest));
    return { ok: true, path: dest, isFolder };
  }

  async restore(path: string) {
    this.assertConfigured();
    this.assertTrashConfigured();
    const rel = this.toRelativePath(this.toAbsolutePath(path));
    if (!this.isInTrash(rel) || this.isTrashRoot(rel)) {
      throw new BadRequestException('Ruta de papelera inválida');
    }
    const original = this.originalPathFromTrash(rel);
    if (!original) {
      throw new BadRequestException('No se pudo restaurar esta entrada');
    }
    const dest = await this.uniqueRestoreTarget(original);
    await this.ensureDir(this.dirname(dest));
    await this.renameAbs(this.toAbsolutePath(rel), this.toAbsolutePath(dest));
    return { ok: true, path: dest };
  }

  async purgeExpiredTrash(): Promise<number> {
    if (!this.baseUrl || !this.apiKey || !this.trashDir) return 0;
    const root = `/${this.trashDir}`;
    let entries: SftpgoDirEntry[];
    try {
      entries = await this.listRaw(root);
    } catch (error) {
      this.logger.warn(`No se pudo listar la papelera: ${String(error)}`);
      return 0;
    }
    const cutoff = Date.now() - this.trashRetentionDays * 24 * 60 * 60 * 1000;
    let purged = 0;
    for (const entry of entries) {
      const name = entry.name || this.basename(entry.path || '');
      const stamped = this.parseTrashStamp(name);
      if (!stamped || stamped.getTime() > cutoff) continue;
      const rel = this.joinRelative(root, name);
      try {
        await this.physicalRemove(rel, this.isDirEntry(entry));
        purged += 1;
      } catch (error) {
        this.logger.error(`Purga papelera ${rel}: ${String(error)}`);
      }
    }
    return purged;
  }

  async upload(dirPath: string, file: UploadedFileLike) {
    this.assertConfigured();
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo vacío');
    }
    const absDirRel = this.toRelativePath(this.toAbsolutePath(dirPath || '/'));
    if (this.isInTrash(absDirRel)) {
      throw new ForbiddenException('No se puede subir a la papelera');
    }
    const absDir = this.toAbsolutePath(absDirRel);
    const form = new FormData();
    const bytes = new Uint8Array(file.buffer);
    const blob = new Blob([bytes], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('filenames', blob, file.originalname);

    const url = `${this.baseUrl}/api/v2/user/files?path=${encodeURIComponent(absDir)}&mkdir_parents=true`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-SFTPGO-API-KEY': this.apiKey },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`SFTPGo upload ${res.status}: ${text}`);
      throw new ServiceUnavailableException(
        `SFTPGo upload: ${res.status} ${text || res.statusText}`,
      );
    }
    return {
      ok: true,
      path: this.joinRelative(absDirRel, file.originalname),
    };
  }

  async download(path: string): Promise<{
    stream: StreamableFile;
    fileName: string;
    mime: string;
  }> {
    this.assertConfigured();
    const abs = this.toAbsolutePath(path);
    if (abs.endsWith('/')) {
      throw new BadRequestException('Ruta de archivo inválida');
    }
    const res = await fetch(
      `${this.baseUrl}/api/v2/user/files?path=${encodeURIComponent(abs)}`,
      { headers: { 'X-SFTPGO-API-KEY': this.apiKey } },
    );
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `SFTPGo download: ${res.status} ${text || res.statusText}`,
      );
    }
    const fileName = this.basename(abs);
    const nodeStream = Readable.fromWeb(
      res.body as import('stream/web').ReadableStream,
    );
    return {
      stream: new StreamableFile(nodeStream),
      fileName,
      mime: this.mimeFromName(fileName),
    };
  }

  previewMime(path: string): string {
    if (!this.isPreviewable(path)) {
      throw new BadRequestException('No se puede previsualizar este archivo');
    }
    if (this.needsPreviewConversion(path)) return 'image/jpeg';
    return this.mimeFromName(this.basename(path));
  }

  async preview(path: string): Promise<{
    stream: StreamableFile;
    fileName: string;
    mime: string;
  }> {
    this.assertConfigured();
    const rel = this.toRelativePath(this.toAbsolutePath(path));
    const fileName = this.basename(rel);

    if (this.needsPreviewConversion(rel)) {
      const buffer = await this.downloadBuffer(rel);
      const maxBytes = this.previewMaxMb * 1024 * 1024;
      if (buffer.length > maxBytes) {
        throw new BadRequestException(
          `El archivo supera ${this.previewMaxMb} MB para vista previa`,
        );
      }
      let jpeg: Buffer;
      try {
        jpeg = await sharp(buffer)
          .rotate()
          .resize({
            width: PREVIEW_MAX_EDGE,
            height: PREVIEW_MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: PREVIEW_JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
      } catch (error) {
        this.logger.error(`Preview TIFF ${rel}: ${String(error)}`);
        throw new BadRequestException('No se pudo convertir el TIFF para vista previa');
      }
      return {
        stream: new StreamableFile(jpeg),
        fileName: fileName.replace(/\.tiff?$/i, '.jpg'),
        mime: 'image/jpeg',
      };
    }

    const downloaded = await this.download(rel);
    return {
      stream: downloaded.stream,
      fileName: downloaded.fileName,
      mime: downloaded.mime,
    };
  }

  isPreviewable(path: string): boolean {
    const ext = extname(this.basename(path)).toLowerCase();
    return ext in IMAGE_MIME || PREVIEW_CONVERT_EXT.has(ext);
  }

  private needsPreviewConversion(path: string): boolean {
    return PREVIEW_CONVERT_EXT.has(extname(this.basename(path)).toLowerCase());
  }

  private async downloadBuffer(relPath: string): Promise<Buffer> {
    const abs = this.toAbsolutePath(relPath);
    const res = await fetch(
      `${this.baseUrl}/api/v2/user/files?path=${encodeURIComponent(abs)}`,
      { headers: { 'X-SFTPGO-API-KEY': this.apiKey } },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ServiceUnavailableException(
        `SFTPGo download: ${res.status} ${text || res.statusText}`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  private toListItem(entry: SftpgoDirEntry, parentPath: string) {
    const name = entry.name || this.basename(entry.path || '');
    const entryPath = this.toRelativePath(entry.path || `${parentPath}/${name}`);
    return {
      name,
      path: entryPath,
      isFolder: this.isDirEntry(entry),
      size: entry.size ?? null,
      lastModified: this.parseLastModified(entry.last_modified),
      locked: this.isProtectedPath(entryPath) || this.isTrashRoot(entryPath),
    };
  }

  private async listRaw(relPath: string): Promise<SftpgoDirEntry[]> {
    const abs = this.toAbsolutePath(relPath);
    const data = await this.requestJson<SftpgoDirEntry[]>(
      'GET',
      `/api/v2/user/dirs?path=${encodeURIComponent(abs)}`,
    );
    return Array.isArray(data) ? data : [];
  }

  private async mkdirAbs(abs: string, mkdirParents = false) {
    const qs = mkdirParents ? '&mkdir_parents=true' : '';
    await this.requestJson(
      'POST',
      `/api/v2/user/dirs?path=${encodeURIComponent(abs)}${qs}`,
    );
  }

  private async renameAbs(absFrom: string, absTo: string) {
    await this.requestJson(
      'POST',
      `/api/v2/user/file-actions/move?path=${encodeURIComponent(absFrom)}&target=${encodeURIComponent(absTo)}`,
    );
  }

  private async ensureDir(relPath: string) {
    const rel = relPath === '' ? '/' : this.toRelativePath(this.toAbsolutePath(relPath));
    if (rel === '/') return;
    const abs = this.toAbsolutePath(rel);
    try {
      await this.mkdirAbs(abs, true);
    } catch (error) {
      const exists = await this.entryExists(rel);
      if (!exists) throw error;
    }
  }

  private async entryExists(relPath: string): Promise<boolean> {
    const rel = this.toRelativePath(this.toAbsolutePath(relPath));
    if (rel === '/') return true;
    const parent = this.dirname(rel);
    const name = this.basename(rel);
    const siblings = await this.listRaw(parent);
    return siblings.some((e) => (e.name || this.basename(e.path || '')) === name);
  }

  private async uniqueRestoreTarget(original: string): Promise<string> {
    if (!(await this.entryExists(original))) return original;
    const dir = this.dirname(original);
    const base = this.basename(original);
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let candidate = this.joinRelative(dir, `${stem}_restored${ext}`);
    let i = 2;
    while (await this.entryExists(candidate)) {
      candidate = this.joinRelative(dir, `${stem}_restored${i}${ext}`);
      i += 1;
    }
    return candidate;
  }

  private async physicalRemove(relPath: string, isFolder: boolean) {
    const abs = this.toAbsolutePath(relPath);
    const endpoint = isFolder
      ? `/api/v2/user/dirs?path=${encodeURIComponent(abs)}`
      : `/api/v2/user/files?path=${encodeURIComponent(abs)}`;
    await this.requestJson('DELETE', endpoint);
  }

  private assertMutable(relPath: string) {
    if (this.isProtectedPath(relPath) || this.isTrashRoot(relPath)) {
      throw new ForbiddenException('Esta carpeta está protegida');
    }
  }

  private isProtectedPath(relPath: string): boolean {
    const rel = this.stripTrailing(relPath);
    return this.protectedPaths.some((p) => rel === `/${p}`);
  }

  private isTrashRoot(relPath: string): boolean {
    if (!this.trashDir) return false;
    return this.stripTrailing(relPath) === `/${this.trashDir}`;
  }

  private isInTrash(relPath: string): boolean {
    if (!this.trashDir) return false;
    const rel = this.stripTrailing(relPath);
    const root = `/${this.trashDir}`;
    return rel === root || rel.startsWith(`${root}/`);
  }

  private originalPathFromTrash(relPath: string): string | null {
    const rel = this.stripTrailing(relPath);
    const prefix = `/${this.trashDir}/`;
    if (!rel.startsWith(prefix)) return null;
    const rest = rel.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return null;
    const stamp = rest.slice(0, slash);
    if (!TRASH_STAMP.test(stamp)) return null;
    const original = rest.slice(slash + 1);
    if (!original) return null;
    return `/${original}`;
  }

  private formatTrashStamp(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
  }

  private parseTrashStamp(name: string): Date | null {
    const m = TRASH_STAMP.exec(name);
    if (!m) return null;
    const date = new Date(
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
      ),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private mimeFromName(fileName: string): string {
    const ext = extname(fileName).toLowerCase();
    return IMAGE_MIME[ext] ?? 'application/octet-stream';
  }

  private parsePathList(raw: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of raw.split(',')) {
      const n = this.normalizePrefix(part);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
    }
    return out;
  }

  private async requestJson<T = unknown>(
    method: string,
    pathAndQuery: string,
  ): Promise<T> {
    const url = `${this.baseUrl}${pathAndQuery}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'X-SFTPGO-API-KEY': this.apiKey,
          Accept: 'application/json',
        },
      });
    } catch (error) {
      this.logger.error(`SFTPGo network error: ${String(error)}`);
      throw new ServiceUnavailableException(
        'No se pudo conectar con SFTPGo',
      );
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`SFTPGo ${method} ${pathAndQuery}: ${res.status} ${text}`);
      throw new ServiceUnavailableException(
        `SFTPGo: ${res.status} ${text || res.statusText}`,
      );
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined as T;
    }
  }

  /** Relative UI path → absolute SFTPGo path under rootPrefix. */
  private toAbsolutePath(input: string): string {
    const cleaned = this.sanitizeRelative(input);
    if (!this.rootPrefix) {
      return cleaned === '' ? '/' : `/${cleaned}`;
    }
    if (cleaned === '') return `/${this.rootPrefix}`;
    return `/${this.rootPrefix}/${cleaned}`;
  }

  private toRelativePath(absolute: string): string {
    let p = absolute.replace(/\\/g, '/');
    if (!p.startsWith('/')) p = `/${p}`;
    if (this.rootPrefix) {
      const prefix = `/${this.rootPrefix}`;
      if (p === prefix || p === `${prefix}/`) return '/';
      if (p.startsWith(`${prefix}/`)) {
        p = p.slice(prefix.length);
      }
    }
    if (!p.startsWith('/')) p = `/${p}`;
    return this.stripTrailing(p === '' ? '/' : p);
  }

  private sanitizeRelative(input: string): string {
    const raw = (input || '/').replace(/\\/g, '/').trim();
    const parts = raw.split('/').filter((seg) => seg && seg !== '.');
    for (const seg of parts) {
      if (seg === '..') {
        throw new BadRequestException('Ruta inválida');
      }
    }
    return parts.join('/');
  }

  private normalizePrefix(raw: string): string {
    return raw.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/').trim();
  }

  private stripTrailing(path: string): string {
    if (path === '/') return '/';
    return path.replace(/\/+$/, '') || '/';
  }

  private dirname(path: string): string {
    const rel = this.stripTrailing(path);
    if (rel === '/') return '/';
    const idx = rel.lastIndexOf('/');
    if (idx <= 0) return '/';
    return rel.slice(0, idx);
  }

  private basename(path: string): string {
    const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || path;
  }

  private joinRelative(dir: string, name: string): string {
    if (!dir || dir === '/') return `/${name}`;
    return `${dir.replace(/\/$/, '')}/${name}`;
  }

  /** SFTPGo 2.7+ uses Go os.FileMode (dir bit 0x80000000) when is_dir is omitted. */
  private isDirEntry(entry: SftpgoDirEntry): boolean {
    if (typeof entry.is_dir === 'boolean') return entry.is_dir;
    if (entry.type === 2) return true;
    if (entry.type === 1) return false;
    if (typeof entry.mode === 'number') {
      return ((entry.mode >>> 0) & 0x80000000) !== 0;
    }
    return false;
  }

  /** Unix seconds, Unix ms, or RFC3339 (SFTPGo 2.7 Community). */
  private parseLastModified(value: unknown): string | null {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
      const ms = Date.parse(value);
      if (!Number.isNaN(ms)) return new Date(ms).toISOString();
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return null;
      return this.parseLastModified(numeric);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const millis = value > 1e12 ? value : value * 1000;
      const date = new Date(millis);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    return null;
  }
}

type SftpgoDirEntry = {
  name?: string;
  path?: string;
  size?: number;
  last_modified?: number | string;
  is_dir?: boolean;
  /** Go os.FileMode; directory bit is 1<<31 (SFTPGo 2.7 Community). */
  mode?: number;
  /** 1=file, 2=directory in some SFTPGo versions */
  type?: number;
};
