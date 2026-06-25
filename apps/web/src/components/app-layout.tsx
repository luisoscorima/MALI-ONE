import { NavLink, Outlet } from 'react-router-dom';
import { Link2, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/links', label: 'Enlaces y QR', icon: Link2 },
  { to: '/admin/users', label: 'Usuarios Workspace', icon: Users, adminOnly: true },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-border bg-card p-4">
        <div className="mb-8 px-2">
          <h1 className="text-xl font-bold tracking-tight">MALI ONE</h1>
          <p className="text-xs text-muted">Operaciones internas</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
              <img
                src={user.picture}
                alt=""
                className="h-9 w-9 rounded-full"
              />
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
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
