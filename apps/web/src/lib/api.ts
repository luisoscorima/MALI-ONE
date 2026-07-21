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
    if (res.status === 504 || res.status === 502 || res.status === 524) {
      throw new Error(
        'La solicitud tardó demasiado (timeout del proxy). Si es Kardex, espera unos segundos y vuelve a intentar: el servidor puede seguir procesando en segundo plano.',
      );
    }
    const error = await res.json().catch(() => ({ message: res.statusText }));
    const message = error.message;
    const text = Array.isArray(message)
      ? message.join(', ')
      : typeof message === 'string'
        ? message
        : res.statusText;
    throw new Error(text || `Error de solicitud (${res.status})`);
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

  downloadQrBulk: async (
    ids: string[],
    format: 'png' | 'svg' = 'png',
    width?: number,
  ) => {
    const res = await fetch(`${API_BASE}/api/links/qr/bulk`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, format, width }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const message = error.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : res.statusText;
      throw new Error(text || 'Error al descargar QR');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = match?.[1] ?? `qrs-${format}-${stamp}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    orientation?: import('@mali-one/shared').ScreenCastOrientation;
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
      orientation: import('@mali-one/shared').ScreenCastOrientation;
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

  syncAllScreenCastMonitors: () =>
    request<{ ok: boolean; notified: number }>(
      '/api/screen-cast/monitors/sync',
      { method: 'POST' },
    ),

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

  uploadScreenCastMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{
      url: string;
      key: string;
      mediaType: import('@mali-one/shared').ScreenCastMediaType;
      fileName: string;
    }>('/api/screen-cast/s3/upload', {
      method: 'POST',
      body: form,
    });
  },

  getBsaleOffices: () =>
    request<import('@mali-one/shared').BsaleOfficeDto[]>('/api/bsale/offices'),

  getBsaleKardex: (body: import('@mali-one/shared').BsaleKardexQueryDto) =>
    request<import('@mali-one/shared').BsaleKardexJobDto>(
      '/api/bsale/kardex',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  exportBsaleKardex: async (
    body: import('@mali-one/shared').BsaleKardexExportDto,
  ) => {
    const res = await fetch(`${API_BASE}/api/bsale/kardex/export`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const message = error.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : typeof message === 'string'
          ? message
          : res.statusText;
      throw new Error(text || 'Error al exportar');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename =
      match?.[1] ??
      `kardex_bsale_${body.from}_${body.to}.${body.format === 'xlsx' ? 'xlsx' : 'csv'}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  listNewsletters: () =>
    request<import('@mali-one/shared').NewsletterDto[]>('/api/newsletters'),

  getNewsletter: (id: string) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/newsletters/${id}`,
    ),

  createNewsletter: (body: import('@mali-one/shared').CreateNewsletterDto) =>
    request<import('@mali-one/shared').NewsletterDto>('/api/newsletters', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateNewsletter: (
    id: string,
    body: import('@mali-one/shared').UpdateNewsletterDto,
  ) =>
    request<import('@mali-one/shared').NewsletterDto>(
      `/api/newsletters/${id}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteNewsletter: (id: string) =>
    request<{ ok: boolean }>(`/api/newsletters/${id}`, {
      method: 'DELETE',
    }),

  listCrmPamContacts: (params?: {
    q?: string;
    segment?: string;
    attr_key?: string;
    attr_value?: string;
    has_email?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.segment) qs.set('segment', params.segment);
    if (params?.attr_key) qs.set('attr_key', params.attr_key);
    if (params?.attr_value !== undefined) {
      qs.set('attr_value', params.attr_value);
    }
    if (params?.has_email !== undefined) {
      qs.set('has_email', String(params.has_email));
    }
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<{
      area: string;
      total: number;
      page: number;
      limit: number;
      pages: number;
      items: Array<{
        contact_id: number;
        name: string;
        last_name: string;
        phone: string;
        email: string | null;
        dni: string | null;
        opt_in: boolean;
        opt_in_email: boolean;
        active: boolean;
        segment_slugs: string[];
        attributes: Record<string, string>;
        created_at: string;
        updated_at: string;
      }>;
    }>(`/api/crm-pam/contacts${q ? `?${q}` : ''}`);
  },

  patchCrmPamContact: (
    id: number,
    body: {
      name?: string;
      last_name?: string;
      email?: string | null;
      dni?: string | null;
      opt_in?: boolean;
      opt_in_email?: boolean;
      segment_slugs?: string[];
      attributes?: Record<string, string>;
    },
  ) =>
    request(`/api/crm-pam/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listCrmPamAttributeDefinitions: () =>
    request<
      Array<{
        id: number;
        segment_slug: string | null;
        slug: string;
        label: string;
        field_type: string;
        sort_order: number;
        required: boolean;
        active: boolean;
      }>
    >('/api/crm-pam/attribute-definitions'),

  listCrmPamSegments: () =>
    request<Array<{ slug: string; label: string; color_key?: string }>>(
      '/api/crm-pam/segments',
    ),

  createCrmPamAttributeDefinition: (body: {
    scope: 'area' | 'segment';
    segment_slug?: string;
    slug: string;
    label: string;
    field_type?: string;
    sort_order?: number;
    required?: boolean;
  }) =>
    request('/api/crm-pam/attribute-definitions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCrmPamAttributeDefinition: (
    id: number,
    body: {
      label: string;
      field_type?: string;
      sort_order?: number;
      required?: boolean;
      active?: boolean;
    },
  ) =>
    request(`/api/crm-pam/attribute-definitions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listCrmPamPayments: () =>
    request<import('@mali-one/shared').PamRegistrationDto[]>(
      '/api/crm-pam/payments',
    ),

  createCrmPamPayment: (
    body: import('@mali-one/shared').CreatePamPaymentDto,
  ) =>
    request<import('@mali-one/shared').PamRegistrationDto>(
      '/api/crm-pam/payments',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  linkCrmPamPayment: (id: string) =>
    request<{ ok: boolean; paymentId: string; phone: string }>(
      `/api/crm-pam/payments/${id}/link-contact`,
      { method: 'POST' },
    ),

  linkCrmPamPaymentsByPhone: () =>
    request<{
      ok: boolean;
      linked: number;
      phones: number;
      errors: Array<{ paymentId: string; error: string }>;
    }>('/api/crm-pam/payments/link-by-phone', { method: 'POST' }),

  listCrmPamNewsletters: () =>
    request<
      Array<{
        id: string;
        slug: string;
        title: string;
        subject: string;
        status: string;
        updatedAt: string;
      }>
    >('/api/crm-pam/newsletters'),

  listEmailCampaigns: () =>
    request<import('@mali-one/shared').EmailCampaignDto[]>(
      '/api/crm-pam/campaigns',
    ),

  getEmailCampaign: (id: string) =>
    request<import('@mali-one/shared').EmailCampaignDto>(
      `/api/crm-pam/campaigns/${id}`,
    ),

  getEmailCampaignStats: (id: string) =>
    request<import('@mali-one/shared').EmailCampaignStatsDto>(
      `/api/crm-pam/campaigns/${id}/stats`,
    ),

  createEmailCampaign: (
    body: import('@mali-one/shared').CreateEmailCampaignDto,
  ) =>
    request<import('@mali-one/shared').EmailCampaignDto>(
      '/api/crm-pam/campaigns',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  previewEmailAudience: (id: string) =>
    request<{
      total: number;
      area: string;
      sample: Array<{
        contact_id: number;
        email: string;
        name: string;
        last_name: string;
      }>;
    }>(`/api/crm-pam/campaigns/${id}/audience-preview`),

  sendEmailCampaign: (id: string) =>
    request<import('@mali-one/shared').EmailCampaignDto>(
      `/api/crm-pam/campaigns/${id}/send`,
      { method: 'POST' },
    ),
};
