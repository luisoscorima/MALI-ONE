// Read-only, single-commerce pilot. Login is performed manually in an isolated browser.
// No credentials, session state, transaction records or tokens are written to disk.
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.TREASURY_PLAYWRIGHT_PATH || path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const workbook = process.argv[2];
if (!workbook) throw new Error('Pass the reference XLSX path.');
const reference = JSON.parse(execFileSync('python', ['-c',
  'import openpyxl,json,sys; s=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)["sells"]; r=s.iter_rows(values_only=True); next(r); h=list(next(r)); cols=[0,2,3,11,13,16,19]; print(json.dumps({"headers":[h[i] for i in cols],"rows":[[str(v[i]) if v[i] is not None else "" for i in cols] for v in r if v[0]]},ensure_ascii=True))', workbook
], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }));
const base = 'https://api.niubiz.pe/api.backoffice.merchant';
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
async function main() {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  let auth;
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const authenticated = page.waitForResponse(response => {
      const request = response.request();
      return response.url().startsWith(base + '/') && response.status() === 200 && !!request.headers().authorization;
    }, { timeout: 600000 });
    // Attach a handler immediately so a timeout during navigation is not unhandled.
    authenticated.catch(() => {});
    await page.goto('https://comercio.niubiz.com.pe/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('WAITING_FOR_LOGIN: Inicia sesión manualmente en la ventana Niubiz abierta.');
    const observed = await authenticated;
    auth = (await observed.request().allHeaders()).authorization;
    // JWT timestamps are only hints; each request still checks the server's response.
    try {
      const claims = JSON.parse(Buffer.from(auth.replace(/^Bearer /i, '').split('.')[1], 'base64url').toString());
      console.log('TOKEN_TIMING:', JSON.stringify({
        expiresAt: Number.isFinite(claims.exp) ? new Date(claims.exp * 1000).toISOString() : null,
        remainingMinutes: Number.isFinite(claims.exp) ? Math.floor((claims.exp * 1000 - Date.now()) / 60000) : null,
        lifetimeMinutes: Number.isFinite(claims.exp) && Number.isFinite(claims.iat) ? (claims.exp - claims.iat) / 60 : null,
      }));
    } catch { console.log('TOKEN_TIMING: No se pudieron leer las fechas; validar mediante respuesta del servidor.'); }
    if (process.argv.includes('--all-merchants')) {
      const merchants = require('./niubiz-merchants.json');
      const results = [];
      for (const merchantId of merchants) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        let entry;
        try {
          const response = await context.request.post(base + '/order', {
            headers: { Authorization: auth },
            data: { page: 1, size: 10, fromDate: '1/10/2026', toDate: '31/10/2026', merchantId, transactionDate: '', confirmationDate: '', pagolinkId: null, export: true },
            timeout: 60000, maxRedirects: 0,
          });
          entry = { merchantId, httpStatus: response.status(), status: 'error' };
          if (response.status() === 401) {
            results.push({ ...entry, status: 'session_expired' });
            console.log('SESSION_EXPIRED: Se detiene el recorrido.');
            break;
          }
          if (response.status() === 429) {
            results.push({ ...entry, status: 'rate_limited' });
            console.log('RATE_LIMITED: Se detiene el recorrido para respetar el límite.');
            break;
          }
          if (response.ok()) {
            const payload = await response.json();
            entry.errorCode = payload.header?.errorCode ?? null;
            if (entry.errorCode === 0 && Array.isArray(payload.data?.list)) {
              const rows = payload.data.list;
              const keys = rows.length ? Object.keys(rows[0]) : [];
              const merchantKey = keys.find(k => normalize(k) === normalize(reference.headers[5]));
              const idKey = keys.find(k => normalize(k) === normalize(reference.headers[6]));
              const stateKey = keys.find(k => normalize(k) === normalize(reference.headers[4]));
              const valid = !rows.length || (merchantKey && idKey && stateKey && rows.every(row => String(row[merchantKey]) === merchantId && row[idKey]));
              if (valid) {
                entry.rows = rows.length;
                entry.duplicateIds = rows.length - new Set(rows.map(row => String(row[idKey]))).size;
                entry.status = entry.duplicateIds ? 'duplicate_ids' : 'ok';
                entry.states = {};
                for (const row of rows) entry.states[String(row[stateKey])] = (entry.states[String(row[stateKey])] || 0) + 1;
              } else entry.status = 'schema_or_merchant_mismatch';
            } else entry.status = entry.errorCode === 10 ? 'pending' : 'api_error';
          }
        } catch { entry = { merchantId, status: 'network_or_response_error' }; }
        results.push(entry);
        console.log('MERCHANT_RESULT:', JSON.stringify(entry));
      }
      const passed = results.length === merchants.length && results.every(item => item.status === 'ok');
      console.log('ALL_MERCHANTS_RESULT:', JSON.stringify({ expectedMerchants: merchants.length, consultedMerchants: results.length, successfulMerchants: results.filter(item => item.status === 'ok').length, passed }));
      if (!passed) process.exitCode = 2;
      return;
    }
    console.log('SESSION_READY: Consultando únicamente octubre de 2026, comercio 650177853.');
    const response = await context.request.post(base + '/order', {
      headers: { Authorization: auth },
      data: { page: 1, size: 10, fromDate: '1/10/2026', toDate: '31/10/2026', merchantId: '650177853', transactionDate: '', confirmationDate: '', pagolinkId: null, export: true },
      timeout: 60000, maxRedirects: 0,
    });
    console.log('HTTP_STATUS:', response.status());
    if (!response.ok()) throw new Error('API_HTTP_ERROR');
    const result = await response.json();
    console.log('API_ERROR_CODE:', result.header?.errorCode);
    if (result.header?.errorCode !== 0) throw new Error('API_REPORTED_ERROR_OR_PENDING');
    const rows = result.data?.list;
    if (!Array.isArray(rows)) throw new Error('UNEXPECTED_LIST_SCHEMA');
    if (!rows.length) throw new Error('EMPTY_EXPORT_FOR_NONEMPTY_REFERENCE');
    const keys = Object.keys(rows[0]);
    const columns = reference.headers.map(h => keys.find(k => normalize(k) === normalize(h)));
    if (columns.some(k => !k)) {
      console.log('EXPORT_FIELD_NAMES:', JSON.stringify(keys));
      throw new Error('EXPORT_COLUMNS_NEED_MAPPING');
    }
    const canonical = row => row.map((value, index) => {
      const text = String(value ?? '').trim();
      if (index === 2) {
        if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('UNEXPECTED_AMOUNT_FORMAT');
        const [whole, fraction = ''] = text.split('.');
        return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
      }
      return text;
    });
    const expected = reference.rows.map(canonical);
    const actual = rows.map(row => canonical(columns.map(k => row[k])));
    const expectedMap = new Map(expected.map(row => [row[6], JSON.stringify(row)]));
    const actualMap = new Map(actual.map(row => [row[6], JSON.stringify(row)]));
    const states = {};
    for (const row of actual) states[row[4]] = (states[row[4]] || 0) + 1;
    const summary = {
      merchant: '650177853', period: '2026-10', expectedRows: expected.length, apiRows: actual.length,
      duplicateIds: actual.length - actualMap.size,
      missingIds: [...expectedMap.keys()].filter(id => !actualMap.has(id)).length,
      extraIds: [...actualMap.keys()].filter(id => !expectedMap.has(id)).length,
      changedRows: [...expectedMap].filter(([id, row]) => actualMap.has(id) && actualMap.get(id) !== row).length,
      states,
    };
    const passed = expected.length === 252 && expectedMap.size === expected.length && actual.length === expected.length && !summary.duplicateIds && !summary.missingIds && !summary.extraIds && !summary.changedRows;
    console.log('RESULT:', JSON.stringify({ ...summary, passed }));
    if (!passed) process.exitCode = 2;
  } finally {
    auth = undefined;
    await browser.close();
  }
}
main().catch(error => {
  // Never print request headers, raw response bodies or error stacks containing them.
  console.error('PROBE_STOPPED:', error.name, /^[A-Z_]+$/.test(error.message) ? error.message : 'No se completó la prueba; revisar inicio de sesión, conectividad o tiempo de espera.');
  process.exitCode = 1;
});
