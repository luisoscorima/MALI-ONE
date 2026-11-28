const VERSION_URL = '/screen-cast-version.json';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 60_000;
const DEFER_MS = 3 * 60 * 1000;
const ATTEMPT_KEY = 'screen-cast-update-attempt';
const MAX_ATTEMPTS = 2;

type UpdateOptions = {
  /** Defer reload while a video is playing (returns true if mid-playback). */
  isVideoPlaying?: () => boolean;
};

/** Build actually running on the screen ºw^~)Þt tells stale bundles apart. */
export function screenCastBuildId(): string {
  return typeof __SCREEN_CAST_BUILD_ID__ === 'string'
    ? __SCREEN_CAST_BUILD_ID__
    : 'dev';
}

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return typeof data.buildId === 'string' ? data.buildId : null;
  } catch {
    return null;
  }
}

function claimReloadAttempt(target: string): boolean {
  try {
    const raw = sessionStorage.getItem(ATTEMPT_KEY);
    const previous = raw
      ? (JSON.parse(raw) as { target?: string; count?: number })
      : null;
    const attempts = previous?.target === target ? previous.count ?? 0 : 0;
    if (attempts >= MAX_ATTEMPTS) return false;
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ target, count: attempts + 1 }));
    return true;
  } catch {
    // Without storage, an offline shell could reload indefinitely.
    return false;
  }
}

/** Poll the deployed version and reload only when the player is outdated. */
export function startScreenCastAutoUpdate(options: UpdateOptions = {}) {
  const current = screenCastBuildId();
  if (current === 'dev') return;

  let stopped = false;
  let checking = false;
  let reloadScheduled = false;
  let deferTimer: number | undefined;

  const checkVersion = async () => {
    if (stopped || checking || reloadScheduled || navigator.onLine === false) return;

    checking = true;
    const remote = await fetchRemoteBuildId();
    checking = false;
    if (stopped || !remote || remote === 'dev' || remote === current) return;

    reloadScheduled = true;
    const reload = () => {
      if (options.isVideoPlaying?.()) {
        deferTimer = window.setTimeout(reload, DEFER_MS);
        return;
      }
      if (claimReloadAttempt(remote)) window.location.reload();
    };
    reload();
  };

  const runCheck = () => {
    if (navigator.onLine === false) return;
    void checkVersion();
    void navigator.serviceWorker
      ?.getRegistration('/screen-cast')
      .then((reg) => reg?.update())
      .catch(() => undefined);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') runCheck();
  };

  // First install and repeat activation can happen on the current build.
  navigator.serviceWorker?.addEventListener('controllerchange', checkVersion);
  document.addEventListener('visibilitychange', onVisible);
  const initial = window.setTimeout(runCheck, INITIAL_DELAY_MS);
  const interval = window.setInterval(runCheck, CHECK_INTERVAL_MS);

  return () => {
    stopped = true;
    window.clearTimeout(initial);
    window.clearInterval(interval);
    window.clearTimeout(deferTimer);
    navigator.serviceWorker?.removeEventListener('controllerchange', checkVersion);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
