export type UserRole = 'admin' | 'operator';

export type AppModule = 'links' | 'workspace_users' | 's3_manager';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  isSuperAdmin: boolean;
  modules: AppModule[];
}

export interface AppUserDto {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  modules: AppModule[];
  createdAt: string;
}

export interface S3BucketInfo {
  name: string;
  creationDate?: string;
}

export interface S3ObjectItem {
  key: string;
  name: string;
  isFolder: boolean;
  size: number | null;
  lastModified: string | null;
}

export interface S3ListObjectsResult {
  items: S3ObjectItem[];
  prefix: string;
  nextContinuationToken: string | null;
}

export interface ShortLinkDto {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  type: 'URL' | 'FILE';
  fileName: string | null;
  mimeType: string | null;
  s3Key: string | null;
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
