import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, GraduationCap, HardDrive, KeyRound, Landmark, Link2, Users } from 'lucide-react';
import { APP_MODULES } from '@/lib/app-modules';
import { useAuth } from '@/contexts/auth-context';
import { EmptyState } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui';
import { hasModule } from '@/lib/user-modules';

const moduleRoutes: Record<
  (typeof APP_MODULES)[number]['id'],
  { to: string; icon: typeof Link2 }
> = {
  links: { to: '/links', icon: Link2 },
  workspace_users: { to: '/admin/users', icon: Users },
  s3_manager: { to: '/admin/s3', icon: HardDrive },
  password_vault: { to: '/vault', icon: KeyRound },
  widget_educacion: { to: '/admin/widgets/educacion', icon: GraduationCap },
  widget_biblioteca: { to: '/admin/widgets/biblioteca', icon: BookOpen },
  widget_pam: { to: '/admin/widgets/museo', icon: Landmark },
};

export function DashboardPage() {
  const { user } = useAuth();

  const cards = APP_MODULES.filter((mod) => hasModule(user, mod.id)).map(
    (mod) => ({
      ...mod,
      ...moduleRoutes[mod.id],
    }),
  );

  return (
    <div>
      <PageHeader
        title={`Hola, ${user?.name?.split(' ')[0] ?? 'equipo'}`}
        description="Panel de operaciones internas MALI ONE"
      />

      {cards.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin módulos asignados"
            description={
              user?.isSuperAdmin
                ? 'Como administrador tienes acceso a todos los módulos desde el menú lateral.'
                : 'Tu cuenta está activa, pero aún no tienes módulos habilitados. Contacta al administrador del sistema (loscorima@mali.pe).'
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <Link key={card.to} to={card.to} className="group block">
              <Card className="h-full transition-colors hover:border-primary">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/15 p-2 text-primary">
                      <card.icon size={20} />
                    </div>
                    <h3 className="font-semibold">{card.label}</h3>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </div>
                <p className="text-sm text-muted">{card.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
