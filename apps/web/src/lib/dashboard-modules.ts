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
import type { AppModule } from '@mali-one/shared';

export const moduleMeta: Record<
  AppModule,
  {
    to: string;
    icon: typeof Link2;
    group: 'operaciones' | 'widgets' | 'herramientas';
  }
> = {
  links: { to: '/links', icon: Link2, group: 'operaciones' },
  workspace_users: { to: '/admin/users', icon: Users, group: 'operaciones' },
  s3_manager: { to: '/admin/s3', icon: HardDrive, group: 'operaciones' },
  password_vault: { to: '/vault', icon: KeyRound, group: 'herramientas' },
  widget_educacion: {
    to: '/admin/widgets/educacion',
    icon: GraduationCap,
    group: 'widgets',
  },
  widget_biblioteca: {
    to: '/admin/widgets/biblioteca',
    icon: BookOpen,
    group: 'widgets',
  },
  widget_museo: { to: '/admin/widgets/museo', icon: Landmark, group: 'widgets' },
  pam_memberships: { to: '/admin/pam', icon: Heart, group: 'widgets' },
};

export const groupLabels: Record<string, string> = {
  operaciones: 'Operaciones',
  widgets: 'Widgets y sitios',
  herramientas: 'Herramientas',
};
