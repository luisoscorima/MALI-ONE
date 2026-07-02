import { cn } from '@/lib/utils';
import {
  isKnownSelectorIcon,
  SELECTOR_SEDE_ICONS,
} from '@/lib/selector-sede-icons';
import { Input } from '@/components/ui';

export function MaterialIconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const trimmed = value.trim();
  const showCustom = Boolean(trimmed) && !isKnownSelectorIcon(trimmed);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Icono de la sede</p>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-5">
        {SELECTOR_SEDE_ICONS.map((item) => {
          const selected = trimmed === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => onChange(item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:bg-muted/50',
              )}
            >
              <span className="material-icons text-[22px] leading-none" aria-hidden>
                {item.id}
              </span>
              <span className="text-[10px] leading-tight text-muted">{item.label}</span>
            </button>
          );
        })}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted">Otro icono (nombre Material Icons)</summary>
        <Input
          className="mt-2"
          placeholder="Ej. store, home_work…"
          value={showCustom ? trimmed : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </details>
    </div>
  );
}
