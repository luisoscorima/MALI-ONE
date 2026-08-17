import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

export type UploadedFileLike = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class SftpgoFilesService {
  private readonly logger = new Logger(SftpgoFilesService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly rootPrefix: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (config.get<string>('SFTPGO_BASE_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.apiKey = config.get<string>('SFTPGO_API_KEY') ?? '';
    this.rootPrefix = this.normalizePrefix(
      config.get<string>('SFTPGO_ROOT_PREFIX') ?? '',
    );
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new ServiceUnavailableException(
        'SFTPGo no configurado (SFTPGO_BASE_URL / SFTPGO_API_KEY)',
      );
    }
  }

  async list(path = '/') {
    this.assertConfigured();
    const abs = this.toAbsolutePath(path);
    const data = await this.requestJson<SftpgoDirEntry[]>(
      'GET',
      `/api/v2/user/dirs?path=${encodeURIComponent(abs)}`,
    );
    const items = (Array.isArray(data) ? data : []).map((entry) => {
      const name = entry.name || this.basename(entry.path || '');
      const entryPath = this.toRelativePath(entry.path || `${abs}/${name}`);
      return {
        name,
        path: entryPath,
        isFolder: this.isDirEntry(entry),
        size: entry.size ?? null,
        lastModified: this.parseLastModified(entry.last_modified),
      };
    });
    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, 'es');
    });
    return { path: this.toRelativePath(abs), items };
  }

  async mkdir(path: string) {
    this.assertConfigured();
    const abs = this.toAbsolutePath(path);
    await this.requestJson(
      'POST',
      `/api/v2/user/dirs?path=${encodeURIComponent(abs)}`,
    );
    return { ok: true, path: this.toRelativePath(abs) };
  }

  async rename(from: string, to: string) {
    this.assertConfigured();
    const absFrom = this.toAbsolutePath(from);
    const absTo = this.toAbsolutePath(to);
    await this.requestJson(
      'POST',
      `/api/v2/user/rename?path=${encodeURIComponent(absFrom)}&target=${encodeURIComponent(absTo)}`,
    );
    return { ok: true };
  }

  async remove(path: string, isFolder: boolean) {
    this.assertConfigured();
    const abs = this.toAbsolutePath(path);
    const endpoint = isFolder
      ? `/api/v2/user/dirs?path=${encodeURIComponent(abs)}`
      : `/api/v2/user/files?path=${encodeURIComponent(abs)}`;
    await this.requestJson('DELETE', endpoint);
    return { ok: true };
  }

  async upload(dirPath: string, file: UploadedFileLike) {
    this.assertConfigured();
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo vacío');
    }
    const absDir = this.toAbsolutePath(dirPath || '/');
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
      path: this.joinRelative(this.toRelativePath(absDir), file.originalname),
    };
  }

  async download(path: string): Promise<{
    stream: StreamableFile;
    fileName: string;
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
    const nodeStream = Readable.fromWeb(
      res.body as import('stream/web').ReadableStream,
    );
    return {
      stream: new StreamableFile(nodeStream),
      fileName: this.basename(abs),
    };
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
    return p === '' ? '/' : p;
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
    return raw.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
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
