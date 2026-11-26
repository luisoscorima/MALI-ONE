import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/auth-context';
import { AccentThemeProvider } from '@/contexts/accent-theme-context';
import { ToastProvider } from '@/contexts/toast-context';
import { ConfirmProvider } from '@/hooks/use-confirm';
import { TooltipProvider } from '@/components/ui';
import { AccentThemeUserSync } from '@/components/accent-theme-user-sync';
import { ColorSchemeProvider } from '@/components/color-scheme-provider';
import { AppLayout } from '@/components/app-layout';
import { AuthGuard, ModuleGuard, SuperAdminGuard } from '@/components/auth-guard';
import { LegacyEmailAdminRedirect } from '@/components/legacy-email-admin-redirect';
import { PageLoading } from '@/components/feedback';
import {
  EMAIL_HUB_PATH,
  MALICHIMP_PATH,
  WORKSPACE_PATH,
} from '@/lib/email-admin-routes';
import { lazyPage } from '@/lib/lazy-page';

const LoginPage = lazyPage(() => import('@/pages/login-page'), 'LoginPage');
const DashboardPage = lazyPage(
  () => import('@/pages/dashboard-page'),
  'DashboardPage',
);
const AdminUsersPage = lazyPage(
  () => import('@/pages/admin-users-page'),
  'AdminUsersPage',
);
const AdminAuditPage = lazyPage(
  () => import('@/pages/admin-audit-page'),
  'AdminAuditPage',
);
const AppUsersPage = lazyPage(
  () => import('@/pages/app-users-page'),
  'AppUsersPage',
);
const LinksPage = lazyPage(() => import('@/pages/links-page'), 'LinksPage');
const PasswordVaultPage = lazyPage(
  () => import('@/pages/password-vault-page'),
  'PasswordVaultPage',
);
const S3ManagerPage = lazyPage(
  () => import('@/pages/s3-manager-page'),
  'S3ManagerPage',
);
const ScreenCastAdminPage = lazyPage(
  () => import('@/pages/screen-cast-admin-page'),
  'ScreenCastAdminPage',
);
const ScreenCastPlayerPage = lazyPage(
  () => import('@/pages/screen-cast-player-page'),
  'ScreenCastPlayerPage',
);
const WidgetBibliotecaCarruselPage = lazyPage(
  () => import('@/pages/widget-biblioteca-carrusel-page'),
  'WidgetBibliotecaCarruselPage',
);
const WidgetBibliotecaHubPage = lazyPage(
  () => import('@/pages/widget-biblioteca-hub-page'),
  'WidgetBibliotecaHubPage',
);
const WidgetEducacionAliadosPage = lazyPage(
  () => import('@/pages/widget-educacion-aliados-page'),
  'WidgetEducacionAliadosPage',
);
const WidgetEducacionCalendarioPage = lazyPage(
  () => import('@/pages/widget-educacion-calendario-page'),
  'WidgetEducacionCalendarioPage',
);
const WidgetEducacionHubPage = lazyPage(
  () => import('@/pages/widget-educacion-hub-page'),
  'WidgetEducacionHubPage',
);
const WidgetEducacionLeadFormPage = lazyPage(
  () => import('@/pages/widget-educacion-lead-form-page'),
  'WidgetEducacionLeadFormPage',
);
const WidgetEducacionMapaPage = lazyPage(
  () => import('@/pages/widget-educacion-mapa-page'),
  'WidgetEducacionMapaPage',
);
const WidgetEducacionPopupPage = lazyPage(
  () => import('@/pages/widget-educacion-popup-page'),
  'WidgetEducacionPopupPage',
);
const WidgetEducacionSelectorPage = lazyPage(
  () => import('@/pages/widget-educacion-selector-page'),
  'WidgetEducacionSelectorPage',
);
const WidgetMuseoHubPage = lazyPage(
  () => import('@/pages/widget-museo-hub-page'),
  'WidgetMuseoHubPage',
);
const WidgetMuseoInterfazPage = lazyPage(
  () => import('@/pages/widget-museo-interfaz-page'),
  'WidgetMuseoInterfazPage',
);
const WidgetMuseoPopupPage = lazyPage(
  () => import('@/pages/widget-museo-popup-page'),
  'WidgetMuseoPopupPage',
);
const WidgetPamPage = lazyPage(
  () => import('@/pages/widget-pam-page'),
  'WidgetPamPage',
);
const BsaleKardexPage = lazyPage(
  () => import('@/pages/bsale-kardex-page'),
  'BsaleKardexPage',
);
const NewslettersPage = lazyPage(
  () => import('@/pages/newsletters-page'),
  'NewslettersPage',
);
const CrmPamPage = lazyPage(() => import('@/pages/crm-pam-page'), 'CrmPamPage');
const CatalogEducacionPage = lazyPage(
  () => import('@/pages/catalog-educacion-page'),
  'CatalogEducacionPage',
);
const CrmEducacionPage = lazyPage(
  () => import('@/pages/crm-educacion-page'),
  'CrmEducacionPage',
);
const PresentacionPage = lazyPage(
  () => import('@/pages/presentacion-page'),
  'PresentacionPage',
);
const PortfolioPage = lazyPage(
  () => import('@/pages/portfolio-page'),
  'PortfolioPage',
);
const FilesPage = lazyPage(() => import('@/pages/files-page'), 'FilesPage');
const LandingsPage = lazyPage(
  () => import('@/pages/landings-page'),
  'LandingsPage',
);
const TreasuryPage = lazyPage(
  () => import('@/pages/treasury-page'),
  'TreasuryPage',
);
const MalichimpPage = lazyPage(
  () => import('@/pages/malichimp-page'),
  'MalichimpPage',
);

