import { Navigate, useLocation } from 'react-router-dom';
import { resolveLegacyEmailAdminRedirect } from '@/lib/email-admin-routes';

/** Rewrites old email admin paths to canonical ones, preserving query params. */
export function LegacyEmailAdminRedirect() {
  const location = useLocation();
  const target = resolveLegacyEmailAdminRedirect(
    location.pathname,
    location.search,
  );
  if (!target) return <Navigate to="/" replace />;
  return <Navigate to={`${target}${location.hash}`} replace />;
}
