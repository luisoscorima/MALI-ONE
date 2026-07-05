import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModuleCardAccent = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';

const accentStyles: Record<
  ModuleCardAccent,
  { icon: string; ring: string; glow: string }
> = {
  blue: {
    icon: 'bg-primary/20 text-primary',
    ring: 'group-hover:ring-primary/40',
    glow: 'group-hover:shadow-primary/10',
  },
  violet: {
    icon: 'bg-violet-500/20 text-violet-400',
    ring: 'group-hover:ring-violet-500/40',
    glow: 'group-hover:shadow-violet-500/10',
  },
  emerald: {
    icon: 'bg-emerald-500/20 text-emerald-400',
    ring: 'group-hover:ring-emerald-500/40',
    glow: 'group-hover:shadow-emerald-500/10',
  },
  amber: {
    icon: 'bg-amber-500/20 text-amber-400',
    ring: 'group-hover:ring-amber-500/40',
    glow: 'group-hover:shadow-amber-500/10',
  },
  rose: {
    icon: 'bg-rose-500/20 text-rose-400',
    ring: 'group-hover:ring-rose-500/40',
    glow: 'group-hover:shadow-rose-500/10',
  },
  cyan: {
    icon: 'bg-cyan-500/20 text-cyan-400',
    ring: 'group-hover:ring-cyan-500/40',
    glow: 'group-hover:shadow-cyan-500/10',
  },
};

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
  const styles = accentStyles[accent];

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
            className="mt-1 shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
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
