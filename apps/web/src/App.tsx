import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { ToastProvider } from '@/contexts/toast-context';
import { AppLayout } from '@/components/app-layout';
import { AuthGuard, ModuleGuard, SuperAdminGuard } from '@/components/auth-guard';
import { AdminUsersPage } from '@/pages/admin-users-page';
import { AppUsersPage } from '@/pages/app-users-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { LinksPage } from '@/pages/links-page';
import { LoginPage } from '@/pages/login-page';
import { S3ManagerPage } from '@/pages/s3-manager-page';

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route element={<ModuleGuard module="links" />}>
                <Route path="links" element={<LinksPage />} />
              </Route>
              <Route element={<ModuleGuard module="workspace_users" />}>
                <Route path="admin/users" element={<AdminUsersPage />} />
              </Route>
              <Route element={<ModuleGuard module="s3_manager" />}>
                <Route path="admin/s3" element={<S3ManagerPage />} />
              </Route>
              <Route element={<SuperAdminGuard />}>
                <Route path="admin/app-users" element={<AppUsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
