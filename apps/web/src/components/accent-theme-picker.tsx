import { useRef } from 'react';
import { Check, Plus } from 'lucide-react';
import {
  accentThemes,
  contrastForeground,
  isAccentHex,
  readStoredCustomAccentHex,
} from '@/lib/accent-themes';
import { useAccentTheme } from '@/contexts/accent-theme-context';
import { cn } from '@/lib/utils';

/** Muestras de color compactas — submenú del avatar. */
export function AccentThemeSwatches({ className }: { className?: string }) {
  const { accentId, setAccentId } = useAccentTheme();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const customSelected = isAccentHex(accentId);
  const customHex = customSelected ? accentId : readStoredCustomAccentHex();
  const customCheckColor = contrastForeground(customHex);

  return (
    <div
      className={cn(
        'grid grid-cols-7 gap-2 p-2 sm:flex sm:flex-wrap',
        className,
      )}
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

      <button
        type="button"
        role="option"
        aria-selected={customSelected}
        title="Personalizado"
        aria-label="Color personalizado"
        onClick={() => colorInputRef.current?.click()}
        className={cn(
          'relative flex size-7 items-center justify-center rounded-full ring-1 ring-border transition-transform hover:scale-105',
          customSelected
            ? 'ring-2 ring-primary ring-offset-2 ring-offset-popover'
            : 'border border-dashed border-muted-foreground/40 bg-muted/40',
        )}
        style={customSelected ? { backgroundColor: customHex } : undefined}
      >
        {customSelected ? (
          <Check
            className="size-3.5 drop-shadow-sm"
            style={{ color: customCheckColor }}
            strokeWidth={3}
          />
        ) : (
          <Plus className="size-3.5 text-muted-foreground" strokeWidth={2.5} />
        )}
        <input
          ref={colorInputRef}
          type="color"
          value={customHex}
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          onChange={(event) => setAccentId(event.target.value)}
        />
      </button>
    </div>
  );
}
