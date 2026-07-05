import { Link } from 'react-router-dom';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import {
  moduleCardAccentStyles,
  type ModuleCardAccent,
} from '@/lib/module-card-accents';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type SectionModuleCard = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: ModuleCardAccent;
};

type Props = {
  cards: SectionModuleCard[];
  className?: string;
};

export function SectionModuleCards({ cards, className }: Props) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3',
        className,
      )}
    >
      {cards.map((card) => {
        const accent = card.accent ?? 'blue';
        const styles = moduleCardAccentStyles[accent];
        const Icon = card.icon;

        return (
          <Link key={card.to} to={card.to} className="group block h-full">
            <Card
              className={cn(
                'relative h-full overflow-hidden bg-gradient-to-t to-card shadow-xs',
                'ring-1 ring-transparent transition-all duration-200',
                'group-hover:-translate-y-0.5 group-hover:shadow-md',
                styles.gradient,
                styles.ring,
                styles.glow,
              )}
            >
              <div className="flex h-full flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                      styles.icon,
                    )}
                  >
                    <Icon size={22} strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-60 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                </div>
                <h3 className="mb-1.5 font-semibold leading-tight">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {card.description}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
