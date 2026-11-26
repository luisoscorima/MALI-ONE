/**
 * Canonical admin routes and tabs for email surfaces.
 * Menu, dashboard and deep links should import from here.
 */

export const EMAIL_HUB_PATH = '/admin/email';
export const MALICHIMP_PATH = '/admin/malichimp';
export const WORKSPACE_PATH = '/admin/workspace';

export type EmailHubTab = 'newsletters' | 'campaigns' | 'senders';
export type MalichimpTab = 'audience' | 'campaigns' | 'newsletters' | 'senders';
export type WorkspaceTab = 'directory' | 'newsletters' | 'campaigns';

export const EMAIL_HUB_DEFAULT_TAB: EmailHubTab = 'newsletters';
export const MALICHIMP_DEFAULT_TAB: MalichimpTab = 'audience';
export const WORKSPACE_DEFAULT_TAB: WorkspaceTab = 'directory';

const EMAIL_HUB_TABS = new Set<string>(['newsletters', 'campaigns', 'senders']);
const MALICHIMP_TABS = new Set<string>([
  'audience',
  'campaigns',
  'newsletters',
  'senders',
]);
const WORKSPACE_TABS = new Set<string>(['directory', 'newsletters', 'campaigns']);

const EMAIL_HUB_TAB_ALIASES: Record<string, EmailHubTab> = {
  boletines: 'newsletters',
  campanas: 'campaigns',
  remitentes: 'senders',
  newsletters: 'newsletters',
  campaigns: 'campaigns',
  senders: 'senders',
};

const MALICHIMP_TAB_ALIASES: Record<string, MalichimpTab> = {
  content: 'newsletters',
  remitentes: 'senders',
  audience: 'audience',
  campaigns: 'campaigns',
  newsletters: 'newsletters',
  senders: 'senders',
};

const WORKSPACE_TAB_ALIASES: Record<string, WorkspaceTab> = {
  directorio: 'directory',
  contenido: 'newsletters',
  campanas: 'campaigns',
  directory: 'directory',
  newsletters: 'newsletters',
  campaigns: 'campaigns',
};

/** Catalog column (newsletter / sender scope). */
export const CATALOG_LABEL: Record<string, string> = {
  shared: 'Institucional',
  malichimp: 'MALICHIMP',
  internal_communications: 'Comunicaciones internas',
};

/** Origin column (campaign audienceArea). */
export const ORIGIN_LABEL: Record<string, string> = {
  malichimp: 'MALICHIMP',
  internal_workspace: 'Comunicaciones internas',
  pam: 'PAM',
};

function withQuery(
  path: string,
  tab: string | undefined,
  params?: URLSearchParams | Record<string, string | null | undefined>,
): string {
  const next = new URLSearchParams();
  // Keep tab first so deep links stay stable and readable.
  if (tab) next.set('tab', tab);
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (key === 'tab') return;
      next.append(key, value);
    });
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === 'tab' || value == null || value === '') continue;
      next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

function resolveTab<T extends string>(
  raw: string | null | undefined,
  aliases: Readonly<Record<string, T>>,
  defaultTab: T,
): T {
  return raw && Object.hasOwn(aliases, raw) ? aliases[raw] : defaultTab;
}

export function resolveEmailHubTab(raw: string | null | undefined): EmailHubTab {
  return resolveTab(raw, EMAIL_HUB_TAB_ALIASES, EMAIL_HUB_DEFAULT_TAB);
}

export function resolveMalichimpTab(raw: string | null | undefined): MalichimpTab {
  return resolveTab(raw, MALICHIMP_TAB_ALIASES, MALICHIMP_DEFAULT_TAB);
}

export function resolveWorkspaceTab(raw: string | null | undefined): WorkspaceTab {
  return resolveTab(raw, WORKSPACE_TAB_ALIASES, WORKSPACE_DEFAULT_TAB);
}

/** Returns a query update only when its tab differs from the canonical form. */
export function canonicalEmailAdminSearch(
  params: URLSearchParams,
  tab: string,
  defaultTab: string,
): URLSearchParams | null {
  const tabs = params.getAll('tab');
  if (tab === defaultTab ? tabs.length === 0 : tabs.length === 1 && tabs[0] === tab) {
    return null;
  }

  const next = new URLSearchParams(params);
  if (tab === defaultTab) next.delete('tab');
  else next.set('tab', tab);
  return next;
}

export function emailHubHref(
  tab: EmailHubTab = EMAIL_HUB_DEFAULT_TAB,
  params?: URLSearchParams | Record<string, string | null | undefined>,
): string {
  const canonical = EMAIL_HUB_TABS.has(tab) ? tab : EMAIL_HUB_DEFAULT_TAB;
  // Default tab omitted from URL (base path = initial tab).
  return withQuery(
    EMAIL_HUB_PATH,
    canonical === EMAIL_HUB_DEFAULT_TAB ? undefined : canonical,
    params,
  );
}

export function malichimpHref(
  tab: MalichimpTab = MALICHIMP_DEFAULT_TAB,
  params?: URLSearchParams | Record<string, string | null | undefined>,
): string {
  const canonical = MALICHIMP_TABS.has(tab) ? tab : MALICHIMP_DEFAULT_TAB;
  return withQuery(
    MALICHIMP_PATH,
    canonical === MALICHIMP_DEFAULT_TAB ? undefined : canonical,
    params,
  );
}

export function workspaceHref(
  tab: WorkspaceTab = WORKSPACE_DEFAULT_TAB,
  params?: URLSearchParams | Record<string, string | null | undefined>,
): string {
  const canonical = WORKSPACE_TABS.has(tab) ? tab : WORKSPACE_DEFAULT_TAB;
  return withQuery(
    WORKSPACE_PATH,
    canonical === WORKSPACE_DEFAULT_TAB ? undefined : canonical,
    params,
  );
}

export function malichimpNewsletterEditHref(id: string): string {
  return malichimpHref('newsletters', { edit: id });
}

export function workspaceNewsletterEditHref(id: string): string {
  return workspaceHref('newsletters', { edit: id });
}

export function malichimpCampaignHref(campaignId: string): string {
  return malichimpHref('campaigns', { campaign: campaignId });
}

export function workspaceCampaignHref(campaignId: string): string {
  return workspaceHref('campaigns', { campaign: campaignId });
}

export function malichimpImportXlsxHref(): string {
  return malichimpHref('audience', { import: 'xlsx' });
}

export function campaignRegistryHref(
  audienceArea: string,
  campaignId: string,
): string | null {
  if (audienceArea === 'malichimp') return malichimpCampaignHref(campaignId);
  if (audienceArea === 'internal_workspace') {
    return workspaceCampaignHref(campaignId);
  }
  return null;
}

/**
 * Map an old path + search to the canonical location.
 * Returns null when already canonical (caller should still normalize tab aliases).
 */
export function resolveLegacyEmailAdminRedirect(
  pathname: string,
  search: string,
): string | null {
  // React Router ignores case and trailing slashes when matching these routes.
  const alias = pathname.replace(/\/+$/, '').toLowerCase();
  const params = new URLSearchParams(search);
  const rawTab = params.get('tab');

  if (alias === '/admin/mailing') {
    return emailHubHref(EMAIL_HUB_DEFAULT_TAB, params);
  }
  if (alias === '/admin/comunicacion-interna') {
    return workspaceHref('campaigns', params);
  }
  if (alias === '/admin/newsletters') {
    return emailHubHref(resolveEmailHubTab(rawTab), params);
  }
  if (alias === '/admin/users') {
    return workspaceHref(resolveWorkspaceTab(rawTab), params);
  }
  return null;
}
