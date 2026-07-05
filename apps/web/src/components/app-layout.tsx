import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  HardDrive,
  Heart,
  Landmark,
  KeyRound,
  Link2,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Users,
} from 'lucide-react';
import type { AppModule } from '@mali-one/shared';
import { useAuth } from '@/contexts/auth-context';
import { MaliLogo } from '@/components/mali-logo';
import { Sheet, SheetContent } from '@/components/ui';
import { hasModule } from '@/lib/user-modules';
import { cn } from '@/lib/utils';

const navItems: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  module?: AppModule;
  superAdminOnly?: boolean;
}[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/links', label: 'Enlaces y QR', icon: Link2, module: 'links' },
  {
    to: '/admin/users',
    label: 'Usuarios Workspace',
    icon: Users,
    module: 'workspace_users',
  },
  {
    to: '/admin/app-users',
    label: 'Accesos MALI ONE',
    icon: Shield,
    superAdminOnly: true,
  },
  {
    to: '/admin/s3',
    label: 'Gestor S3',
    icon: HardDrive,
    module: 's3_manager',
  },
  {
    to: '/vault',
    label: 'Bóveda de Contraseñas',
    icon: KeyRound,
    module: 'password_vault',
  },
  {
    to: '/admin/widgets/educacion',
    label: 'Widgets Educación',
    icon: GraduationCap,
    module: 'widget_educacion',
  },
  {
    to: '/admin/widgets/biblioteca',
    label: 'Widgets Biblioteca',
    icon: BookOpen,
    module: 'widget_biblioteca',
  },
  {
    to: '/admin/widgets/museo',
    label: 'Widgets Museo',
    icon: Landmark,
    module: 'widget_museo',
  },
  {
    to: '/admin/pam',
    label: 'Membresías PAM',
    icon: Heart,
    module: 'pam_memberships',
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const items = navItems.filter((item) => {
    if (item.superAdminOnly) return user?.isSuperAdmin;
    if (item.module) return hasModule(user, item.module);
    return true;
  });

  return (
    <>
      <div className="mb-8">
        <MaliLogo linkToHome onNavigate={onNavigate} />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-border/60',
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-border pt-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          {user?.picture ? (
            <img src={user.picture} alt="" className="h-9 w-9 rounded-full" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-border text-sm">
              {user?.name?.[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-border/60 hover:text-foreground"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-card p-4">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 hover:bg-border/60"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <MaliLogo
            linkToHome
            showSubtitle={false}
            imageClassName="h-7"
            className="px-0"
          />
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
