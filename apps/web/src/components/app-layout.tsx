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

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  module?: AppModule;
  superAdminOnly?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
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
        to: '/vault',
        label: 'Bóveda de Contraseñas',
        icon: KeyRound,
        module: 'password_vault',
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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.superAdminOnly) return user?.isSuperAdmin;
        if (item.module) return hasModule(user, item.module);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <div className="mb-6 px-1">
        <MaliLogo linkToHome onNavigate={onNavigate} />
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {visibleSections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-sidebar-primary-foreground/80" />
                      )}
                      <item.icon size={17} strokeWidth={isActive ? 2.25 : 2} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-4">
        <div className="mb-2 flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-2 py-2">
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full ring-2 ring-sidebar-border"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium">
              {user?.name?.[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut size={17} />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-4">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
