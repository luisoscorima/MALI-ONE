import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TreasuryPaymentsService } from './treasury-payments.service';
import { parseNiubizRows } from './niubiz-import';
import merchants from './niubiz-merchants.json';

const base = 'https://api.niubiz.pe/api.backoffice.merchant';
const required = ['FINANCE_VAULT_URL', 'FINANCE_VAULT_CLIENT_ID', 'FINANCE_VAULT_CLIENT_SECRET', 'FINANCE_VAULT_MASTER_PASSWORD', 'FINANCE_VAULT_NIUBIZ_ITEM_ID', 'NIUBIZ_RUNTIME_NODE', 'NIUBIZ_LOGIN_SCRIPT'];
type Result = { merchant: string; status: string; rows?: number; createdCount?: number; updatedCount?: number };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const limaDay = (now = new Date()) => new Date(now.getTime() - 5 * 3600000).toISOString().slice(0, 10);
const apiDate = (day: string) => day.split('-').reverse().join('/');

@Injectable()
export class NiubizSyncService {
  private readonly logger = new Logger(NiubizSyncService.name);
  constructor(private readonly prisma: PrismaService, private readonly payments: TreasuryPaymentsService) {}

  async status() {
    const lastRun = await this.prisma.niubizSyncState.findUnique({ where: { id: 'niubiz' } });
    if (lastRun?.status === 'running' && (!lastRun.leaseUntil || lastRun.leaseUntil < new Date())) lastRun.status = 'interrupted';
    return { configured: required.every(key => !!process.env[key]), scheduled: process.env.NIUBIZ_SYNC_ENABLED === 'true', merchantCount: merchants.length, lastRun };
  }

  // Every two hours in Lima; disabled until the first production login is verified.
  @Cron('0 0 */2 * * *', { timeZone: 'America/Lima' })
  async scheduled() {
    if (process.env.NIUBIZ_SYNC_ENABLED !== 'true') return;
    try { await this.start({}); } catch (error) {
      if (!(error instanceof ConflictException)) this.logger.warn('NIUBIZ_SCHEDULE_NOT_STARTED');
    }
  }

