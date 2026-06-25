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
];
