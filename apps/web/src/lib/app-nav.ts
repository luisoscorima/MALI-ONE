import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  GraduationCap,
  HardDrive,
  Heart,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Link2,
  MonitorPlay,
  PackageSearch,
  Shield,
  Users,
  Newspaper,
  Contact,
} from 'lucide-react';
import type { AppModule, AuthUser } from '@mali-one/shared';
import { hasModule } from '@/lib/user-modules';

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  module?: AppModule;
  superAdminOnly?: boolean;
};

export type AppNavSection = {
  label: string;
  items: AppNavItem[];
};

export const appNavSections: AppNavSection[] = [
  {
    label: 'General',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/links', label: 'Enlaces y QR', icon: Link2, module: 'links' },
      {
        to: '/admin/users',
        label: 'Usuarios Workspace',
        icon: Users,
        module: 'workspace_users',
      },
      {
        to: '/admin/s3',
        label: 'Gestor S3',
        icon: HardDrive,
        module: 's3_manager',
      },
      {
        to: '/admin/screen-cast',
        label: 'Transmisión a pantallas',
        icon: MonitorPlay,
        module: 'screen_cast',
      },
      {
        to: '/vault',
        label: 'Bóveda de Contraseñas',
        icon: KeyRound,
        module: 'password_vault',
      },
      {
        to: '/bsale/kardex',
        label: 'Kardex Bsale',
        icon: PackageSearch,
        module: 'bsale_reports',
      },
      {
        to: '/admin/newsletters',
        label: 'Boletines',
        icon: Newspaper,
        module: 'newsletters',
      },
      {
        to: '/admin/crm-pam',
        label: 'CRM PAM',
        icon: Contact,
        module: 'crm_pam',
      },
    ],
  },
  {
    label: 'Widgets',
    items: [
      {
        to: '/admin/widgets/educacion',
        label: 'Educación',
        icon: GraduationCap,
        module: 'widget_educacion',
      },
      {
        to: '/admin/widgets/biblioteca',
        label: 'Biblioteca',
        icon: BookOpen,
        module: 'widget_biblioteca',
      },
      {
        to: '/admin/widgets/museo',
        label: 'Museo',
        icon: Landmark,
        module: 'widget_museo',
      },
      {
        to: '/admin/pam',
        label: 'Membresías PAM',
        icon: Heart,
        module: 'pam_memberships',
      },
    ],
  },
  {
    label: 'Administración',
    items: [
      {
        to: '/admin/app-users',
        label: 'Accesos MALI ONE',
        icon: Shield,
        superAdminOnly: true,
      },
    ],
  },
];

export function getVisibleNavSections(user: AuthUser | null): AppNavSection[] {
  return appNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.superAdminOnly) return user?.isSuperAdmin;
        if (item.module) return hasModule(user, item.module);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export function isNavItemActive(
  pathname: string,
  item: AppNavItem,
): boolean {
  if (item.end) return pathname === item.to;
  if (item.to === '/') return pathname === '/';
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
