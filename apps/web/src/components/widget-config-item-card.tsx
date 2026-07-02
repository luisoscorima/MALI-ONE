import type { LucideIcon } from 'lucide-react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function WidgetConfigItemCard({
  badge,
  media,
  inactive,
  children,
  actions,
}: {
  badge?: string;
  media?: React.ReactNode;
  inactive?: boolean;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card shadow-sm',
        inactive && 'opacity-60',
      )}
    >
      {badge && (
        <div className="border-b border-border bg-muted/30 px-4 py-2">
          <p className="text-sm font-medium">{badge}</p>
        </div>
      )}

      {media}

      <div className="space-y-3 p-4">{children}</div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/20 px-4 py-3">
        {actions}
      </footer>
    </article>
  );
}

export function WidgetConfigItemMedia({
  imageUrl,
  alt = '',
  placeholderIcon: PlaceholderIcon = ImageIcon,
  placeholderLabel = 'Sin imagen',
  footer,
}: {
  imageUrl?: string | null;
  alt?: string;
  placeholderIcon?: LucideIcon;
  placeholderLabel?: string;
  footer?: React.ReactNode;
}) {
  const hasImage = Boolean(imageUrl?.trim());

  return (
    <div className="border-b border-border">
      <div className="relative aspect-16/10 w-full bg-muted/50">
        {hasImage ? (
          <img
            src={imageUrl!.trim()}
            alt={alt}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <PlaceholderIcon className="h-10 w-10 stroke-[1.5]" aria-hidden />
            <span className="text-xs">{placeholderLabel}</span>
          </div>
        )}
      </div>
      {footer && <div className="space-y-2 border-t border-border bg-background p-3">{footer}</div>}
    </div>
  );
}

export function WidgetConfigItemField({
  label,
  hint,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>}
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
