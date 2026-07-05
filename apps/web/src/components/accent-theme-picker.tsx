import { Check } from 'lucide-react';
import { accentThemes } from '@/lib/accent-themes';
import { useAccentTheme } from '@/contexts/accent-theme-context';
import { cn } from '@/lib/utils';

/** Muestras de color compactas — submenú del avatar. */
export function AccentThemeSwatches({ className }: { className?: string }) {
  const { accentId, setAccentId } = useAccentTheme();

  return (
    <div
      className={cn('flex flex-wrap gap-2 p-2', className)}
      role="listbox"
      aria-label="Color de interfaz"
    >
      {accentThemes.map((theme) => {
        const selected = accentId === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            role="option"
            aria-selected={selected}
            title={theme.label}
            aria-label={theme.label}
            onClick={() => setAccentId(theme.id)}
            className={cn(
              'relative flex size-7 items-center justify-center rounded-full ring-1 ring-border transition-transform hover:scale-105',
              selected && 'ring-2 ring-primary ring-offset-2 ring-offset-popover',
            )}
            style={{ backgroundColor: theme.swatch }}
          >
            {selected && (
              <Check
                className={cn(
                  'size-3.5 drop-shadow-sm',
                  theme.id === 'neutral' ? 'text-zinc-900' : 'text-white',
                )}
                strokeWidth={3}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
