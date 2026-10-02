export type UserRole = 'admin' | 'operator';

export type AppModule =
  | 'links'
  | 'workspace_users'
  | 's3_manager'
  | 'password_vault'
  | 'widget_educacion'
  | 'widget_biblioteca'
  | 'widget_museo'
  | 'widget_pam'
  | 'screen_cast'
  | 'bsale_reports'
  | 'mailing'
  | 'newsletters'
  | 'landings'
  | 'crm_pam'
  | 'crm_educacion'
  | 'catalog_educacion'
  | 'portfolio'
  | 'files';

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TodoEffort = 'xs' | 's' | 'm' | 'l' | 'xl';
export type PortfolioArea =
  | 'infraestructura'
  | 'aplicaciones'
  | 'datos'
  | 'seguridad'
  | 'contenidos'
  | 'otros';
export type PortfolioImpact = 'low' | 'medium' | 'high';
export type PortfolioProjectType =
  | 'estrategico'
  | 'tactico'
  | 'operativo'
  | 'mejora'
  | 'migracion'
  | 'otro';
export type TodoOrigin = 'internal' | 'request' | 'incident';
export type OperationalServiceStatus =
  | 'up'
  | 'degraded'
  | 'down'
  | 'maintenance';

export interface TodoTypeDto {
  id: string;
  name: string;
  color: string | null;
  active: boolean;
  sortOrder: number;
}

export interface TodoStatusDto {
  id: string;
  key: string;
  name: string;
  color: string | null;
  isDone: boolean;
  sortOrder: number;
}

export interface PortfolioProjectStatusDto {
  id: string;
  key: string;
  name: string;
  color: string | null;
  isClosed: boolean;
  sortOrder: number;
}

export interface PortfolioProjectSummaryDto {
  id: string;
  name: string;
}

