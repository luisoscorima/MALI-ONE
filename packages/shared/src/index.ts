export type UserRole = 'admin' | 'operator';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
}

export interface ShortLinkDto {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  type: 'URL' | 'FILE';
  fileName: string | null;
  mimeType: string | null;
  clickCount: number;
  createdAt: string;
  qrBase64?: string;
}

export interface GoogleWorkspaceUser {
  id: string;
  primaryEmail: string;
  name: { givenName: string; familyName: string; fullName?: string };
  suspended: boolean;
  orgUnitPath: string;
  creationTime?: string;
  lastLoginTime?: string;
}

export interface CreateWorkspaceUserDto {
  primaryEmail: string;
  givenName: string;
  familyName: string;
  password: string;
  orgUnitPath?: string;
}

export interface UpdateWorkspaceUserDto {
  givenName?: string;
  familyName?: string;
  suspended?: boolean;
  orgUnitPath?: string;
}
