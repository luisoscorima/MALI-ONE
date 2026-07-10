import type { AppModule, AppUserDto, AuthUser } from '@mali-one/shared';

const API_BASE = '';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    const message = error.message;
    const text = Array.isArray(message)
      ? message.join(', ')
      : typeof message === 'string'
        ? message
        : res.statusText;
    throw new Error(text || 'Error de solicitud');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }

  return res as unknown as T;
}

export const api = {
  getMe: () => request<AuthUser>('/api/auth/me'),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  googleLoginUrl: () => '/api/auth/google',

  listWorkspaceUsers: (q?: string, pageToken?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (pageToken) params.set('pageToken', pageToken);
    const qs = params.toString();
    return request<{ users: import('@mali-one/shared').GoogleWorkspaceUser[]; nextPageToken: string | null }>(
      `/api/admin/users${qs ? `?${qs}` : ''}`,
    );
  },

  createWorkspaceUser: (body: import('@mali-one/shared').CreateWorkspaceUserDto) =>
    request('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),

  updateWorkspaceUser: (
    email: string,
    body: import('@mali-one/shared').UpdateWorkspaceUserDto,
  ) =>
    request(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  resetWorkspacePassword: (email: string) =>
    request<{ temporaryPassword: string }>(
      `/api/admin/users/${encodeURIComponent(email)}/reset-password`,
      { method: 'POST' },
    ),

  signOutWorkspaceUser: (email: string) =>
    request<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(email)}/sign-out`,
      { method: 'POST' },
    ),

  suspendWorkspaceUser: (email: string) =>
    request(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: 'DELETE',
    }),

  listAppUsers: () => request<AppUserDto[]>('/api/admin/app-users'),

  updateAppUserModules: (id: string, modules: AppModule[]) =>
    request<AppUserDto>(`/api/admin/app-users/${id}/modules`, {
      method: 'PATCH',
      body: JSON.stringify({ modules }),
    }),

  shortenUrl: (url: string, customSlug?: string, tags?: string[]) =>
    request<import('@mali-one/shared').ShortLinkDto>('/api/links/shorten', {
      method: 'POST',
      body: JSON.stringify({ url, customSlug, tags }),
    }),

  createWhatsappLink: (
    phone: string,
    text?: string,
    customSlug?: string,
    tags?: string[],
  ) =>
    request<import('@mali-one/shared').ShortLinkDto>('/api/links/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ phone, text, customSlug, tags }),
    }),

  uploadFile: (file: File, customSlug?: string, tags?: string[]) => {
    const form = new FormData();
    form.append('file', file);
    if (customSlug) form.append('customSlug', customSlug);
    if (tags?.length) form.append('tags', tags.join(','));
    return request<import('@mali-one/shared').ShortLinkDto>('/api/links/upload', {
      method: 'POST',
      body: form,
    });
  },

  bulkShorten: (
    items: Array<{ url: string; customSlug?: string; tags?: string[] }>,
  ) =>
    request<import('@mali-one/shared').BulkLinksResultDto>(
      '/api/links/bulk/shorten',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    ),

  bulkWhatsapp: (
    items: Array<{
      phone: string;
      text?: string;
      customSlug?: string;
      tags?: string[];
    }>,
  ) =>
    request<import('@mali-one/shared').BulkLinksResultDto>(
      '/api/links/bulk/whatsapp',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    ),

  bulkUpload: (files: File[]) => {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    return request<import('@mali-one/shared').BulkLinksResultDto>(
      '/api/links/bulk/upload',
      {
        method: 'POST',
        body: form,
      },
    );
  },

  listLinks: (tag?: string) => {
    const params = new URLSearchParams();
    if (tag) params.set('tag', tag);
    const qs = params.toString();
    return request<import('@mali-one/shared').ShortLinkDto[]>(
      `/api/links${qs ? `?${qs}` : ''}`,
    );
  },

  updateLink: (id: string, body: import('@mali-one/shared').UpdateShortLinkDto) =>
    request<import('@mali-one/shared').ShortLinkDto>(`/api/links/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteLink: (id: string) =>
    request(`/api/links/${id}`, { method: 'DELETE' }),

  getQrDefaultStyle: () =>
    request<import('@mali-one/shared').QrStyleDto>(
      '/api/links/me/qr-default-style',
    ),

  saveQrDefaultStyle: (style: import('@mali-one/shared').QrStyleDto) =>
    request<import('@mali-one/shared').QrStyleDto>(
      '/api/links/me/qr-default-style',
      { method: 'PUT', body: JSON.stringify(style) },
    ),

  updateLinkQrStyle: (
    id: string,
    style: import('@mali-one/shared').QrStyleDto,
    logoFile?: File,
    saveAsDefault = false,
  ) => {
    const params = new URLSearchParams();
    if (saveAsDefault) params.set('saveAsDefault', 'true');
    const qs = params.toString();
    if (logoFile) {
      const form = new FormData();
      form.append('payload', JSON.stringify(style));
      form.append('logo', logoFile);
      return request<import('@mali-one/shared').ShortLinkDto>(
        `/api/links/${id}/qr-style${qs ? `?${qs}` : ''}`,
        { method: 'PATCH', body: form },
      );
    }
    return request<import('@mali-one/shared').ShortLinkDto>(
      `/api/links/${id}/qr-style${qs ? `?${qs}` : ''}`,
      { method: 'PATCH', body: JSON.stringify(style) },
    );
  },

  removeLinkQrLogo: (id: string) =>
    request<import('@mali-one/shared').ShortLinkDto>(
      `/api/links/${id}/qr-logo`,
      { method: 'DELETE' },
    ),

  getLinkStats: (id: string, days = 30) =>
    request<import('@mali-one/shared').LinkStatsDto>(
      `/api/links/${id}/stats?days=${days}`,
    ),

  qrUrl: (id: string, format: 'png' | 'svg' | 'eps' = 'png', width?: number) => {
    const params = new URLSearchParams({ format });
    if (width) params.set('width', String(width));
    return `/api/links/${id}/qr?${params.toString()}`;
  },

  async fetchQrPreview(
    data: string,
    style: import('@mali-one/shared').QrStyleDto,
    options?: {
      linkId?: string;
      logoFile?: File;
      signal?: AbortSignal;
      width?: number;
    },
  ): Promise<Blob> {
    const form = new FormData();
    form.append(
      'payload',
      JSON.stringify({
        data,
        style,
        linkId: options?.linkId,
      }),
    );
    if (options?.logoFile) {
      form.append('logo', options.logoFile);
    }
    const params = new URLSearchParams();
    if (options?.width) params.set('width', String(options.width));
    const qs = params.toString();
    const res = await fetch(
      `${API_BASE}/api/links/qr-preview${qs ? `?${qs}` : ''}`,
      {
        method: 'POST',
        body: form,
        credentials: 'include',
        signal: options?.signal,
      },
    );
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const message = error.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : res.statusText;
      throw new Error(text || 'Error al generar vista previa');
    }
    return res.blob();
  },

  async fetchLinkQrObjectUrl(id: string): Promise<string> {
    const blob = await api.fetchLinkQrBlob(id);
    return URL.createObjectURL(blob);
  },

  async fetchLinkQrBlob(
    id: string,
    options?: { width?: number; signal?: AbortSignal },
  ): Promise<Blob> {
    const params = new URLSearchParams({ format: 'png' });
    if (options?.width) params.set('width', String(options.width));
    const res = await fetch(`${API_BASE}/api/links/${id}/qr?${params}`, {
      credentials: 'include',
      signal: options?.signal,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(
        typeof error.message === 'string' ? error.message : 'No se pudo generar el QR',
      );
    }
    return res.blob();
  },

  listS3Buckets: () =>
    request<import('@mali-one/shared').S3BucketInfo[]>('/api/s3-manager/buckets'),

  listS3Objects: (
    bucket: string,
    prefix?: string,
    continuationToken?: string,
  ) => {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    if (continuationToken) params.set('continuationToken', continuationToken);
    const qs = params.toString();
    return request<import('@mali-one/shared').S3ListObjectsResult>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/objects${qs ? `?${qs}` : ''}`,
    );
  },

  getS3DownloadUrl: (bucket: string, key: string) =>
    request<{ url: string; expiresIn: number }>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/download?key=${encodeURIComponent(key)}`,
    ),

  getS3PublicUrl: (bucket: string, key: string) =>
    request<import('@mali-one/shared').S3PublicUrlResult>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/public-url?key=${encodeURIComponent(key)}`,
    ),

  deleteS3Object: (bucket: string, key: string) =>
    request<{ ok: boolean }>(
      `/api/s3-manager/buckets/${encodeURIComponent(bucket)}/objects?key=${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    ),

  getEducacionWidgetAdmin: () =>
    request<import('@mali-one/shared').EducacionAdminStateDto>(
      '/api/widgets/educacion/admin',
    ),

  updateEducacionWidgetSettings: (
    body: Partial<import('@mali-one/shared').EducacionWidgetSettingsDto>,
  ) =>
    request('/api/widgets/educacion/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  createEducacionSede: (body: Record<string, unknown>) =>
    request('/api/widgets/educacion/sedes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateEducacionSede: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/educacion/sedes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteEducacionSede: (id: string) =>
    request(`/api/widgets/educacion/sedes/${id}`, { method: 'DELETE' }),

  createEducacionSelectorSede: (body: Record<string, unknown>) =>
    request('/api/widgets/educacion/selector/sedes', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateEducacionSelectorSede: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/educacion/selector/sedes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteEducacionSelectorSede: (id: string) =>
    request(`/api/widgets/educacion/selector/sedes/${id}`, { method: 'DELETE' }),

  updateEducacionPopup: (
    body: Partial<import('@mali-one/shared').EducacionPopupSettingsDto>,
  ) =>
    request('/api/widgets/educacion/popup', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  updateMuseoPopup: (
    body: Partial<import('@mali-one/shared').MuseoPopupSettingsDto>,
  ) =>
    request('/api/widgets/museo/popup', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  createEducacionAliado: (body: Record<string, unknown>) =>
    request('/api/widgets/educacion/aliados', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  importEducacionAliados: (items: Record<string, unknown>[], replace = true) =>
    request<{ upserted: number; total: number }>(
      '/api/widgets/educacion/aliados/import',
      {
        method: 'POST',
        body: JSON.stringify({ items, replace }),
      },
    ),

  updateEducacionAliado: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/educacion/aliados/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteEducacionAliado: (id: string) =>
    request(`/api/widgets/educacion/aliados/${id}`, { method: 'DELETE' }),

  listBibliotecaCarouselAdmin: () =>
    request<import('@mali-one/shared').BibliotecaCarouselItemDto[]>(
      '/api/widgets/biblioteca/carousel/admin',
    ),

  getBibliotecaCarouselSettings: () =>
    request<import('@mali-one/shared').BibliotecaCarouselSettingsDto>(
      '/api/widgets/biblioteca/carousel/settings',
    ),

  updateBibliotecaCarouselSettings: (body: {
    headerTitle: string;
    headerColor: string;
  }) =>
    request<import('@mali-one/shared').BibliotecaCarouselSettingsDto>(
      '/api/widgets/biblioteca/carousel/settings',
      { method: 'PUT', body: JSON.stringify(body) },
    ),

  createBibliotecaCarouselItem: (body: Record<string, unknown>) =>
    request('/api/widgets/biblioteca/carousel', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateBibliotecaCarouselItem: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/biblioteca/carousel/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  deleteBibliotecaCarouselItem: (id: string) =>
    request(`/api/widgets/biblioteca/carousel/${id}`, { method: 'DELETE' }),

  getPamSettings: () =>
    request<{ id: string; benefits: string[]; notes: string[] }>(
      '/api/pam/settings',
    ),

  getPamPlans: () =>
    request<import('@mali-one/shared').PamPlanDto[]>('/api/pam/plans'),

  updatePamSettings: (body: { benefits: string[]; notes: string[] }) =>
    request('/api/pam/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  updatePamPlan: (id: string, body: Record<string, unknown>) =>
    request(`/api/pam/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listPamRegistrations: () =>
    request<import('@mali-one/shared').PamRegistrationDto[]>(
      '/api/pam/registrations',
    ),

  updatePamRegistration: (
    id: string,
    body: import('@mali-one/shared').UpdatePamRegistrationDto,
  ) =>
    request<import('@mali-one/shared').PamRegistrationDto>(
      `/api/pam/registrations/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  resendPamWelcome: (id: string) =>
    request<import('@mali-one/shared').PamRegistrationDto>(
      `/api/pam/registrations/${id}/resend-welcome`,
      { method: 'POST' },
    ),

  getMuseoPopup: () =>
    request<import('@mali-one/shared').MuseoPopupSettingsDto>(
      '/api/widgets/museo/popup',
    ),

  // --- Screen Cast ---

  listScreenCastPlaylists: () =>
    request<
      (import('@mali-one/shared').ScreenCastPlaylistDto & {
        _count?: { monitors: number; items: number };
      })[]
    >('/api/screen-cast/playlists'),

  getScreenCastPlaylist: (id: string) =>
    request<
      import('@mali-one/shared').ScreenCastPlaylistDto & {
        items: import('@mali-one/shared').ScreenCastPlaylistItemDto[];
        _count?: { monitors: number };
      }
    >(`/api/screen-cast/playlists/${id}`),

  createScreenCastPlaylist: (body: { name: string; activo?: boolean }) =>
    request<import('@mali-one/shared').ScreenCastPlaylistDto>(
      '/api/screen-cast/playlists',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateScreenCastPlaylist: (
    id: string,
    body: { name?: string; activo?: boolean },
  ) =>
    request<import('@mali-one/shared').ScreenCastPlaylistDto>(
      `/api/screen-cast/playlists/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteScreenCastPlaylist: (id: string) =>
    request<{ ok: boolean }>(`/api/screen-cast/playlists/${id}`, {
      method: 'DELETE',
    }),

  createScreenCastPlaylistItem: (
    playlistId: string,
    body: {
      mediaUrl: string;
      mediaType: import('@mali-one/shared').ScreenCastMediaType;
      durationMs?: number;
      sortOrder?: number;
      activo?: boolean;
    },
  ) =>
    request<import('@mali-one/shared').ScreenCastPlaylistItemDto>(
      `/api/screen-cast/playlists/${playlistId}/items`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateScreenCastPlaylistItem: (
    id: string,
    body: Partial<{
      mediaUrl: string;
      mediaType: import('@mali-one/shared').ScreenCastMediaType;
      durationMs: number;
      sortOrder: number;
      activo: boolean;
    }>,
  ) =>
    request<import('@mali-one/shared').ScreenCastPlaylistItemDto>(
      `/api/screen-cast/items/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteScreenCastPlaylistItem: (id: string) =>
    request<{ ok: boolean }>(`/api/screen-cast/items/${id}`, {
      method: 'DELETE',
    }),

  listScreenCastMonitors: () =>
    request<import('@mali-one/shared').ScreenCastMonitorDto[]>(
      '/api/screen-cast/monitors',
    ),

  getScreenCastMonitor: (id: string) =>
    request<import('@mali-one/shared').ScreenCastMonitorDto>(
      `/api/screen-cast/monitors/${id}`,
    ),

  createScreenCastMonitor: (body: {
    screenKey: string;
    name: string;
    location?: string;
    playlistId?: string | null;
  }) =>
    request<import('@mali-one/shared').ScreenCastMonitorDto>(
      '/api/screen-cast/monitors',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  updateScreenCastMonitor: (
    id: string,
    body: Partial<{
      screenKey: string;
      name: string;
      location: string | null;
      playlistId: string | null;
    }>,
  ) =>
    request<import('@mali-one/shared').ScreenCastMonitorDto>(
      `/api/screen-cast/monitors/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteScreenCastMonitor: (id: string) =>
    request<{ ok: boolean }>(`/api/screen-cast/monitors/${id}`, {
      method: 'DELETE',
    }),

  getScreenCastPublicConfig: (screenKey: string) =>
    request<import('@mali-one/shared').ScreenCastPublicConfigDto>(
      `/api/screen-cast/screens/${encodeURIComponent(screenKey)}/config`,
    ),

  listScreenCastS3Buckets: () =>
    request<import('@mali-one/shared').S3BucketInfo[]>(
      '/api/screen-cast/s3/buckets',
    ),

  listScreenCastS3Objects: (
    bucket: string,
    prefix?: string,
    continuationToken?: string,
  ) => {
    const params = new URLSearchParams();
    if (prefix) params.set('prefix', prefix);
    if (continuationToken) params.set('continuationToken', continuationToken);
    const qs = params.toString();
    return request<import('@mali-one/shared').S3ListObjectsResult>(
      `/api/screen-cast/s3/buckets/${encodeURIComponent(bucket)}/objects${qs ? `?${qs}` : ''}`,
    );
  },

  getScreenCastS3PublicUrl: (bucket: string, key: string) =>
    request<import('@mali-one/shared').S3PublicUrlResult>(
      `/api/screen-cast/s3/buckets/${encodeURIComponent(bucket)}/public-url?key=${encodeURIComponent(key)}`,
    ),
};
