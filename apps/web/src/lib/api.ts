import type { AuthUser } from '@mali-one/shared';

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

  shortenUrl: (url: string, customSlug?: string) =>
    request<import('@mali-one/shared').ShortLinkDto>('/api/links/shorten', {
      method: 'POST',
      body: JSON.stringify({ url, customSlug }),
    }),

  uploadFile: (file: File, customSlug?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (customSlug) form.append('customSlug', customSlug);
    return request<import('@mali-one/shared').ShortLinkDto>('/api/links/upload', {
      method: 'POST',
      body: form,
    });
  },

  listLinks: () =>
    request<import('@mali-one/shared').ShortLinkDto[]>('/api/links'),

  deleteLink: (id: string) =>
    request(`/api/links/${id}`, { method: 'DELETE' }),

  qrUrl: (id: string) => `/api/links/${id}/qr`,
};
