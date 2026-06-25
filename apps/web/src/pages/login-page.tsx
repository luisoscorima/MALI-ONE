import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { MaliLogo } from '@/components/mali-logo';
import { Button, Card } from '@/components/ui';

export function LoginPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Cargando...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <div className="mb-6 flex flex-col items-center">
          <MaliLogo showSubtitle={false} imageClassName="h-14" className="px-0" />
          <p className="mt-3 text-sm font-medium tracking-wide text-muted">
            MALI ONE
          </p>
        </div>
        <p className="mb-8 text-sm text-muted">
          Acceso exclusivo para cuentas <strong>@mali.pe</strong>
        </p>
        <Button
          className="w-full"
          onClick={() => {
            window.location.href = api.googleLoginUrl();
          }}
        >
          Continuar con Google
        </Button>
      </Card>
    </div>
  );
}
