import type { AppModule } from '@mali-one/shared';
import {
  BookOpen,
  GraduationCap,
  HardDrive,
  Heart,
  KeyRound,
  Landmark,
  Link2,
  Users,
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
};

export const groupLabels: Record<string, string> = {
  operaciones: 'Operaciones',
  widgets: 'Widgets y sitios',
  herramientas: 'Herramientas',
};
