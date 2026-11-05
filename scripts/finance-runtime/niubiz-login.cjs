// Niubiz login worker in the shared Finance runtime. stdout is a private pipe
// to the API, never a log destination.
// No browser profiles, traces, screenshots or plaintext secrets are persisted.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { chromium } = require('playwright');
const exec = promisify(execFile);
const base = 'https://api.niubiz.pe/api.backoffice.merchant';
async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'mali-niubiz-'));
  let browser;
  let stage = 'VAULT_AUTH';
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: dir,
    BITWARDENCLI_APPDATA_DIR: dir, BW_CLIENTID: process.env.FINANCE_VAULT_CLIENT_ID,
    BW_CLIENTSECRET: process.env.FINANCE_VAULT_CLIENT_SECRET,
    BW_PASSWORD: process.env.FINANCE_VAULT_MASTER_PASSWORD };
  const bw = async args => (await exec(process.execPath, [require.resolve('@bitwarden/cli/build/bw.js'), ...args],
    { env, timeout: 25000, maxBuffer: 4 * 1024 * 1024, windowsHide: true })).stdout.trim();
  try {
    await bw(['config', 'server', process.env.FINANCE_VAULT_URL]);
    await bw(['login', '--apikey']);
    stage = 'VAULT_UNLOCK';
    env.BW_SESSION = await bw(['unlock', '--passwordenv', 'BW_PASSWORD', '--raw']);
    delete env.BW_PASSWORD;
    stage = 'VAULT_ITEM';
    await bw(['sync']);
    const item = JSON.parse(await bw(['get', 'item', process.env.FINANCE_VAULT_NIUBIZ_ITEM_ID]));
    if (!item.login?.username || !item.login?.password || item.deletedDate) throw new Error();
    stage = 'NIUBIZ_LOGIN_REQUIRED';
    browser = await chromium.launch({ headless: true, env: { PATH: process.env.PATH, HOME: dir, SystemRoot: process.env.SystemRoot } });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto('https://comercio.niubiz.com.pe/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[formcontrolname="username"]').fill(item.login.username);
    await page.locator('input[formcontrolname="password"]').fill(item.login.password);
    const responsePromise = page.waitForResponse(r => r.url() === base + '/login' && r.request().method() === 'POST');
    responsePromise.catch(() => {});
    await page.locator('button[type="submit"]').click();
    const response = await responsePromise;
    const payload = await response.json();
    if (!response.ok() || payload.header?.errorCode !== 0 || typeof payload.data?.accessToken !== 'string') throw new Error();
    process.stdout.write(JSON.stringify({ token: payload.data.accessToken }));
  } catch {
    // Never forward raw CLI/Playwright exceptions: they can contain secret values.
    process.stdout.write(JSON.stringify({ error: stage }));
    process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => {});
    for (const key of Object.keys(env)) delete env[key];
    await rm(dir, { recursive: true, force: true });
  }
}
main().catch(() => { process.exitCode = 1; });
