import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { TableDensity } from '@/components/ui/table';

type TableShellProps = {
  children: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  density?: TableDensity;
  className?: string;
  /** Clase del marco con borde (tabla). */
  frameClassName?: string;
};

export function TableShell({
  children,
  toolbar,
  footer,
  density = 'comfortable',
  className,
  frameClassName,
}: TableShellProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {toolbar}
      <div
        data-slot="table-shell"
        data-density={density}
        className={cn(
          'group/table-shell overflow-hidden rounded-lg border border-border bg-card',
          frameClassName,
        )}
      >
        {children}
      </div>
      {footer}
    </div>
  );
}
