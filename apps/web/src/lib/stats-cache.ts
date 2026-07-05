import type { LinkStatsDto } from '@mali-one/shared';

const TTL_MS = 60_000;
const cache = new Map<string, { data: LinkStatsDto; at: number }>();

export function getCachedLinkStats(
  linkId: string,
  days: number,
): LinkStatsDto | null {
  const entry = cache.get(`${linkId}:${days}`);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(`${linkId}:${days}`);
    return null;
  }
  return entry.data;
}

export function setCachedLinkStats(
  linkId: string,
  days: number,
  data: LinkStatsDto,
): void {
  cache.set(`${linkId}:${days}`, { data, at: Date.now() });
}
