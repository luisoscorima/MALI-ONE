/** Permisos recurso.acción; hoy se resuelven contra AppModule hasta RBAC completo. */
export const APP_PERMISSION_MODULES = {
  'pam.settings.manage': 'pam_memberships',
  'pam.planes.manage': 'pam_memberships',
  'pam.registros.read': 'crm_pam',
  'pam.registros.manage': 'crm_pam',
  'widgets.museo.popup.manage': 'widget_museo',
} as const;

export type AppPermission = keyof typeof APP_PERMISSION_MODULES;

export type PermissionAppModule =
  (typeof APP_PERMISSION_MODULES)[AppPermission];
