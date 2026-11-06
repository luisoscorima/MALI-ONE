// Provider-aware credential worker in the shared Finance runtime. It exposes
// only the whitelisted fields required by a connector. Secrets travel through
// stdout to the API process and are never logged or persisted.
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
    const item = JSON.parse(await bw(['get', 'item', process.env.FINANCE_VAULT_ITEM_ID]));
    if (item.deletedDate) throw new Error();
    const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const fields = Object.fromEntries((item.fields || []).map(field => [normalize(field.name), field.value]));
    const get = name => fields[normalize(name)] || null;
    const provider = process.env.FINANCE_PROVIDER;
    if (provider === 'mercadopago') {
      const accessToken = get('access_token') ||
        (String(item.login?.password || '').startsWith('APP_USR-') ? item.login.password : null);
      if (!accessToken) throw new Error();
      process.stdout.write(JSON.stringify({ accessToken }));
    } else if (provider === 'pagoefectivo') {
      const result = { accessKey: get('access_key'), secretKey: get('secret_key'), serviceId: get('id_service') };
      if (!result.accessKey || !result.secretKey || !result.serviceId) throw new Error();
      process.stdout.write(JSON.stringify(result));
    } else {
      throw new Error();
    }
  } catch {
    process.stdout.write(JSON.stringify({ error: stage }));
    process.exitCode = 1;
  } finally {
    for (const key of Object.keys(env)) delete env[key];
    await rm(dir, { recursive: true, force: true });
  }
}
main().catch(() => { process.exitCode = 1; });
