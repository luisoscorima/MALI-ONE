import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'mali-one:chunk-reload';

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message || '';
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

/**
 * Lazy route import with one controlled full reload when a hashed chunk
 * disappears after deploy (stale tab still running the previous shell).
 */
export function lazyPage<T extends ComponentType<unknown>>(
  importer: () => Promise<{ default: T } | Record<string, T>>,
  exportName?: string,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await importer();
      if (exportName) {
        const named = (mod as Record<string, T>)[exportName];
        if (!named) {
          throw new Error(`lazyPage: missing export "${exportName}"`);
        }
        sessionStorage.removeItem(RELOAD_KEY);
        return { default: named };
      }
      sessionStorage.removeItem(RELOAD_KEY);
      return mod as { default: T };
    } catch (error) {
      if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, '1');
        window.location.reload();
        // Never resolve while the reload is in flight.
        return new Promise(() => undefined);
      }
      sessionStorage.removeItem(RELOAD_KEY);
      throw error;
    }
  });
}
