import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { MALI_LOGO_URL } from '@/components/mali-logo';
import { LoginForm } from '@/components/login-form';
import { FullPageLoading } from '@/components/feedback';

export function LoginPage() {
  const { user, loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  if (loading) {
    return <FullPageLoading />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  function handleGoogleLogin() {
    if (redirecting) return;
    setRedirecting(true);
    window.setTimeout(() => {
      window.location.href = api.googleLoginUrl();
    }, 600);
  }

  return (
    <div className="login-shell relative flex h-svh max-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-muted p-6 md:p-10">
      {redirecting && (
        <div
          className="login-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Conectando con Google"
        >
          <div className="login-progress-fill" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="login-ambient login-ambient-emerald" />
        <div className="login-ambient login-ambient-violet" />
        <div className="login-ambient login-ambient-blue" />
        <div className="login-grid-overlay" />
      </div>

      <div className="relative flex w-full max-w-sm flex-col gap-6">
        <Link
          to="/"
          className="login-fade-up login-stagger-1 flex items-center gap-3 self-center font-medium"
        >
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg bg-primary/15 ring-1 ring-primary/25">
            <img
              src={MALI_LOGO_URL}
              alt=""
              className="h-6 w-auto object-contain"
            />
          </div>
          <div className="text-left leading-tight">
            <span className="block text-sm font-semibold tracking-wide">MALI ONE</span>
            <span className="block text-xs text-muted-foreground">
              Operaciones internas
            </span>
          </div>
        </Link>

        <div className="login-card-enter login-stagger-2">
          <LoginForm onGoogleLogin={handleGoogleLogin} redirecting={redirecting} />
        </div>
      </div>
    </div>
  );
}
