import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import {
  moduleCardAccentStyles,
  type ModuleCardAccent,
} from '@/lib/module-card-accents';
import { cn } from '@/lib/utils';

type Props = {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: ModuleCardAccent;
  subtitle?: string;
  badge?: string;
};

export function ModuleCard({
  to,
  title,
  description,
  icon: Icon,
  accent = 'blue',
  subtitle,
  badge,
}: Props) {
  const styles = moduleCardAccentStyles[accent];

  return (
    <Link to={to} className="group block h-full">
      <article
        className={cn(
          'relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card p-5',
          'ring-1 ring-transparent transition-all duration-200',
          'hover:-translate-y-0.5 hover:border-border/80 hover:bg-card/90 hover:shadow-lg',
          styles.ring,
          styles.glow,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              styles.icon,
            )}
          >
            <Icon size={22} strokeWidth={1.75} />
          </div>
          <ArrowRight
            size={18}
            className="mt-1 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-tight">{title}</h3>
            {badge && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>
          )}
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </article>
    </Link>
  );
}

export type { ModuleCardAccent };
