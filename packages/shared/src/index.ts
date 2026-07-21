export type UserRole = 'admin' | 'operator';

export type AppModule =
  | 'links'
  | 'workspace_users'
  | 's3_manager'
  | 'password_vault'
  | 'widget_educacion'
  | 'widget_biblioteca'
  | 'widget_museo'
  | 'pam_memberships'
  | 'screen_cast'
  | 'bsale_reports'
  | 'mailing'
  | 'newsletters'
  | 'crm_pam';

export type ScreenCastMediaType = 'image' | 'video' | 'gif';

export type ScreenCastOrientation = 'LANDSCAPE' | 'PORTRAIT';

export interface ScreenCastPlaylistItemDto {
  id: string;
  playlistId: string;
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
  durationMs: number;
  sortOrder: number;
  activo: boolean;
}

export interface ScreenCastPlaylistDto {
  id: string;
  name: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  items?: ScreenCastPlaylistItemDto[];
  monitorCount?: number;
}

export interface ScreenCastMonitorDto {
  id: string;
  screenKey: string;
  name: string;
  location: string | null;
  orientation: ScreenCastOrientation;
  playlistId: string | null;
  playlistName?: string | null;
  lastSeenAt: string | null;
  online: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenCastPublicItemDto {
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
  durationMs: number;
}

export interface ScreenCastPublicConfigDto {
  screenKey: string;
  name: string;
  orientation: ScreenCastOrientation;
  empty: boolean;
  playlistId: string | null;
  playlistName: string | null;
  items: ScreenCastPublicItemDto[];
}

import { APP_PERMISSION_MODULES } from './permissions';

export type { AppPermission, PermissionAppModule } from './permissions';
export { APP_PERMISSION_MODULES };

import type { QrStyleDto } from './qr-style';
export type {
  QrStyleDto,
  QrBodyShape,
  QrEyeFrameShape,
  QrEyeShape,
  LinkStatsDto,
} from './qr-style';
export { DEFAULT_QR_STYLE } from './qr-style';
export type { QrLogoPresetId } from './qr-logo-presets';
export { QR_LOGO_PRESETS } from './qr-logo-presets';

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
  qrStyle?: QrStyleDto | null;
  qrLogoKey?: string | null;
  qrBase64?: string;
}

export interface UpdateShortLinkDto {
  url?: string;
  phone?: string;
  text?: string;
  tags?: string[];
}

export interface BulkLinkRowError {
  row: number;
  message: string;
}

export interface BulkLinksResultDto {
  created: ShortLinkDto[];
  errors: BulkLinkRowError[];
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
  icon: string;
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
  /** mercado_pago | niubiz | izipay | otro */
  paymentGateway: string;
  aceptaPrivacidad: boolean;
  mpStatus: string | null;
  welcomeEmail: string;
  expiryNotice: string;
  expiryDate: string | null;
}

export const PAM_PAYMENT_GATEWAYS = [
  'mercado_pago',
  'niubiz',
  'izipay',
  'otro',
] as const;

export type PamPaymentGateway = (typeof PAM_PAYMENT_GATEWAYS)[number];

export const PAM_PAYMENT_GATEWAY_LABELS: Record<PamPaymentGateway, string> = {
  mercado_pago: 'Mercado Pago',
  niubiz: 'Niubiz',
  izipay: 'Izipay',
  otro: 'Otro',
};

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
  paymentGateway?: string;
  aceptaPrivacidad?: boolean;
  mpStatus?: string;
  welcomeEmail?: string;
  expiryNotice?: string;
  expiryDate?: string;
}

export interface CreatePamPaymentDto {
  nombres: string;
  apellidos: string;
  dni: string;
  celular: string;
  correo: string;
  direccion?: string;
  ciudad?: string;
  distrito?: string;
  genero?: string;
  fechaNacimiento?: string;
  comoTeEnteraste?: string;
  plan: string;
  frecuencia: string;
  paymentGateway?: string;
  checkoutUrl?: string;
  mpStatus?: string;
  expiryDate?: string;
  aceptaPrivacidad?: boolean;
}

