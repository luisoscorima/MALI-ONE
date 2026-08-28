const VERSION_URL = '/screen-cast-version.json';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 60_000;
const MAX_DEFER_MS = 3 * 60 * 1000;

type UpdateOptions = {
  /** Defer reload while a video is playing (returns true if mid-playback). */
  isVideoPlaying?: () => boolean;
};

let reloadScheduled = false;
let deferTimer: number | null = null;

function currentBuildId(): string {
  return typeof __SCREEN_CAST_BUILD_ID__ === 'string'
    ? __SCREEN_CAST_BUILD_ID__
    : 'dev';
}

/** Build actually running on the screen — tells stale bundles apart. */
export function screenCastBuildId(): string {
  return currentBuildId();
}

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?_${Date.now()}`, {
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

function clearDeferTimer() {
  if (deferTimer !== null) {
    window.clearTimeout(deferTimer);
    deferTimer = null;
  }
}

function reloadForUpdate() {
  if (reloadScheduled) return;
  reloadScheduled = true;
  clearDeferTimer();
  window.location.reload();
}

function scheduleReload(options: UpdateOptions) {
  if (reloadScheduled) return;

  const playing = options.isVideoPlaying?.() ?? false;
  if (!playing) {
    reloadForUpdate();
    return;
  }

  if (deferTimer !== null) return;
  deferTimer = window.setTimeout(() => {
    deferTimer = null;
    scheduleReload(options);
  }, MAX_DEFER_MS);
}

async function checkForUpdate(options: UpdateOptions) {
  if (reloadScheduled || currentBuildId() === 'dev') return;

  const remoteBuildId = await fetchRemoteBuildId();
  if (!remoteBuildId || remoteBuildId === 'dev' || remoteBuildId === currentBuildId()) {
    return;
  }

  scheduleReload(options);
}

function watchServiceWorkerUpdates(options: UpdateOptions) {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadForUpdate();
  });

  void navigator.serviceWorker.ready.then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'installed') return;
        if (!navigator.serviceWorker.controller) return;
        scheduleReload(options);
      });
    });
  });
}

/** Poll deploy version + listen for SW updates; reload kiosk players automatically. */
export function startScreenCastAutoUpdate(options: UpdateOptions = {}) {
  if (currentBuildId() === 'dev') return;

  watchServiceWorkerUpdates(options);

  const runCheck = () => {
    void checkForUpdate(options);
    void navigator.serviceWorker?.getRegistration('/screen-cast').then((reg) => {
      void reg?.update();
    });
  };

  window.setTimeout(runCheck, INITIAL_DELAY_MS);
  window.setInterval(runCheck, CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') runCheck();
  });
}
