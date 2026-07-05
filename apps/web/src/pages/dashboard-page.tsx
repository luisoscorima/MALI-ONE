import { APP_MODULES } from '@/lib/app-modules';
import { useAuth } from '@/contexts/auth-context';
import { EmptyState } from '@/components/feedback';
import { SectionModuleCards } from '@/components/section-module-cards';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui';
import { hasModule } from '@/lib/user-modules';
import { moduleMeta, groupLabels } from '@/lib/dashboard-modules';

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
    <div className="flex flex-col gap-4 md:gap-6">
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
        <div className="flex flex-col gap-6 md:gap-8">
          {groups.map((group) => {
            const groupCards = cards.filter((c) => c.group === group);
            if (groupCards.length === 0) return null;
            return (
              <section key={group}>
                <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabels[group]}
                </h2>
                <SectionModuleCards
                  cards={groupCards.map((card) => ({
                    to: card.to,
                    title: card.label,
                    description: card.description,
                    icon: card.icon,
                    accent: card.accent,
                  }))}
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