export interface PamAdminStateDto {
  settings: { id: string; benefits: string[]; notes: string[] };
  plans: PamPlanDto[];
  registrations: PamRegistrationDto[];
  popup: MuseoPopupSettingsDto;
}

export type BsaleKardexMovementType =
  | 'document'
  | 'reception'
  | 'consumption'
  | 'opening'
  | 'ending'
  | 'transfer'
  | 'omission';

export interface BsaleOfficeDto {
  id: number;
  name: string;
  address: string;
  isVirtual: boolean;
  state: number;
}

export interface BsaleKardexQueryDto {
  from: string;
  to: string;
  officeIds?: number[];
  /** Incluir filas sintéticas de saldo inicial. Default true. */
  includeOpening?: boolean;
  /** Incluir filas sintéticas de saldo final. Default true. */
  includeEnding?: boolean;
  /** Etiquetar pares despacho interno como traslado. Default true. */
  includeTransfer?: boolean;
  /**
   * Añade filas por salidas de despacho interno sin recepción pareja
   * (olvidaron registrar la entrada). Al sumar endings + omisiones se
   * obtiene el saldo real del producto. Default false.
   */
  forceOmission?: boolean;
  /**
   * Invalida la caché del servidor y vuelve a consultar Bsale.
   * Solo debe enviarse en el primer poll de una sincronización forzada.
   */
  refresh?: boolean;
}

export interface BsaleKardexExportDto extends BsaleKardexQueryDto {
  format: 'csv' | 'xlsx';
}

export interface BsaleKardexMovementDto {
  date: number;
  dateIso: string;
  officeId: number;
  officeName: string;
  movementType: BsaleKardexMovementType;
  documentLabel: string;
  documentNumber: string;
  documentId: number | null;
  variantId: number;
  sku: string;
  productName: string;
  entryQty: number;
  exitQty: number;
  balanceQty: number;
  unitCost: number | null;
}

export interface BsaleKardexResultDto {
  from: string;
  to: string;
  officeIds: number[];
  totalMovements: number;
  movements: BsaleKardexMovementDto[];
}

/** Respuesta corta de POST /api/bsale/kardex (polling; evita 504 en proxies). */
export type BsaleKardexJobDto =
  | { status: 'ready'; data: BsaleKardexResultDto }
  | { status: 'pending'; startedAt: number }
  | { status: 'error'; message: string };

export type NewsletterStatus = 'draft' | 'published';
export type EmailCampaignStatus =
  | 'draft'
  | 'queued'
  | 'sending'
  | 'completed'
  | 'failed';

export interface NewsletterDto {
  id: string;
  slug: string;
  title: string;
  subject: string;
  htmlBody: string;
  /** GrapesJS project JSON for re-editing. */
  designJson?: string | null;
  status: NewsletterStatus;
  createdAt: string;
  updatedAt: string;
  publicUrl?: string;
}

export interface CreateNewsletterDto {
  slug: string;
  title: string;
  subject: string;
  htmlBody: string;
  designJson?: string | null;
  status?: NewsletterStatus;
}

export interface UpdateNewsletterDto {
  title?: string;
  subject?: string;
  htmlBody?: string;
  designJson?: string | null;
  status?: NewsletterStatus;
}

export interface EmailCampaignDto {
  id: string;
  newsletterId: string;
  name: string;
  status: EmailCampaignStatus;
  audienceArea: string;
  audienceSegment: string | null;
  audienceAttrKey: string | null;
  audienceAttrValue: string | null;
  totalRecipients: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  errorCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateEmailCampaignDto {
  newsletterId: string;
  name: string;
  audienceArea?: string;
  audienceSegment?: string;
  audienceAttrKey?: string;
  audienceAttrValue?: string;
}

export interface EmailCampaignStatsDto {
  openRate: number;
  clickRate: number;
  opensByDay: Array<{ day: string; count: number }>;
  clicksByDay: Array<{ day: string; count: number }>;
  campaign: EmailCampaignDto;
}
