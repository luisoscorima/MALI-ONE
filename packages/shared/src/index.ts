export type UserRole = 'admin' | 'operator';

export type AppModule =
  | 'links'
  | 'workspace_users'
  | 's3_manager'
  | 'password_vault'
  | 'widget_educacion'
  | 'widget_biblioteca'
  | 'widget_museo'
  | 'pam_memberships';

import { APP_PERMISSION_MODULES } from './permissions';

export type { AppPermission, PermissionAppModule } from './permissions';
export { APP_PERMISSION_MODULES };

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

export interface S3PublicUrlResult {
  url: string | null;
}

export interface ShortLinkDto {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  type: 'URL' | 'FILE' | 'WHATSAPP';
  fileName: string | null;
  mimeType: string | null;
  s3Key: string | null;
  clickCount: number;
  createdAt: string;
  tags: string[];
  qrBase64?: string;
}

export interface UpdateShortLinkDto {
  url?: string;
  phone?: string;
  text?: string;
  tags?: string[];
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
  primaryEmail?: string;
  givenName?: string;
  familyName?: string;
  suspended?: boolean;
  orgUnitPath?: string;
}

export interface EducacionWidgetSettingsDto {
  id: string;
  whatsapp: string;
  telefono: string;
  email: string;
  emailVirtual: string;
  soporteVirtual: string;
  imageRectangulo: string;
  imageWhatsapp: string;
  imageCirculo: string;
  imageCorreo: string;
  imageMarker: string;
  mapsApiKey: string | null;
  googleCalendarId: string | null;
}

export interface EducacionSelectorSedeDto {
  id: string;
  slug: string;
  nombre: string;
  brochureUrl: string;
  sortOrder: number;
  activo: boolean;
}

export type EducacionAliadoCategoria =
  | 'patrocinador'
  | 'auspiciador'
  | 'aliado'
  | 'socio';

export interface PopupScheduleFieldsDto {
  scheduleEnabled: boolean;
  scheduleDateStart: string | null;
  scheduleDateEnd: string | null;
  scheduleTimeStart: string | null;
  scheduleTimeEnd: string | null;
  scheduleTimezone: string;
}

export interface EducacionPopupSettingsDto extends PopupScheduleFieldsDto {
  id: string;
  activo: boolean;
  imagenUrl: string;
  imagenLinkUrl: string | null;
  imagenTarget: string;
  titulo: string | null;
  botonTexto: string;
  botonUrl: string;
  botonTarget: string;
  showOnce: boolean;
  delayMs: number;
  animationSpeedMs: number;
}

export type MuseoPopupSettingsDto = EducacionPopupSettingsDto;

export interface EducacionAliadoDto {
  id: string;
  nombre: string;
  imageUrl: string;
  categoria: EducacionAliadoCategoria;
  url: string | null;
  sortOrder: number;
  activo: boolean;
}

export interface EducacionDistrictDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface EducacionSedeDto {
  id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  horarioHtml: string | null;
  brochureUrl: string;
  districtId: string | null;
  showOnMap: boolean;
  sortOrder: number;
  activo: boolean;
  district?: EducacionDistrictDto | null;
}

export interface EducacionAdminStateDto {
  settings: EducacionWidgetSettingsDto;
  districts: (EducacionDistrictDto & { sedes?: EducacionSedeDto[] })[];
  sedes: EducacionSedeDto[];
  selectorSedes: EducacionSelectorSedeDto[];
  popup: EducacionPopupSettingsDto;
  aliados: EducacionAliadoDto[];
}

export interface BibliotecaCarouselItemDto {
  id: string;
  title: string;
  subtitle: string | null;
  descriptionHtml: string;
  link: string;
  imageSrc: string;
  imageAlt: string;
  backgroundSrc: string;
  sortOrder: number;
  activo: boolean;
}

export interface BibliotecaCarouselSettingsDto {
  id: string;
  headerTitle: string;
  headerColor: string;
  updatedAt: string;
}

export interface PamPlanDto {
  id: string;
  slug: string;
  name: string;
  color: string;
  exclusive: boolean;
  sortOrder: number;
  monthlyPrice: string;
  monthlyDuration: string;
  monthlyCheckout: string;
  monthlyValues: string[];
  yearlyPrice: string;
  yearlyDuration: string;
  yearlyCheckout: string;
  yearlyValues: string[];
  activo: boolean;
}

export interface PamRegistrationDto {
  id: string;
  createdAt: string;
  nombres: string;
  apellidos: string;
  dni: string;
  celular: string;
  correo: string;
  direccion: string | null;
  ciudad: string | null;
  distrito: string | null;
  genero: string | null;
  fechaNacimiento: string | null;
  comoTeEnteraste: string | null;
  plan: string;
  frecuencia: string;
  checkoutUrl: string | null;
  aceptaPrivacidad: boolean;
  mpStatus: string | null;
  welcomeEmail: string;
  expiryNotice: string;
  expiryDate: string | null;
}

export interface UpdatePamRegistrationDto {
  nombres?: string;
  apellidos?: string;
  dni?: string;
  celular?: string;
  correo?: string;
  direccion?: string;
  ciudad?: string;
  distrito?: string;
  genero?: string;
  fechaNacimiento?: string;
  comoTeEnteraste?: string;
  plan?: string;
  frecuencia?: string;
  checkoutUrl?: string;
  aceptaPrivacidad?: boolean;
  mpStatus?: string;
  welcomeEmail?: string;
  expiryNotice?: string;
  expiryDate?: string;
}

export interface PamAdminStateDto {
  settings: { id: string; benefits: string[]; notes: string[] };
  plans: PamPlanDto[];
  registrations: PamRegistrationDto[];
  popup: MuseoPopupSettingsDto;
}
