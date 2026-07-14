import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BsaleListResponse<T> = {
  href?: string;
  count: number;
  limit: number;
  offset: number;
  items: T[];
  next?: string;
};

@Injectable()
export class BsaleClientService {
  private readonly logger = new Logger(BsaleClientService.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly timeoutMs = 60_000;
  private readonly maxRetries = 3;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('BSALE_BASE_URL') ?? 'https://api.bsale.com.pe'
    ).replace(/\/$/, '');
    this.accessToken =
      this.config.get<string>('BSALE_ACCESS_TOKEN')?.trim() ?? '';
  }

  ensureConfigured(): void {
    if (!this.accessToken) {
      throw new ServiceUnavailableException(
        'Bsale no está configurado. Define BSALE_ACCESS_TOKEN.',
      );
    }
  }

  async getJson<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    this.ensureConfigured();
    const url = new URL(
      path.startsWith('http') ? path : `${this.baseUrl}${path}`,
    );
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            access_token: this.accessToken,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.status === 429 || res.status >= 500) {
          const delay = attempt * 1000;
          this.logger.warn(
            `Bsale ${res.status} en ${url.pathname} (intento ${attempt}/${this.maxRetries}), reintento en ${delay}ms`,
          );
          await sleep(delay);
          continue;
        }

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new BadGatewayException(
            `Bsale respondió ${res.status} en ${url.pathname}: ${body.slice(0, 300)}`,
          );
        }

        return (await res.json()) as T;
      } catch (err) {
        lastError = err;
        if (err instanceof BadGatewayException) throw err;
        if (attempt < this.maxRetries) {
          await sleep(attempt * 1000);
          continue;
        }
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : 'Error desconocido';
    throw new BadGatewayException(`No se pudo consultar Bsale: ${message}`);
  }

  async getAllPages<T>(
    path: string,
    query: Record<string, string | number | undefined> = {},
    pageSize = 50,
  ): Promise<T[]> {
    const items: T[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const page = await this.getJson<BsaleListResponse<T>>(path, {
        ...query,
        limit: pageSize,
        offset,
      });
      const batch = page.items ?? [];
      items.push(...batch);
      total = typeof page.count === 'number' ? page.count : items.length;
      offset += page.limit || pageSize;
      if (batch.length === 0) break;
    }

    return items;
  }
}

export function dateToUnixStart(isoDate: string): number {
  // Bsale emissionDate: integer without timezone — treat as UTC midnight
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, 0, 0, 0) / 1000);
}

export function dateToUnixEnd(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d, 23, 59, 59) / 1000);
}

export function unixToIsoDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export function* monthRanges(
  fromIso: string,
  toIso: string,
): Generator<{ fromTs: number; toTs: number; label: string }> {
  const [fy, fm] = fromIso.split('-').map(Number);
  const [ty, tm] = toIso.split('-').map(Number);
  let y = fy;
  let m = fm;

  while (y < ty || (y === ty && m <= tm)) {
    const monthStart = Math.floor(Date.UTC(y, m - 1, 1, 0, 0, 0) / 1000);
    const monthEnd = Math.floor(Date.UTC(y, m, 0, 23, 59, 59) / 1000);
    const fromTs = Math.max(monthStart, dateToUnixStart(fromIso));
    const toTs = Math.min(monthEnd, dateToUnixEnd(toIso));
    if (fromTs <= toTs) {
      yield {
        fromTs,
        toTs,
        label: `${y}-${String(m).padStart(2, '0')}`,
      };
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
