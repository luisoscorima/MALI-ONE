import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { AccentThemeProvider } from '@/contexts/accent-theme-context';
import { ToastProvider } from '@/contexts/toast-context';
import { ConfirmProvider } from '@/hooks/use-confirm';
import { TooltipProvider } from '@/components/ui';
import { AppLayout } from '@/components/app-layout';
import { AuthGuard, ModuleGuard, SuperAdminGuard } from '@/components/auth-guard';
import { AdminUsersPage } from '@/pages/admin-users-page';
import { AppUsersPage } from '@/pages/app-users-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { LinksPage } from '@/pages/links-page';
import { LoginPage } from '@/pages/login-page';
import { PasswordVaultPage } from '@/pages/password-vault-page';
import { S3ManagerPage } from '@/pages/s3-manager-page';
import { ScreenCastAdminPage } from '@/pages/screen-cast-admin-page';
import { ScreenCastPlayerPage } from '@/pages/screen-cast-player-page';
import { WidgetBibliotecaCarruselPage } from '@/pages/widget-biblioteca-carrusel-page';
import { WidgetBibliotecaHubPage } from '@/pages/widget-biblioteca-hub-page';
import { WidgetEducacionAliadosPage } from '@/pages/widget-educacion-aliados-page';
import { WidgetEducacionCalendarioPage } from '@/pages/widget-educacion-calendario-page';
import { WidgetEducacionHubPage } from '@/pages/widget-educacion-hub-page';
import { WidgetEducacionMapaPage } from '@/pages/widget-educacion-mapa-page';
import { WidgetEducacionPopupPage } from '@/pages/widget-educacion-popup-page';
import { WidgetEducacionSelectorPage } from '@/pages/widget-educacion-selector-page';
import { WidgetMuseoHubPage } from '@/pages/widget-museo-hub-page';
import { WidgetMuseoInterfazPage } from '@/pages/widget-museo-interfaz-page';
import { PamMembershipsPage } from '@/pages/pam-memberships-page';
import { WidgetMuseoPopupPage } from '@/pages/widget-museo-popup-page';

/** Authenticated app shell — not mounted on the public kiosk player. */
function AuthenticatedApp() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <TooltipProvider>
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
                  <Route element={<ModuleGuard module="screen_cast" />}>
                    <Route
                      path="admin/screen-cast"
                      element={<ScreenCastAdminPage />}
                    />
                    <Route
                      path="admin/screen-cast/*"
                      element={<Navigate to="/admin/screen-cast" replace />}
                    />
                  </Route>
                  <Route element={<ModuleGuard module="password_vault" />}>
                    <Route path="vault" element={<PasswordVaultPage />} />
                  </Route>
                  <Route element={<ModuleGuard module="widget_educacion" />}>
                    <Route
                      path="admin/widgets/educacion"
                      element={<WidgetEducacionHubPage />}
                    />
                    <Route
                      path="admin/widgets/educacion/calendario"
                      element={<WidgetEducacionCalendarioPage />}
                    />
                    <Route
                      path="admin/widgets/educacion/mapa"
                      element={<WidgetEducacionMapaPage />}
                    />
                    <Route
                      path="admin/widgets/educacion/selector"
                      element={<WidgetEducacionSelectorPage />}
                    />
                    <Route
                      path="admin/widgets/educacion/popup"
                      element={<WidgetEducacionPopupPage />}
                    />
                    <Route
                      path="admin/widgets/educacion/aliados"
                      element={<WidgetEducacionAliadosPage />}
                    />
                  </Route>
                  <Route element={<ModuleGuard module="widget_biblioteca" />}>
                    <Route
                      path="admin/widgets/biblioteca"
                      element={<WidgetBibliotecaHubPage />}
                    />
                    <Route
                      path="admin/widgets/biblioteca/carrusel"
                      element={<WidgetBibliotecaCarruselPage />}
                    />
                  </Route>
                  <Route element={<ModuleGuard module="widget_museo" />}>
                    <Route
                      path="admin/widgets/museo"
                      element={<WidgetMuseoHubPage />}
                    />
                    <Route
                      path="admin/widgets/museo/popup"
                      element={<WidgetMuseoPopupPage />}
                    />
                    <Route
                      path="admin/widgets/museo/interfaz-sistemas"
                      element={<WidgetMuseoInterfazPage />}
                    />
                    <Route
                      path="admin/widgets/museo/membership"
                      element={<Navigate to="/admin/pam" replace />}
                    />
                    <Route
                      path="admin/widgets/pam"
                      element={<Navigate to="/admin/pam" replace />}
                    />
                    <Route
                      path="admin/widgets/pam/*"
                      element={<Navigate to="/admin/pam" replace />}
                    />
                  </Route>
                  <Route element={<ModuleGuard module="pam_memberships" />}>
                    <Route path="admin/pam" element={<PamMembershipsPage />} />
                  </Route>
                  <Route element={<SuperAdminGuard />}>
                    <Route path="admin/app-users" element={<AppUsersPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </TooltipProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export function App() {
  return (
    <AccentThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Public kiosk — outside AuthProvider to avoid /api/auth/me 401 */}
          <Route path="/screen-cast" element={<ScreenCastPlayerPage />} />
          <Route path="*" element={<AuthenticatedApp />} />
        </Routes>
      </BrowserRouter>
    </AccentThemeProvider>
  );
}
