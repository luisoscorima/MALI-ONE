import type { ReactNode } from 'react';
import { Copy, Folder, ImageIcon, Lock } from 'lucide-react';
import type { FilesListItemDto } from '@mali-one/shared';
import { useToast } from '@/contexts/toast-context';
import { formatBytes, formatDate } from '@/lib/format-bytes';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.tif',
  '.tiff',
]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FilesListItemDto | null;
  trashMode?: boolean;
};

export function FilesItemInfoDialog({
  open,
  onOpenChange,
  item,
  trashMode,
}: Props) {
  const toast = useToast();

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiada`);
    } catch {
      toast.error(`No se pudo copiar ${label.toLowerCase()}`);
    }
  }

  if (!item) return null;

  const extension = getExtension(item.name);
  const isImage = !item.isFolder && isImageFile(item.name);
  const parentPath = dirname(item.path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            {item.isFolder ? (
              <Folder className="size-5 shrink-0 text-amber-600" />
            ) : isImage ? (
              <ImageIcon className="size-5 shrink-0 text-sky-600" />
            ) : null}
            <span className="truncate">{item.name}</span>
          </DialogTitle>
          <DialogDescription>
            {item.isFolder ? 'Carpeta' : 'Archivo'} en Archivos TMS
            {trashMode ? ' · Papelera' : ''}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          <InfoRow label="Tipo">
            {item.isFolder ? 'Carpeta' : 'Archivo'}
          </InfoRow>

          {!item.isFolder && extension ? (
            <InfoRow label="Extensión">.{extension}</InfoRow>
          ) : null}

          {!item.isFolder ? (
            <InfoRow label="Tamaño">{formatBytes(item.size ?? 0)}</InfoRow>
          ) : null}

          <InfoRow label="Modificado">
            {item.lastModified ? formatDate(item.lastModified) : '—'}
          </InfoRow>

          <InfoRow label="Estado">
            {item.locked ? (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" />
                Protegido
              </span>
            ) : trashMode ? (
              'En papelera'
            ) : (
              'Normal'
            )}
          </InfoRow>

          {parentPath !== item.path ? (
            <InfoRow label="Carpeta padre">
              <span className="font-mono text-xs break-all">
                {parentPath === '/' ? '/' : parentPath}
              </span>
            </InfoRow>
          ) : null}

          {!item.isFolder && isImage ? (
            <InfoRow label="Vista previa">Disponible en el explorador</InfoRow>
          ) : null}

          <InfoRow label="Ruta">
            <div className="flex items-start gap-2">
              <span className="min-w-0 flex-1 font-mono text-xs break-all">
                {item.path}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                aria-label="Copiar ruta"
                onClick={() => void copyText(item.path, 'Ruta')}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </InfoRow>
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function getExtension(name: string): string | null {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  return name.slice(dot + 1).toLowerCase();
}

function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXT.has(lower.slice(dot));
}

function dirname(filePath: string): string {
  const clean = filePath.replace(/\/+$/, '');
  if (clean === '' || clean === '/') return '/';
  const idx = clean.lastIndexOf('/');
  if (idx <= 0) return '/';
  return clean.slice(0, idx);
}
