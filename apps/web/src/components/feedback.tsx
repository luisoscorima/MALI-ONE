import { Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-5 w-5 animate-spin text-muted', className)}
      aria-hidden
    />
  );
}

export function AlertBanner({
  variant = 'error',
  children,
  onDismiss,
}: {
  variant?: 'error' | 'success' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={cn(
        'mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
        variant === 'error' && 'border-danger/50 bg-danger/10 text-danger',
        variant === 'success' && 'border-success/50 bg-success/10 text-foreground',
        variant === 'info' && 'border-primary/30 bg-primary/5 text-foreground',
      )}
      role="alert"
    >
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-sm underline opacity-80 hover:opacity-100"
        >
          Cerrar
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Inbox className="mb-3 h-10 w-10 text-muted" strokeWidth={1.5} />
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} className="border-b border-border/40">
          {Array.from({ length: cols }).map((_, col) => (
            <td key={col} className="p-4">
              <div className="h-4 animate-pulse rounded bg-border/60" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
