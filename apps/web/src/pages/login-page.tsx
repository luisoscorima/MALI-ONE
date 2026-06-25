import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
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
        <h1 className="mb-2 text-2xl font-bold">MALI ONE</h1>
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