  async start(range: { from?: string; to?: string }, actor?: { id: string; email: string }) {
    if (!required.every(key => !!process.env[key])) throw new ServiceUnavailableException('Configura las variables de Vaultwarden y Niubiz en el servidor.');
    let url: URL;
    try { url = new URL(process.env.FINANCE_VAULT_URL!); } catch { throw new ServiceUnavailableException('URL de Vaultwarden inválida.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new ServiceUnavailableException('Vaultwarden requiere una URL HTTPS sin credenciales.');
    const to = range.to ?? limaDay();
    const from = range.from ?? limaDay(new Date(Date.now() - 31 * 86400000));
    for (const day of [from, to]) {
      const parsed = new Date(`${day}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) throw new BadRequestException('Fecha inválida.');
    }
    if (from > to || to > limaDay() || Date.parse(to) - Date.parse(from) > 31 * 86400000) throw new BadRequestException('El rango debe ser de hasta 32 días, sin fechas futuras.');
    await this.prisma.niubizSyncState.upsert({ where: { id: 'niubiz' }, create: { id: 'niubiz' }, update: {} });
    const now = new Date();
    const runId = randomUUID();
    const locked = await this.prisma.niubizSyncState.updateMany({ where: { id: 'niubiz', OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, data: {
      runId, status: 'running', startedAt: now, finishedAt: null, leaseUntil: new Date(now.getTime() + 90 * 60000),
      fromDate: from, toDate: to, errorCode: null, results: [],
    } });
    if (!locked.count) throw new ConflictException('Ya existe una sincronización en curso.');
    // The durable lease survives process crashes; the UI marks an expired run interrupted.
    void this.run(runId, from, to, actor).catch(() => this.logger.error('NIUBIZ_RUN_STATE_WRITE_FAILED'));
    return { runId };
  }

  private login(): Promise<string> {
    return new Promise((resolve, reject) => {
      const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME,
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH };
      required.filter(key => key.startsWith('FINANCE_')).forEach(key => { env[key] = process.env[key]; });
      execFile(process.env.NIUBIZ_RUNTIME_NODE!, [process.env.NIUBIZ_LOGIN_SCRIPT!], { env, timeout: 180000, maxBuffer: 65536, windowsHide: true }, (err, stdout) => {
        try {
          const result = JSON.parse(stdout);
          if (err || typeof result.token !== 'string' || result.token.length > 16000) {
            const safe = ['VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'NIUBIZ_LOGIN_REQUIRED'];
            throw new Error(safe.includes(result.error) ? result.error : 'LOGIN_WORKER_FAILED');
          }
          resolve(result.token.replace(/^Bearer /i, ''));
        } catch (error) { reject(new Error(error instanceof Error && ['VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'NIUBIZ_LOGIN_REQUIRED'].includes(error.message) ? error.message : 'LOGIN_WORKER_FAILED')); }
      });
    });
  }

  private expiresSoon(token: string) {
    try { const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp; return typeof exp !== 'number' || exp * 1000 < Date.now() + 60000; }
    catch { return true; }
  }

  private async run(runId: string, from: string, to: string, actor?: { id: string; email: string }) {
    const results: Result[] = [];
    let errorCode: string | null = null;
    let token = '';
    let logins = 0;
    const deadline = Date.now() + 45 * 60000;
    const login = async () => { if (++logins > 3) throw new Error('SESSION_RENEWAL_LIMIT'); token = await this.login(); };
    try {
      await login();
      for (const merchant of merchants) {
        await sleep(1000);
        if (this.expiresSoon(token)) await login();
        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (Date.now() > deadline) throw new Error('RUN_TIMEOUT');
            const response = await fetch(base + '/order', {
              method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ page: 1, size: 10, fromDate: apiDate(from), toDate: apiDate(to), merchantId: merchant, transactionDate: '', confirmationDate: '', pagolinkId: null, export: true }),
            });
            if (response.status === 401) { await login(); continue; }
            if (response.status === 429) throw new Error('RATE_LIMITED');
            if (!response.ok) throw new Error('API_HTTP_ERROR');
            const payload = await response.json() as { header?: { errorCode?: number }; data?: { list?: Record<string, unknown>[]; count?: number } };
            if (payload.header?.errorCode === 10) { await sleep(3000); continue; }
            if (payload.header?.errorCode !== 0 || !Array.isArray(payload.data?.list)) throw new Error('API_SCHEMA_ERROR');
            const raw = payload.data.list;
            if (raw.length >= 5000 || (typeof payload.data.count === 'number' && payload.data.count > raw.length)) throw new Error('EXPORT_INCOMPLETE');
            const rows = raw.length ? parseNiubizRows(raw) : [];
            if (rows.some(row => row.merchantCode !== merchant || limaDay(row.transactedAt) < from || limaDay(row.transactedAt) > to)) throw new Error('API_DATA_MISMATCH');
            const saved = rows.length ? await this.payments.saveRows(rows, 'niubiz_api', createHash('sha256').update(JSON.stringify(rows)).digest('hex'), actor) : { rows: 0, createdCount: 0, updatedCount: 0 };
            results.push({ merchant, status: 'ok', rows: saved.rows, createdCount: saved.createdCount, updatedCount: saved.updatedCount });
            success = true;
            break;
          } catch (error) {
            const code = error instanceof Error ? error.message : '';
            if (['RUN_TIMEOUT', 'RATE_LIMITED', 'SESSION_RENEWAL_LIMIT', 'VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'NIUBIZ_LOGIN_REQUIRED', 'LOGIN_WORKER_FAILED'].includes(code)) throw error;
            if (attempt === 2) results.push({ merchant, status: ['EXPORT_INCOMPLETE', 'API_DATA_MISMATCH', 'API_SCHEMA_ERROR'].includes(code) ? code : 'MERCHANT_FAILED' });
            else await sleep(3000);
          }
        }
        if (!success && !results.some(r => r.merchant === merchant)) results.push({ merchant, status: 'EXPORT_PENDING' });
        await this.prisma.niubizSyncState.updateMany({ where: { id: 'niubiz', runId }, data: { results } });
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      errorCode = ['RUN_TIMEOUT', 'RATE_LIMITED', 'SESSION_RENEWAL_LIMIT', 'VAULT_AUTH', 'VAULT_UNLOCK', 'VAULT_ITEM', 'NIUBIZ_LOGIN_REQUIRED', 'LOGIN_WORKER_FAILED'].includes(code) ? code : 'SYNC_FAILED';
    } finally {
      token = '';
      await this.prisma.niubizSyncState.updateMany({ where: { id: 'niubiz', runId }, data: {
        status: errorCode ? 'failed' : results.every(r => r.status === 'ok') && results.length === merchants.length ? 'completed' : 'partial',
        results, errorCode, finishedAt: new Date(), leaseUntil: null,
      } });
    }
  }
}
