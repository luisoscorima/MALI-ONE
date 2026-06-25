import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { AppLayout } from '@/components/app-layout';
import { AdminGuard, AuthGuard } from '@/components/auth-guard';
import { AdminUsersPage } from '@/pages/admin-users-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { LinksPage } from '@/pages/links-page';
import { LoginPage } from '@/pages/login-page';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="links" element={<LinksPage />} />
              <Route element={<AdminGuard />}>
                <Route path="admin/users" element={<AdminUsersPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
