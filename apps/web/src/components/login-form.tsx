import { Loader2 } from 'lucide-react';
import { GoogleLogoIcon } from '@/components/google-logo-icon';import { Button } from '@/components/ui/button';
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
      <Card className="border-border/80 bg-card/95 shadow-lg backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bienvenido</CardTitle>
          <CardDescription>
            Inicia sesión con tu cuenta{' '}
            <strong className="font-medium text-foreground">@mali.pe</strong> de
            Google Workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <Button
                variant="outline"
                type="button"
                className="h-10 w-full bg-background text-[15px] font-medium"
                onClick={onGoogleLogin}
                disabled={redirecting}
              >
                {redirecting ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <GoogleLogoIcon className="size-5" />
                )}
                {redirecting ? 'Conectando con Google…' : 'Continuar con Google'}
              </Button>
            </Field>
            <FieldDescription className="text-center text-xs">
              Acceso exclusivo para el equipo interno del Museo de Arte de Lima
            </FieldDescription>
          </FieldGroup>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center text-xs">
        Al continuar, aceptas las políticas de uso interno de MALI ONE y Google
        Workspace de la institución.
      </FieldDescription>
    </div>  );
}
