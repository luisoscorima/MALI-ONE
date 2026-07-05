import { BookOpen, GraduationCap, HardDrive, Heart, KeyRound, Landmark, Link2, Users } from 'lucide-react';
import { APP_MODULES } from '@/lib/app-modules';
import { useAuth } from '@/contexts/auth-context';
import { EmptyState } from '@/components/feedback';
import { ModuleCard } from '@/components/module-card';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui';
import { hasModule } from '@/lib/user-modules';

const moduleMeta: Record<
  (typeof APP_MODULES)[number]['id'],
  {
    to: string;
    icon: typeof Link2;
    accent: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
    group: 'operaciones' | 'widgets' | 'herramientas';
  }
> = {
  links: { to: '/links', icon: Link2, accent: 'blue', group: 'operaciones' },
  workspace_users: { to: '/admin/users', icon: Users, accent: 'violet', group: 'operaciones' },
  s3_manager: { to: '/admin/s3', icon: HardDrive, accent: 'emerald', group: 'operaciones' },
  password_vault: { to: '/vault', icon: KeyRound, accent: 'amber', group: 'herramientas' },
  widget_educacion: { to: '/admin/widgets/educacion', icon: GraduationCap, accent: 'cyan', group: 'widgets' },
  widget_biblioteca: { to: '/admin/widgets/biblioteca', icon: BookOpen, accent: 'blue', group: 'widgets' },
  widget_museo: { to: '/admin/widgets/museo', icon: Landmark, accent: 'violet', group: 'widgets' },
  pam_memberships: { to: '/admin/pam', icon: Heart, accent: 'rose', group: 'widgets' },
};

const groupLabels: Record<string, string> = {
  operaciones: 'Operaciones',
  widgets: 'Widgets y sitios',
  herramientas: 'Herramientas',
};

export function DashboardPage() {
  const { user } = useAuth();

  const cards = APP_MODULES.filter((mod) => hasModule(user, mod.id)).map(
    (mod) => ({
      ...mod,
      ...moduleMeta[mod.id],
    }),
  );

  const groups = ['operaciones', 'widgets', 'herramientas'] as const;

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
        <div className="space-y-8">
          {groups.map((group) => {
            const groupCards = cards.filter((c) => c.group === group);
            if (groupCards.length === 0) return null;
            return (
              <section key={group}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabels[group]}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {groupCards.map((card) => (
                    <ModuleCard
                      key={card.to}
                      to={card.to}
                      title={card.label}
                      description={card.description}
                      icon={card.icon}
                      accent={card.accent}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
