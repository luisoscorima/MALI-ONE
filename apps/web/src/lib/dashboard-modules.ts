import type { AppModule } from '@mali-one/shared';
import {
  BookOpen,
  GraduationCap,
  HardDrive,
  Heart,
  KeyRound,
  Landmark,
  Link2,
  Mail,
  MonitorPlay,
  PackageSearch,
  Users,
  Newspaper,
  Contact,
} from 'lucide-react';
import type { ModuleCardAccent } from '@/lib/module-card-accents';

export const moduleMeta: Record<
  AppModule,
  {
    to: string;
    icon: typeof Link2;
    group: 'operaciones' | 'widgets' | 'herramientas';
    accent: ModuleCardAccent;
  }
> = {
  links: { to: '/links', icon: Link2, group: 'operaciones', accent: 'blue' },
  workspace_users: {
    to: '/admin/users',
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
  pam_memberships: {
    to: '/admin/pam',
    icon: Heart,
    group: 'widgets',
    accent: 'rose',
  },
  newsletters: {
    to: '/admin/newsletters',
    icon: Newspaper,
    group: 'operaciones',
    accent: 'blue',
  },
  crm_pam: {
    to: '/admin/crm-pam',
    icon: Contact,
    group: 'operaciones',
    accent: 'violet',
  },
  mailing: {
    to: '/admin/newsletters',
    icon: Mail,
    group: 'operaciones',
    accent: 'blue',
  },
};

export const groupLabels: Record<string, string> = {
  operaciones: 'Operaciones',
  widgets: 'Widgets y sitios',
  herramientas: 'Herramientas',
};
