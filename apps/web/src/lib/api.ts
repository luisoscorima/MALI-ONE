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

  qrUrl: (id: string) => `/api/links/${id}/qr`,

  async fetchLinkQrObjectUrl(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/api/links/${id}/qr`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(
        typeof error.message === 'string' ? error.message : 'No se pudo generar el QR',
      );
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
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

  createEducacionAliado: (body: Record<string, unknown>) =>
    request('/api/widgets/educacion/aliados', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

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

  getPamWidgetAdmin: () =>
    request<import('@mali-one/shared').PamAdminStateDto>('/api/widgets/pam/admin'),

  updatePamWidgetSettings: (body: { benefits: string[]; notes: string[] }) =>
    request('/api/widgets/pam/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  updatePamPlan: (id: string, body: Record<string, unknown>) =>
    request(`/api/widgets/pam/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  listPamRegistrations: () =>
    request<import('@mali-one/shared').PamRegistrationDto[]>(
      '/api/widgets/pam/registrations',
    ),
};
