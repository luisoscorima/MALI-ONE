import type { AppModule } from '@mali-one/shared';
import {
  BookOpen,
  GraduationCap,
  HardDrive,
  Heart,
  KeyRound,
  Landmark,
  Library,
  Link2,
  ListTodo,
  Mail,
  MonitorPlay,
  PanelsTopLeft,
  PackageSearch,
  Users,
  Newspaper,
  Contact,
  FolderOpen,
  Database,
} from 'lucide-react';
import {
  EMAIL_HUB_PATH,
  MALICHIMP_PATH,
  WORKSPACE_PATH,
} from '@/lib/email-admin-routes';
import type { ModuleCardAccent } from '@/lib/module-card-accents';

export const moduleMeta: Record<
  AppModule,
  {
    to: string;
    icon: typeof Link2;
    group:
      | 'operaciones'
      | 'finanzas'
      | 'contenido'
      | 'crms'
      | 'widgets'
      | 'herramientas'
      | 'general';
    accent: ModuleCardAccent;
  }
> = {
  treasury: { to: '/treasury', icon: Landmark, group: 'finanzas', accent: 'emerald' },
  portfolio: {
    to: '/portfolio',
    icon: ListTodo,
    group: 'general',
    accent: 'blue',
  },
  links: { to: '/links', icon: Link2, group: 'operaciones', accent: 'blue' },
  google_workspace: {
    to: WORKSPACE_PATH,
    icon: Users,
    group: 'operaciones',
    accent: 'violet',
  },
  s3_manager: {
    to: '/admin/s3',
    icon: HardDrive,
    group: 'operaciones',
    accent: 'emerald',
  },
  files: {
    to: '/files',
    icon: FolderOpen,
    group: 'operaciones',
    accent: 'emerald',
  },
  screen_cast: {
    to: '/admin/screen-cast',
    icon: MonitorPlay,
    group: 'operaciones',
    accent: 'cyan',
  },
  bsale_reports: {
    to: '/bsale/kardex',
    icon: PackageSearch,
    group: 'operaciones',
    accent: 'emerald',
  },
  password_vault: {
    to: '/vault',
    icon: KeyRound,
    group: 'herramientas',
    accent: 'amber',
  },
  widget_educacion: {
    to: '/admin/widgets/educacion',
    icon: GraduationCap,
    group: 'widgets',
    accent: 'cyan',
  },
  widget_biblioteca: {
    to: '/admin/widgets/biblioteca',
    icon: BookOpen,
    group: 'widgets',
    accent: 'blue',
  },
  widget_museo: {
    to: '/admin/widgets/museo',
    icon: Landmark,
    group: 'widgets',
    accent: 'violet',
  },
  widget_pam: {
    to: '/admin/widget-pam',
    icon: Heart,
    group: 'widgets',
    accent: 'rose',
  },
  landings: {
    to: '/admin/landings',
    icon: PanelsTopLeft,
    group: 'contenido',
    accent: 'violet',
  },
  email_hub: {
    to: EMAIL_HUB_PATH,
    icon: Newspaper,
    group: 'crms',
    accent: 'blue',
  },
  malichimp: {
    to: MALICHIMP_PATH,
    icon: Database,
    group: 'crms',
    accent: 'emerald',
  },
  crm_pam: {
    to: '/admin/crm-pam',
    icon: Contact,
    group: 'crms',
    accent: 'violet',
  },
  crm_educacion: {
    to: '/admin/crm-educacion',
    icon: GraduationCap,
    group: 'crms',
    accent: 'cyan',
  },
  catalog_educacion: {
    to: '/admin/catalogo-educacion',
    icon: Library,
    group: 'crms',
    accent: 'emerald',
  },
  mailing: {
    to: EMAIL_HUB_PATH,
    icon: Mail,
    group: 'crms',
    accent: 'blue',
  },
};

export const groupLabels: Record<string, string> = {
  general: 'General',
  finanzas: 'Finanzas',
  operaciones: 'Operaciones',
  contenido: 'Contenido',
  crms: 'CRMs',
  widgets: 'Widgets y sitios',
  herramientas: 'Herramientas',
};
