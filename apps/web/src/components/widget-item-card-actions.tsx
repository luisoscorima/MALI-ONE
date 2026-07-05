import type { ComponentProps } from 'react';
import { Copy, Save, Trash2, X } from 'lucide-react';
import { IconActionButton } from '@/components/icon-action-button';
import { Button } from '@/components/ui/button';

export function WidgetItemCardActions({
  onSave,
  onDuplicate,
  onDelete,
  onCancel,
}: {
  onSave: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  return (
    <>
      <IconActionButton label="Guardar" variant="default" onClick={onSave}>
        <Save className="size-4" />
      </IconActionButton>
      {onDuplicate && (
        <IconActionButton label="Duplicar" onClick={onDuplicate}>
          <Copy className="size-4" />
        </IconActionButton>
      )}
      {onDelete && (
        <IconActionButton label="Eliminar" variant="danger" onClick={onDelete}>
          <Trash2 className="size-4" />
        </IconActionButton>
      )}
      {onCancel && (
        <IconActionButton label="Cancelar" onClick={onCancel}>
          <X className="size-4" />
        </IconActionButton>
      )}
    </>
  );
}

export function WidgetSaveButton({
  className,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button className={className ?? 'w-fit'} {...props}>
      {children}
    </Button>
  );
}
