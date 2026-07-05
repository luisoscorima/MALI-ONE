import { Loader2 } from 'lucide-react';
import { GoogleLogoIcon } from '@/components/google-logo-icon';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';

type LoginFormProps = React.ComponentProps<'div'> & {
  onGoogleLogin: () => void;
  redirecting?: boolean;
};

export function LoginForm({
  className,
  onGoogleLogin,
  redirecting = false,
  ...props
}: LoginFormProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="login-card-interactive border-border/80 bg-card/95 shadow-lg backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bienvenido</CardTitle>
          <CardDescription>
            Inicia sesión con tu cuenta{' '}
            <strong className="font-medium text-foreground">@mali.pe</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <Button
                variant="outline"
                type="button"
                className={cn(
                  'login-google-btn group relative h-10 w-full overflow-hidden',
                  'border-[#dadce0] bg-white text-[15px] font-medium text-[#3c4043]',
                  'shadow-sm transition-all duration-200',
                  'hover:border-[#c6c9cc] hover:bg-[#f8f9fa] hover:shadow-md',
                  'active:scale-[0.99]',
                  'disabled:cursor-wait disabled:opacity-90',
                )}
                onClick={onGoogleLogin}
                disabled={redirecting}
              >
                <span
                  className={cn(
                    'pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent transition-transform duration-700',
                    !redirecting && 'group-hover:translate-x-full',
                  )}
                  aria-hidden
                />
                {redirecting ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <GoogleLogoIcon className="size-5" />
                )}
                {redirecting ? 'Conectando con Google…' : 'Continuar con Google'}
              </Button>
            </Field>
            <FieldDescription className="text-center text-xs">
              Acceso exclusivo para el equipo del Museo de Arte de Lima
            </FieldDescription>
          </FieldGroup>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center text-xs">
        Al continuar, aceptas las políticas de uso interno de MALI ONE y Google
        Workspace de la institución.
      </FieldDescription>
    </div>
  );
}