export interface PortfolioProjectDto {
  id: string;
  name: string;
  detail: string | null;
  statusId: string;
  status: PortfolioProjectStatusDto;
  area: PortfolioArea;
  projectType: PortfolioProjectType;
  stakeholder: string | null;
  impact: PortfolioImpact;
  link: string | null;
  targetAt: string | null;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  sortOrder: number;
  archivedAt: string | null;
  progress: number;
  taskTotal: number;
  taskDone: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoItemDto {
  id: string;
  title: string;
  detail: string | null;
  typeId: string | null;
  type: TodoTypeDto | null;
  priority: TodoPriority;
  effort: TodoEffort | null;
  statusId: string;
  status: TodoStatusDto;
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  projectId: string | null;
  project: PortfolioProjectSummaryDto | null;
  area: PortfolioArea | null;
  origin: TodoOrigin;
  impact: PortfolioImpact;
  link: string | null;
  registeredAt: string;
  dueAt: string | null;
  scheduledAt: string | null;
  statusChangedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  sortOrder: number;
  timeSpentMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoMetaDto {
  types: TodoTypeDto[];
  statuses: TodoStatusDto[];
}

export interface PortfolioMetaDto {
  projectStatuses: PortfolioProjectStatusDto[];
  areas: PortfolioArea[];
}

export interface PortfolioDashboardDto {
  projectsActive: number;
  projectsInProgress: number;
  projectsPlanned: number;
  projectsBlocked: number;
  projectsClosed: number;
  areaDistribution: { area: PortfolioArea; count: number; percent: number }[];
  weekCompletedTasks: number;
  weekTimeMinutes: number;
  upcomingMilestones: {
    kind: 'project' | 'task';
    id: string;
    title: string;
    at: string;
    projectName?: string | null;
  }[];
  weekCompletedTitles: string[];
}

export interface OperationalServiceDto {
  id: string;
  name: string;
  status: OperationalServiceStatus;
  notes: string | null;
  sortOrder: number;
  ownerId: string;
  ownerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListTodosQuery {
  ownerId?: string;
  statusId?: string;
  typeId?: string;
  projectId?: string;
  area?: PortfolioArea;
  origin?: TodoOrigin;
  priority?: TodoPriority;
  includeDone?: boolean;
  includeArchived?: boolean;
  dueBefore?: string;
  dueAfter?: string;
}

export interface CreateTodoItemDto {
  title: string;
  detail?: string;
  typeId?: string | null;
  priority?: TodoPriority;
  effort?: TodoEffort | null;
  statusId?: string;
  projectId?: string | null;
  area?: PortfolioArea | null;
  origin?: TodoOrigin;
  impact?: PortfolioImpact;
  link?: string | null;
  dueAt?: string | null;
  scheduledAt?: string | null;
}

export interface UpdateTodoItemDto {
  title?: string;
  detail?: string | null;
  typeId?: string | null;
  priority?: TodoPriority;
  effort?: TodoEffort | null;
  statusId?: string;
  projectId?: string | null;
  area?: PortfolioArea | null;
  origin?: TodoOrigin;
  impact?: PortfolioImpact;
  link?: string | null;
  dueAt?: string | null;
  scheduledAt?: string | null;
  sortOrder?: number;
  archived?: boolean;
  timeSpentMinutes?: number;
}

export interface ListProjectsQuery {
  ownerId?: string;
  statusId?: string;
  area?: PortfolioArea;
  includeArchived?: boolean;
  includeClosed?: boolean;
}

export interface CreatePortfolioProjectDto {
  name: string;
  detail?: string;
  statusId?: string;
  area?: PortfolioArea;
  projectType?: PortfolioProjectType;
  stakeholder?: string | null;
  impact?: PortfolioImpact;
  link?: string | null;
  targetAt?: string | null;
}

export interface UpdatePortfolioProjectDto {
  name?: string;
  detail?: string | null;
  statusId?: string;
  area?: PortfolioArea;
  projectType?: PortfolioProjectType;
  stakeholder?: string | null;
  impact?: PortfolioImpact;
  link?: string | null;
  targetAt?: string | null;
  sortOrder?: number;
  archived?: boolean;
}

export interface ReorderProjectsDto {
  statusId: string;
  orderedIds: string[];
}

export interface CreateOperationalServiceDto {
  name: string;
  status?: OperationalServiceStatus;
  notes?: string | null;
  sortOrder?: number;
}

export interface UpdateOperationalServiceDto {
  name?: string;
  status?: OperationalServiceStatus;
  notes?: string | null;
  sortOrder?: number;
}

export interface ReorderTodosDto {
  statusId: string;
  orderedIds: string[];
}

export interface AddTodoTimeDto {
  minutes: number;
}

export interface CreateTodoTypeDto {
  name: string;
  color?: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateTodoTypeDto {
  name?: string;
  color?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface CreateTodoStatusDto {
  key: string;
  name: string;
  color?: string;
  isDone?: boolean;
  sortOrder?: number;
}

export interface UpdateTodoStatusDto {
  name?: string;
  color?: string | null;
  isDone?: boolean;
  sortOrder?: number;
}

export interface FilesListItemDto {
  name: string;
  path: string;
  isFolder: boolean;
  size: number | null;
  lastModified: string | null;
  locked: boolean;
}

export interface FilesListResultDto {
  path: string;
  items: FilesListItemDto[];
}

export interface FilesConfigDto {
  trashPath: string;
  protectedPaths: string[];
}

export type ScreenCastMediaType = 'image' | 'video' | 'gif';

export type ScreenCastOrientation =
  | 'LANDSCAPE'
  | 'PORTRAIT'
  | 'PORTRAIT_FLIPPED';

export function isScreenCastPortrait(
  orientation: ScreenCastOrientation | string | undefined,
): boolean {
  return orientation === 'PORTRAIT' || orientation === 'PORTRAIT_FLIPPED';
}

export interface ScreenCastPlaylistItemDto {
  id: string;
  playlistId: string;
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
  durationMs: number;
  sortOrder: number;
  activo: boolean;
}

export interface ScreenCastPlaylistMonitorRefDto {
  id: string;
  name: string;
  screenKey: string;
  photoUrl?: string | null;
  /** Live WebSocket presence; only set on list endpoints that enrich via gateway. */
  online?: boolean;
}

export interface ScreenCastPlaylistDto {
  id: string;
  name: string;
  activo: boolean;
  /** Soft crossfade between still images (image/gif). */
  crossfade: boolean;
  /** Subtle Ken Burns zoom/pan while a still image is on screen. */
  kenBurns: boolean;
  createdAt: string;
  updatedAt: string;
  items?: ScreenCastPlaylistItemDto[];
  /** First items for list thumbnails (mediaUrl + mediaType only). */
  previewItems?: ScreenCastPlaylistPreviewDto[];
  monitorCount?: number;
  /** Assigned monitors (for avatar stack / Live badge). */
  monitors?: ScreenCastPlaylistMonitorRefDto[];
}

export interface ScreenCastPlaylistPreviewDto {
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
}

export interface ScreenCastMonitorDto {
  id: string;
  screenKey: string;
  name: string;
  location: string | null;
  photoUrl?: string | null;
  orientation: ScreenCastOrientation;
  playlistId: string | null;
  playlistName?: string | null;
  /** First active item of the assigned playlist, if any. */
  playlistPreview?: ScreenCastPlaylistPreviewDto | null;
  /** Active schedule override right now, if any. */
  scheduleActive?: {
    endsAt: string;
    playlistId: string;
    playlistName: string;
  } | null;
  lastSeenAt: string | null;
  online: boolean;
  /** 0-based index of current slide when online, else null. */
  playbackIndex?: number | null;
  playbackTotal?: number | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenCastScheduleOverrideDto {
  id: string;
  monitorId: string;
  monitorName: string;
  screenKey: string;
  playlistId: string;
  playlistName: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenCastUploadResultDto {
  url: string;
  key: string;
  mediaType: ScreenCastMediaType;
  fileName: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
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
  /** Soft crossfade between still images when the playlist enables it. */
  crossfade: boolean;
  /** Subtle Ken Burns zoom/pan while a still image is on screen. */
  kenBurns: boolean;
  items: ScreenCastPublicItemDto[];
}

import { APP_PERMISSION_MODULES } from './permissions';

export type { AppPermission, PermissionAppModule } from './permissions';
export { APP_PERMISSION_MODULES };

export {
  EDUCACION_LEAD_FUENTE,
  EDUCACION_LEAD_SOURCE,
  normalizePersonName,
} from './educacion-leads';

export {
  formatLimaDateTime,
  normalizePamCelular,
  normalizePamDni,
  normalizePamEmail,
  normalizePamPlaceName,
  normalizePamRegistrationFields,
  planToPamSegmentSlug,
} from './pam-normalize';
export type {
  PamPlanSegmentSlug,
  PamRegistrationNormalizeInput,
} from './pam-normalize';

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

export const ACCENT_THEME_IDS = [
  'neutral',
  'amber',
  'terracotta',
  'emerald',
  'violet',
  'blue',
] as const;

export type AccentThemeId = (typeof ACCENT_THEME_IDS)[number];

/** Preset (`amber`) o color personalizado (`#3b82f6`). */
export type AccentThemeValue = AccentThemeId | string;

const ACCENT_HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isAccentThemeId(value: string): value is AccentThemeId {
  return (ACCENT_THEME_IDS as readonly string[]).includes(value);
}

export function isAccentHex(value: string): boolean {
  return ACCENT_HEX_RE.test(value);
}

/** Valida preset o #RRGGBB. */
export function isValidAccentTheme(value: string): boolean {
  return isAccentThemeId(value) || isAccentHex(value);
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  isSuperAdmin: boolean;
  modules: AppModule[];
  /** Color de interfaz: preset o #RRGGBB; null = aún no guardado. */
  accentTheme: string | null;
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

/** Screen-cast S3 picker: un solo bucket y prefijo inicial. */
export interface S3ScreenCastPickerConfigDto {
  bucket: string;
  defaultPrefix: string;
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
  archivedAt: string | null;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  tags: string[];
  catalogCurso?: { id: string; nombre: string } | null;
  catalogPrograma?: { id: string; nombre: string } | null;
  catalogSede?: { id: string; nombre: string } | null;
  qrStyle?: QrStyleDto | null;
  qrLogoKey?: string | null;
  qrBase64?: string;
}

export interface ShortLinksPageDto {
  items: ShortLinkDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  tags: string[];
}

export interface UpdateShortLinkDto {
  url?: string;
  phone?: string;
  text?: string;
  tags?: string[];
  catalogCursoId?: string | null;
  catalogProgramaId?: string | null;
  catalogSedeId?: string | null;
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
  forceChangePassword?: boolean;
}

export interface UpdateWorkspaceUserDto {
  primaryEmail?: string;
  givenName?: string;
  familyName?: string;
  suspended?: boolean;
  orgUnitPath?: string;
}

export interface ResetWorkspacePasswordDto {
  forceChangePassword?: boolean;
  signOutAfterReset?: boolean;
}

export interface ResetWorkspacePasswordResult {
  temporaryPassword: string;
  forceChangePassword: boolean;
  signedOut: boolean;
}

export interface AdminAuditLogDto {
  id: string;
  actorEmail: string;
  action: string;
  targetEmail: string | null;
  payload: unknown;
  createdAt: string;
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
  nombreSelector: string | null;
  brochureUrl: string;
  icon: string;
  sortOrder: number;
  showOnSelector: boolean;
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
  brochureUrl: string | null;
  sortOrder: number;
}

export interface EducacionSedeDto {
  id: string;
  slug: string;
  nombre: string;
  nombreMapa: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  horarioHtml: string | null;
  brochureUrl: string;
  icon: string;
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
  /** Slug de PamPaymentMethod (default mercado_pago en widget). */
  paymentMethod: string;
  aceptaPrivacidad: boolean;
  mpStatus: string | null;
  welcomeEmail: string;
  expiryNotice: string;
  expiryDate: string | null;
}

/** Único medio de pago de sistema / default del widget. */
export const PAM_DEFAULT_PAYMENT_METHOD = 'mercado_pago';

export interface PamPaymentMethodDto {
  id: string;
  slug: string;
  label: string;
  active: boolean;
  system: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePamPaymentMethodDto {
  label: string;
  slug?: string;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdatePamPaymentMethodDto {
  label?: string;
  active?: boolean;
  sortOrder?: number;
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
  paymentMethod?: string;
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
  paymentMethod?: string;
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
  | 'scheduled'
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

export type LandingStatus = 'draft' | 'published' | 'archived';

export type LandingBlockType =
  | 'hero'
  | 'text'
  | 'feature_list'
  | 'schedule'
  | 'faq'
  | 'cta'
  | 'lead_form'
  | 'footer';

export interface LandingBlock {
  id: string;
  type: LandingBlockType;
  enabled: boolean;
  data: Record<string, unknown>;
}

export interface LandingTheme {
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
  surface: string;
}

export interface LandingDocument {
  logoUrl: string;
  logoAlt: string;
  headerCtaLabel: string;
  theme: LandingTheme;
  blocks: LandingBlock[];
}

export interface LandingPageDto {
  id: string;
  slug: string;
  name: string;
  status: LandingStatus;
  content?: LandingDocument;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  publishedVersion: number;
  publishedAt: string | null;
  publicUrl: string | null;
  createdBy?: { name: string; email: string } | null;
  updatedBy?: { name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLandingPageDto {
  slug: string;
  name: string;
  content: LandingDocument;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
}

export interface UpdateLandingPageDto {
  name?: string;
  content?: LandingDocument;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
}

export interface LandingPreviewDto {
  name: string;
  content: LandingDocument;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
}

/**
 * Plantilla inicial basada exclusivamente en la ficha pública vigente de
 * Gestión Cultural. El contenido comercial debe revisarse por edición antes
 * de publicarse.
 */
export const DEFAULT_GESTION_CULTURAL_LANDING_CONTENT: LandingDocument = {
  logoUrl:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Educacion.png',
  logoAlt: 'MALI Educación',
  headerCtaLabel: 'Solicitar información',
  theme: {
    primary: '#5c1599',
    secondary: '#7f21c3',
    accent: '#e2008c',
    ink: '#101018',
    surface: '#f8f6fb',
  },
  blocks: [
    {
      id: 'hero',
      type: 'hero',
      enabled: true,
      data: {
        eyebrow: 'Extensión Profesional',
        title: 'Programa de Especialización en Gestión Cultural',
        body:
          'Formación integral para profesionalizar a quienes desean liderar, diseñar y gestionar proyectos culturales con impacto social, institucional y creativo.',
        imageUrl:
          'https://educacion.mali.pe/wp-content/uploads/2025/11/Gestion-Cultural.webp',
        imageAlt:
          'Gestor cultural presentando un proyecto durante la especialización en gestión cultural del MALI',
        ctaLabel: 'Quiero recibir información',
        facts: [
          { label: 'Duración', value: '9 meses · 280 horas académicas' },
          { label: 'Virtual', value: 'Inicio 25 de noviembre de 2026' },
          { label: 'Presencial', value: 'Inicio 26 de noviembre de 2026' },
        ],
      },
    },
    {
      id: 'programa',
      type: 'text',
      enabled: true,
      data: {
        eyebrow: 'Sobre el programa',
        title: 'Te contamos sobre el programa',
        body:
          'Desde 2008, el MALI forma gestores culturales con una visión estratégica, crítica y aplicada. A lo largo de 9 meses, los participantes adquieren herramientas prácticas para desarrollar proyectos culturales, analizar políticas culturales, gestionar organizaciones culturales y comprender el funcionamiento de la industria creativa en contextos locales y nacionales.',
      },
    },
    {
      id: 'beneficios',
      type: 'feature_list',
      enabled: true,
      data: {
        eyebrow: 'Beneficios',
        title: 'Una formación conectada con el sector cultural',
        intro: '',
        items: [
          {
            title: 'Experiencia docente',
            description:
              'Docentes con amplia experiencia nacional e internacional.',
          },
          {
            title: 'Red profesional',
            description:
              'Red de contactos profesionales en el sector cultural.',
          },
          {
            title: 'Enfoque aplicado',
            description:
              'Formación aplicada y alineada al contexto peruano.',
          },
          {
            title: 'Experiencia MALI',
            description:
              'Clases presenciales en el Museo de Arte de Lima.',
          },
        ],
      },
    },
    {
      id: 'metodologia',
      type: 'feature_list',
      enabled: true,
      data: {
        eyebrow: 'Metodología',
        title: 'Aprendizaje teórico y práctico',
        intro: '',
        items: [
          {
            title: 'Clases aplicadas',
            description: 'Clases con enfoque teórico-práctico.',
          },
          {
            title: 'Casos reales',
            description: 'Resolución de casos reales del sector cultural.',
          },
          {
            title: 'Trabajo colaborativo',
            description: 'Talleres aplicados y trabajo colaborativo.',
          },
          {
            title: 'Especialistas',
            description:
              'Charlas maestras con especialistas nacionales e internacionales.',
          },
          {
            title: 'Proyecto final',
            description:
              'Acompañamiento docente y asesorías para el proyecto final.',
          },
        ],
      },
    },
    {
      id: 'modalidades',
      type: 'schedule',
      enabled: true,
      data: {
        eyebrow: 'Modalidades',
        title: 'Elige cómo participar',
        items: [
          {
            title: 'Virtual',
            date: 'Inicio: 25 de noviembre de 2026',
            location: 'Av. Paseo Colón 125 · Museo de Arte de Lima',
            schedule:
              'Lunes y miércoles de 7:00 a 10:30 p. m. (30 min de break)',
          },
          {
            title: 'Presencial',
            date: 'Inicio: 26 de noviembre de 2026',
            location: 'Museo de Arte de Lima · Av. Paseo Colón 125',
            schedule:
              'Martes y jueves de 7:00 a 10:10 p. m. (10 min de break)',
          },
        ],
      },
    },
    {
      id: 'whatsapp',
      type: 'cta',
      enabled: true,
      data: {
        eyebrow: 'Atención Extensión Profesional',
        title: '¿Tienes consultas sobre el programa?',
        body: 'Nuestros asesores están listos para atender tus consultas.',
        label: 'Conversar por WhatsApp',
        url: 'https://api.whatsapp.com/send?phone=922172157&text=%C2%A1Hola+MALI+Educaci%C3%B3n%21+Deseo+informaci%C3%B3n+del+curso+Programa+de+Especializaci%C3%B3n+en+Gesti%C3%B3n+Cultural',
      },
    },
    {
      id: 'brochure',
      type: 'cta',
      enabled: true,
      data: {
        eyebrow: 'Información completa',
        title: 'Conoce todos los detalles del programa',
        body:
          'Revisa la información académica y práctica en el brochure oficial.',
        label: 'Descargar brochure',
        url: 'https://educacion.mali.pe/wp-content/uploads/2026/01/Brochure-Gestion-Cultural.pdf',
      },
    },
    {
      id: 'preguntas',
      type: 'faq',
      enabled: true,
      data: {
        eyebrow: 'Preguntas frecuentes',
        title: 'Resolvemos tus dudas',
        items: [
          {
            question: '¿Qué es la gestión cultural y para qué sirve?',
            answer:
              'Es el conjunto de estrategias para planificar, gestionar y desarrollar proyectos culturales con impacto social.',
          },
          {
            question: '¿Quién puede estudiar esta especialización?',
            answer:
              'Profesionales del sector cultural, funcionarios públicos y personas interesadas en la formación cultural.',
          },
          {
            question: '¿Necesito experiencia previa?',
            answer:
              'No. El programa parte de bases y avanza hacia la aplicación práctica.',
          },
          {
            question: '¿Qué certificado obtengo?',
            answer:
              'Un certificado de especialización otorgado por el Museo de Arte de Lima – MALI.',
          },
          {
            question: '¿Dónde se dictan las clases?',
            answer:
              'De forma presencial en el Museo de Arte de Lima y de forma virtual a través de la plataforma del MALI.',
          },
        ],
      },
    },
    {
      id: 'contacto',
      type: 'lead_form',
      enabled: true,
      data: {
        eyebrow: 'Conversemos',
        title: 'Quiero recibir información',
        body: 'Estamos listos para brindarte la asesoría que necesitas.',
        submitLabel: 'Enviar información',
        area: 'educacion_ep',
        courseSlug:
          'industrias-culturales-programa-especializacion-gestion-cultural',
        courseTitle: 'Programa de Especialización en Gestión Cultural',
        privacyUrl:
          'https://educacion.mali.pe/wp-content/uploads/2026/01/Uso_de_datos_Terminos_y_condiciones_Mali_Educacion_2026.pdf',
      },
    },
    {
      id: 'footer',
      type: 'footer',
      enabled: true,
      data: {
        text: 'MALI Educación · Museo de Arte de Lima',
      },
    },
  ],
};

export interface EmailCampaignDto {
  id: string;
  newsletterId: string;
  name: string;
  status: EmailCampaignStatus;
  audienceArea: string;
  audienceSegment: string | null;
  audienceSegments: string[];
  audienceExcludeSegments: string[];
  audienceAttrKey: string | null;
  audienceAttrValue: string | null;
  totalRecipients: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  errorCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateEmailCampaignDto {
  newsletterId: string;
  name: string;
  audienceArea?: string;
  /** @deprecated Prefer audienceSegments */
  audienceSegment?: string;
  audienceSegments?: string[];
  audienceExcludeSegments?: string[];
  audienceAttrKey?: string;
  audienceAttrValue?: string;
  /** ISO datetime; when set, campaign is created as scheduled. */
  scheduledAt?: string;
}

export interface PreviewEmailAudienceDto {
  audienceArea?: string;
  audienceSegments: string[];
  audienceExcludeSegments?: string[];
  audienceAttrKey?: string;
  audienceAttrValue?: string;
}

export interface EmailAudiencePreviewDto {
  total: number;
  area: string;
  sample: Array<{
    contact_id: number;
    email: string;
    name: string;
    last_name: string;
  }>;
}

export interface EmailCampaignStatsDto {
  openRate: number;
  clickRate: number;
  opensByDay: Array<{ day: string; count: number }>;
  clicksByDay: Array<{ day: string; count: number }>;
  campaign: EmailCampaignDto;
}
