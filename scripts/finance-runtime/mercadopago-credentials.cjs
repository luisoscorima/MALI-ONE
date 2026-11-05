// Mercado Pago credential worker in the shared Finance runtime. Secrets are emitted only to
// the API process through stdout and are never logged or persisted.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const exec = promisify(execFile);

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'mali-mp-'));
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
    const item = JSON.parse(await bw(['get', 'item', process.env.FINANCE_VAULT_MP_ITEM_ID]));
    if (item.deletedDate) throw new Error();
    const fields = Object.fromEntries((item.fields || []).map(field => [String(field.name).toLowerCase(), field.value]));
    const accessToken = fields.access_token || fields.accesstoken ||
      (String(item.login?.password || '').startsWith('APP_USR-') ? item.login.password : null);
    const clientId = fields.client_id || fields.clientid;
    const clientSecret = fields.client_secret || fields.clientsecret;
    if (!accessToken && !(clientId && clientSecret)) throw new Error();
    process.stdout.write(JSON.stringify({ accessToken, clientId, clientSecret }));
  } catch {
    process.stdout.write(JSON.stringify({ error: stage }));
    process.exitCode = 1;
  } finally {
    for (const key of Object.keys(env)) delete env[key];
    await rm(dir, { recursive: true, force: true });
  }
}
main().catch(() => { process.exitCode = 1; });
