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
import { PasswordVaultPage } from '@/pages/password-vault-page';
import { S3ManagerPage } from '@/pages/s3-manager-page';
import { WidgetBibliotecaCarruselPage } from '@/pages/widget-biblioteca-carrusel-page';
import { WidgetBibliotecaHubPage } from '@/pages/widget-biblioteca-hub-page';
import { WidgetEducacionCalendarioPage } from '@/pages/widget-educacion-calendario-page';
import { WidgetEducacionHubPage } from '@/pages/widget-educacion-hub-page';
import { WidgetEducacionMapaPage } from '@/pages/widget-educacion-mapa-page';
import { WidgetEducacionSelectorPage } from '@/pages/widget-educacion-selector-page';
import { WidgetMuseoHubPage } from '@/pages/widget-museo-hub-page';
import { WidgetMuseoInterfazPage } from '@/pages/widget-museo-interfaz-page';
import { WidgetMuseoMembershipPage } from '@/pages/widget-museo-membership-page';

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
              <Route element={<ModuleGuard module="password_vault" />}>
                <Route path="vault" element={<PasswordVaultPage />} />
              </Route>
              <Route element={<ModuleGuard module="widget_educacion" />}>
                <Route path="admin/widgets/educacion" element={<WidgetEducacionHubPage />} />
                <Route path="admin/widgets/educacion/calendario" element={<WidgetEducacionCalendarioPage />} />
                <Route path="admin/widgets/educacion/mapa" element={<WidgetEducacionMapaPage />} />
                <Route path="admin/widgets/educacion/selector" element={<WidgetEducacionSelectorPage />} />
              </Route>
              <Route element={<ModuleGuard module="widget_biblioteca" />}>
                <Route path="admin/widgets/biblioteca" element={<WidgetBibliotecaHubPage />} />
                <Route path="admin/widgets/biblioteca/carrusel" element={<WidgetBibliotecaCarruselPage />} />
              </Route>
              <Route element={<ModuleGuard module="widget_pam" />}>
                <Route path="admin/widgets/museo" element={<WidgetMuseoHubPage />} />
                <Route path="admin/widgets/museo/membership" element={<WidgetMuseoMembershipPage />} />
                <Route path="admin/widgets/museo/interfaz-sistemas" element={<WidgetMuseoInterfazPage />} />
                <Route path="admin/widgets/pam" element={<Navigate to="/admin/widgets/museo" replace />} />
                <Route path="admin/widgets/pam/*" element={<Navigate to="/admin/widgets/museo" replace />} />
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
