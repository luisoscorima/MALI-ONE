import type { AppModule } from '@mali-one/shared';

export const APP_MODULES: {
  id: AppModule;
  label: string;
  description: string;
}[] = [
  {
    id: 'links',
    label: 'Enlaces y QR',
    description: 'Acortar URLs, generar QR y subir archivos.',
  },
  {
    id: 'workspace_users',
    label: 'Usuarios Workspace',
    description: 'Gestión de cuentas Google Workspace.',
  },
  {
    id: 's3_manager',
    label: 'Gestor S3',
    description: 'Explorar buckets y archivos en AWS.',
  },
  {
    id: 'password_vault',
    label: 'Bóveda de Contraseñas',
    description: 'Acceder a Vaultwarden para gestionar credenciales.',
  },
  {
    id: 'widget_educacion',
    label: 'Widgets Educación',
    description: 'Mapa, selector y calendario para educacion.mali.pe.',
  },
  {
    id: 'widget_biblioteca',
    label: 'Widgets Biblioteca',
    description: 'Carrusel Koha para biblioteca.mali.pe.',
  },
  {
    id: 'widget_museo',
    label: 'Widgets Museo',
    description: 'Popup e interfaz embebible en mali.pe/es.',
  },
  {
    id: 'pam_memberships',
    label: 'Membresías PAM',
    description: 'Planes, beneficios, registros y pagos del programa.',
  },
  {
    id: 'screen_cast',
    label: 'Transmisión a pantallas',
    description: 'Playlists y monitores para tótems y quioscos.',
  },
  {
    id: 'bsale_reports',
    label: 'Reportes Bsale',
    description: 'Kardex consolidado de stock por almacén y período.',
  },
];
