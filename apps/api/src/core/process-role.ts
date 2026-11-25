export type ProcessRole = 'all' | 'http' | 'worker';

/** `all` = single process (local/dev). Prod splits `http` + `worker`. */
export function getProcessRole(): ProcessRole {
  const raw = String(process.env.PROCESS_ROLE ?? 'all')
    .trim()
    .toLowerCase();
  if (raw === 'http' || raw === 'worker') return raw;
  return 'all';
}

/** HTTP API (and combined `all`) should serve requests. */
export function isHttpProcess(): boolean {
  const role = getProcessRole();
  return role === 'http' || role === 'all';
}

/** Crons, SQS consumers, and job drainers run here. */
export function isBackgroundProcess(): boolean {
  const role = getProcessRole();
  return role === 'worker' || role === 'all';
}

/** When true, manual triggers enqueue instead of running Playwright/sync in-process. */
export function shouldEnqueueBackgroundWork(): boolean {
  return getProcessRole() === 'http';
}
