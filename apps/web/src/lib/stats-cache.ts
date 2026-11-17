import type {
  LinkStatsDto,
  MalichimpCampaignStatsDto,
} from '@mali-one/shared';

const TTL_MS = 60_000;
const linkCache = new Map<string, { data: LinkStatsDto; at: number }>();
const campaignCache = new Map<
  string,
  { data: MalichimpCampaignStatsDto; at: number }
>();

function readCache<T>(
  cache: Map<string, { data: T; at: number }>,
  key: string,
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function getCachedLinkStats(
  linkId: string,
  days: number,
): LinkStatsDto | null {
  return readCache(linkCache, `${linkId}:${days}`);
}

export function setCachedLinkStats(
  linkId: string,
  days: number,
  data: LinkStatsDto,
): void {
  linkCache.set(`${linkId}:${days}`, { data, at: Date.now() });
}

export function getCachedMalichimpCampaignStats(
  campaignId: string,
  days: number,
): MalichimpCampaignStatsDto | null {
  return readCache(campaignCache, `${campaignId}:${days}`);
}

export function setCachedMalichimpCampaignStats(
  campaignId: string,
  days: number,
  data: MalichimpCampaignStatsDto,
): void {
  campaignCache.set(`${campaignId}:${days}`, { data, at: Date.now() });
}
