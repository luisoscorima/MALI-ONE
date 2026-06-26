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
    id: 'widget_pam',
    label: 'Widgets Museo',
    description: 'Membresías PAM y widgets para mali.pe/es.',
  },
];