function RouteFallback() {
  return (
    <div className="p-6">
      <PageLoading />
    </div>
  );
}

/** Authenticated app shell — not mounted on the public kiosk player. */
function AuthenticatedApp() {
  return (
    <AuthProvider>
      <AccentThemeUserSync />
      <ToastProvider>
        <ConfirmProvider>
          <TooltipProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<AuthGuard />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route element={<ModuleGuard module="treasury" />}>
                      <Route path="treasury" element={<TreasuryPage />} />
                    </Route>
                    <Route element={<ModuleGuard module="portfolio" />}>
                      <Route path="portfolio" element={<PortfolioPage />} />
                      <Route
                        path="todos"
                        element={<Navigate to="/portfolio" replace />}
                      />
                    </Route>
                    <Route element={<ModuleGuard module="links" />}>
                      <Route path="links" element={<LinksPage />} />
                    </Route>
                    <Route element={<ModuleGuard module="google_workspace" />}>
                      <Route
                        path={WORKSPACE_PATH.replace(/^\//, '')}
                        element={<AdminUsersPage />}
                      />
                      <Route
                        path="admin/users"
                        element={<LegacyEmailAdminRedirect />}
                      />
                    </Route>
                    <Route element={<ModuleGuard module="s3_manager" />}>
                      <Route path="admin/s3" element={<S3ManagerPage />} />
                    </Route>
                    <Route element={<ModuleGuard module="files" />}>
                      <Route path="files" element={<FilesPage />} />
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
                      <Route
                        path="admin/widgets/educacion/lead-form"
                        element={<WidgetEducacionLeadFormPage />}
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
                    </Route>
                    <Route element={<ModuleGuard module="widget_pam" />}>
                      <Route
                        path="admin/widget-pam"
                        element={<WidgetPamPage />}
                      />
                    </Route>
                    <Route element={<ModuleGuard module="bsale_reports" />}>
                      <Route path="bsale/kardex" element={<BsaleKardexPage />} />
                    </Route>
                    <Route element={<ModuleGuard module="email_hub" />}>
                      <Route
                        path={EMAIL_HUB_PATH.replace(/^\//, '')}
                        element={<NewslettersPage />}
                      />
                      <Route
                        path="admin/newsletters"
                        element={<LegacyEmailAdminRedirect />}
                      />
                    </Route>
                    <Route element={<ModuleGuard module="malichimp" />}>
                      <Route
                        path={MALICHIMP_PATH.replace(/^\//, '')}
                        element={<MalichimpPage />}
                      />
                    </Route>
                    <Route
                      path="admin/comunicacion-interna"
                      element={<LegacyEmailAdminRedirect />}
                    />
                    <Route element={<ModuleGuard module="landings" />}>
                      <Route
                        path="admin/landings"
                        element={<LandingsPage />}
                      />
                    </Route>
                    <Route element={<ModuleGuard module="crm_pam" />}>
                      <Route path="admin/crm-pam" element={<CrmPamPage />} />
                    </Route>
                    <Route element={<ModuleGuard module="crm_educacion" />}>
                      <Route
                        path="admin/crm-educacion"
                        element={<CrmEducacionPage />}
                      />
                    </Route>
                    <Route element={<ModuleGuard module="catalog_educacion" />}>
                      <Route
                        path="admin/catalogo-educacion"
                        element={<CatalogEducacionPage />}
                      />
                    </Route>
                    <Route
                      path="admin/mailing"
                      element={<LegacyEmailAdminRedirect />}
                    />
                    <Route element={<SuperAdminGuard />}>
                      <Route
                        path="admin/app-users"
                        element={<AppUsersPage />}
                      />
                      <Route path="admin/audit" element={<AdminAuditPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </TooltipProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ColorSchemeProvider>
        <AccentThemeProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public routes — outside AuthProvider to avoid /api/auth/me 401 */}
              <Route path="/screen-cast" element={<ScreenCastPlayerPage />} />
              <Route path="/presentacion" element={<PresentacionPage />} />
              <Route path="/presentacion/" element={<PresentacionPage />} />
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Suspense>
        </AccentThemeProvider>
      </ColorSchemeProvider>
    </BrowserRouter>
  );
}
