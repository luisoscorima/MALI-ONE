import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { IconActionButton } from '@/components/icon-action-button';
import { cn } from '@/lib/utils';

type CopyableValueProps = {
  value: string | null | undefined;
  label: string;
  mono?: boolean;
  empty?: string;
  className?: string;
};

function isCopyable(value: string | null | undefined, empty: string) {
  const text = value?.trim() ?? '';
  return text.length > 0 && text !== empty;
}

export async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label}: copiado al portapapeles`);
  } catch {
    toast.error(`No se pudo copiar ${label.toLowerCase()}`);
  }
}

export function CopyableValue({
  value,
  label,
  mono = true,
  empty = '—',
  className,
}: CopyableValueProps) {
  const display = value?.trim() ? value : empty;
  const canCopy = isCopyable(value, empty);

  return (
    <div className={cn('flex items-start gap-1.5', className)}>
      <span
        className={cn(
          'min-w-0 flex-1 break-all',
          mono && 'font-mono text-xs',
        )}
      >
        {display}
      </span>
      {canCopy ? (
        <span
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <IconActionButton
            label={`Copiar ${label.toLowerCase()}`}
            variant="ghost"
            className="size-7"
            onClick={() => void copyToClipboard(value!.trim(), label)}
          >
            <Copy className="size-3.5" aria-hidden />
          </IconActionButton>
        </span>
      ) : null}
    </div>
  );
}
