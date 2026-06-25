import { Navigate, Outlet } from 'react-router-dom';
import type { AppModule } from '@mali-one/shared';
import { useAuth } from '@/contexts/auth-context';
import { hasModule } from '@/lib/user-modules';

export function AuthGuard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function SuperAdminGuard() {
  const { user } = useAuth();
  if (!user?.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function ModuleGuard({ module }: { module: AppModule }) {
  const { user } = useAuth();
  if (!hasModule(user, module)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** @deprecated Usa SuperAdminGuard o ModuleGuard según el caso */
export function AdminGuard() {
  return <SuperAdminGuard />;
}
