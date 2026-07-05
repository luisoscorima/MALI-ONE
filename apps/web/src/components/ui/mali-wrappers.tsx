import type { ComponentProps } from 'react';
import { Card as ShadcnCard } from './card';
import { Switch } from './switch';
import { cn } from '@/lib/utils';

/** Card con padding horizontal para compatibilidad con el layout anterior */
export function Card({
  className,
  children,
  ...props
}: ComponentProps<typeof ShadcnCard>) {
  return (
    <ShadcnCard className={cn('px-(--card-spacing)', className)} {...props}>
      {children}
    </ShadcnCard>
  );
}

export function SettingSwitchRow({
  label,
  checked,
  onCheckedChange,
  disabled,
  activeLabel = 'Activado',
  inactiveLabel = 'Desactivado',
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-lg border border-border p-3',
        disabled && 'opacity-60',
      )}
    >
      <p className="min-w-0 text-sm font-medium">{label}</p>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'text-xs font-medium',
            checked ? 'text-primary' : 'text-muted',
          )}
        >
          {checked ? activeLabel : inactiveLabel}
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/** Switch compacto para filas dentro de tarjetas de ítems */
export function SettingSwitchInline({
  label,
  checked,
  onCheckedChange,
  disabled,
  activeLabel = 'Activa',
  inactiveLabel = 'Inactiva',
}: {
  label?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-muted/10 px-3 py-2',
        label ? 'justify-between' : 'justify-end',
        disabled && 'opacity-60',
      )}
    >
      {label && <p className="min-w-0 text-sm font-medium">{label}</p>}
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            'text-xs font-medium',
            checked ? 'text-primary' : 'text-muted',
          )}
        >
          {checked ? activeLabel : inactiveLabel}
        </span>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
