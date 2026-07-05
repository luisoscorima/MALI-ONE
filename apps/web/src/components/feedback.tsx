import { Inbox, Loader2 } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-5 w-5 animate-spin text-muted', className)}
      aria-hidden
    />
  );
}

type PageLoadingVariant = 'default' | 'form' | 'table';

export function PageLoading({
  variant = 'default',
}: {
  variant?: PageLoadingVariant;
}) {
  return (
    <div className="space-y-6" aria-busy aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {variant === 'table' ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border p-4">
            <Skeleton className="h-9 w-full max-w-xs" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 p-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/5" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="space-y-4 p-5">
          {variant === 'form' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-9 w-32" />
            </>
          ) : (
            <>
              <Skeleton className="h-5 w-40" />
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

/** Pantalla completa centrada (auth, login). */
export function FullPageLoading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-3"
      aria-busy
      aria-label="Cargando"
    >
      <Spinner className="h-7 w-7 text-primary" />
      <p className="text-sm text-muted-foreground">Cargando…</p>
    </div>
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
    <>
      {Array.from({ length: rows }).map((_, row) => (
        <tr key={row} className="border-b border-border/40">
          {Array.from({ length: cols }).map((_, col) => (
            <td key={col} className="p-4">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
