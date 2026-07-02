import type { LucideIcon } from 'lucide-react';
import { CircleHelp, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { googleStaticMapUrl } from '@/lib/google-static-map';

const THUMB_CLASS = 'h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40';

export function WidgetConfigItemList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid max-h-[70vh] gap-4 overflow-y-auto pr-1 md:grid-cols-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function WidgetConfigItemCard({
  badge,
  aside,
  inactive,
  children,
  actions,
}: {
  badge?: string;
  aside?: React.ReactNode;
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

      <div className="flex gap-4 p-4">
        {aside}
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">{children}</div>
      </div>

      <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/20 px-4 py-3">
        {actions}
      </footer>
    </article>
  );
}

export function WidgetConfigItemCardFull({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('sm:col-span-2', className)}>{children}</div>;
}

export function WidgetConfigItemFields({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </div>
  );
}

export function WidgetConfigItemField({
  label,
  hint,
  span = 1,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  span?: 1 | 2 | 3 | 'full';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'space-y-1',
        span === 2 && 'sm:col-span-2',
        span === 3 && 'sm:col-span-2 lg:col-span-3',
        span === 'full' && 'sm:col-span-2 lg:col-span-3',
        className,
      )}
    >
      {label && <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>}
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function WidgetConfigItemImageThumb({
  imageUrl,
  alt = '',
}: {
  imageUrl?: string | null;
  alt?: string;
}) {
  const src = imageUrl?.trim();

  return (
    <div className={THUMB_CLASS} title="Vista referencial">
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-muted">
          <ImageIcon className="h-6 w-6 stroke-[1.5]" aria-hidden />
          <span className="px-1 text-center text-[10px] leading-tight">Sin imagen</span>
        </div>
      )}
    </div>
  );
}

export function WidgetConfigItemMaterialIconThumb({
  icon,
  label,
}: {
  icon: string;
  label?: string;
}) {
  const glyph = icon.trim();

  if (!glyph) {
    return (
      <WidgetConfigItemIconThumb
        icon={CircleHelp}
        label={label ?? 'Sin icono'}
      />
    );
  }

  return (
    <div
      className={cn(THUMB_CLASS, 'flex flex-col items-center justify-center gap-1 text-primary')}
      title={label ?? glyph}
    >
      <span className="material-icons text-[28px] leading-none" aria-hidden>
        {glyph}
      </span>
      {label && (
        <span className="max-w-full truncate px-1 text-center text-[10px] text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

export function WidgetConfigItemIconThumb({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label?: string;
}) {
  return (
    <div
      className={cn(THUMB_CLASS, 'flex flex-col items-center justify-center gap-1 text-primary')}
      title={label}
    >
      <Icon className="h-7 w-7 stroke-[1.5]" aria-hidden />
      {label && (
        <span className="max-w-full truncate px-1 text-center text-[10px] text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

export function WidgetConfigItemMapThumb({
  lat,
  lng,
  mapsApiKey,
  label,
  placeholderIcon: PlaceholderIcon = ImageIcon,
}: {
  lat: number | null;
  lng: number | null;
  mapsApiKey?: string | null;
  label?: string;
  placeholderIcon?: LucideIcon;
}) {
  const hasCoords = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  const apiKey = mapsApiKey?.trim();

  if (!hasCoords || !apiKey) {
    return (
      <WidgetConfigItemIconThumb
        icon={PlaceholderIcon}
        label={label ?? (hasCoords ? 'Mapa' : 'Sin coordenadas')}
      />
    );
  }

  const mapUrl = googleStaticMapUrl(lat, lng, apiKey);

  return (
    <div className={THUMB_CLASS} title={label ?? `${lat}, ${lng}`}>
      <img
        src={mapUrl}
        alt={label ?? 'Ubicación en mapa'}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
