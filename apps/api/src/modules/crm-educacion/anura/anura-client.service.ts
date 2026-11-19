import { Injectable, Logger } from '@nestjs/common';

/** Shape real de GET /GCAPI/rest/tenants/stats/cdrs/ (Perú, verificado 2026-11-18). */
export type AnuraCdr = {
  id: number;
  duration?: number;
  billSeconds?: number;
  price?: number;
  status?: string;
  direction?: string;
  calling?: string;
  called?: string;
  callingName?: string;
  calledName?: string;
  dialTime?: number;
  wasRecorded?: boolean;
  lastAction?: string | null;
  routePriceTypeName?: string | null;
  account?: { id?: number; name?: string | null } | null;
};

/**
 * Cliente Anura (Perú por defecto).
 * Spike: refresh de sesión (ANURA_REFRESH_TOKEN + ANURA_CLIENT_ID).
 * Prod: preferir client_credentials offline de Soporte.
 */
@Injectable()
export class AnuraClientService {
  private readonly logger = new Logger(AnuraClientService.name);
  private accessToken: string | null = null;
  private accessExpiresAt = 0;

  get enabled(): boolean {
    return Boolean(
      process.env.ANURA_REFRESH_TOKEN?.trim()
      || (process.env.ANURA_CLIENT_ID?.trim() && process.env.ANURA_CLIENT_SECRET?.trim()),
    );
  }

  private get apiBase(): string {
    return (process.env.ANURA_API_BASE ?? 'https://api.anura.com.pe').replace(/\/$/, '');
  }

  /** SSO = api.anura.com.X → sso.anura.com.X/auth/realms/anura */
  private get ssoBase(): string {
    const fromApi = this.apiBase.replace('://api.', '://sso.');
    return `${fromApi}/auth/realms/anura`.replace(/\/$/, '');
  }

  private get clientId(): string {
    return process.env.ANURA_CLIENT_ID?.trim() || 'controlpanel-new';
  }

  async listCdrs(input: { start: Date; end: Date }): Promise<AnuraCdr[]> {
    const token = await this.getAccessToken();
    const qs = new URLSearchParams({
      startDate: this.formatAnuraDate(input.start),
      endDate: this.formatAnuraDate(input.end),
      filter: '',
    });
    const url = `${this.apiBase}/GCAPI/rest/tenants/stats/cdrs/?${qs}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anura CDRs HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = await res.json() as unknown;
    return Array.isArray(body) ? body as AnuraCdr[] : [];
  }

  private formatAnuraDate(value: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessExpiresAt - 15_000) {
      return this.accessToken;
    }
    const refresh = process.env.ANURA_REFRESH_TOKEN?.trim();
    if (refresh) {
      return this.refreshAccess(refresh);
    }
    const secret = process.env.ANURA_CLIENT_SECRET?.trim();
    if (!secret) throw new Error('Falta ANURA_REFRESH_TOKEN o ANURA_CLIENT_SECRET');
    const offline = await this.formToken({
      grant_type: 'client_credentials',
      scope: 'offline_access',
    }, true);
    const offlineRefresh = String(offline.refresh_token ?? '');
    if (!offlineRefresh) throw new Error('Anura no devolvió refresh_token offline');
    return this.refreshAccess(offlineRefresh);
  }

  private async refreshAccess(refreshToken: string): Promise<string> {
    const data = await this.formToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId,
    }, Boolean(process.env.ANURA_CLIENT_SECRET?.trim()));
    const access = String(data.access_token ?? '');
    if (!access) throw new Error('Anura no devolvió access_token');
    const expiresIn = Number(data.expires_in ?? 300);
    this.accessToken = access;
    this.accessExpiresAt = Date.now() + Math.max(60, expiresIn) * 1000;
    return access;
  }

  private async formToken(
    fields: Record<string, string>,
    withBasicAuth: boolean,
  ): Promise<Record<string, unknown>> {
    const body = new URLSearchParams(fields);
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    const secret = process.env.ANURA_CLIENT_SECRET?.trim();
    if (withBasicAuth && secret) {
      headers.Authorization = `Basic ${Buffer.from(`${this.clientId}:${secret}`).toString('base64')}`;
    }
    const res = await fetch(`${this.ssoBase}/protocol/openid-connect/token`, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Anura token HTTP ${res.status}: ${text.slice(0, 160)}`);
      throw new Error(`Anura token HTTP ${res.status}`);
    }
    return await res.json() as Record<string, unknown>;
  }
}
