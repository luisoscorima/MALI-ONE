import { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder, Loader2 } from 'lucide-react';
import type { FilesListItemDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  initialPath?: string;
  /** Elemento que se mueve/copia (para bloquear destinos inválidos). */
  sourcePath?: string;
  sourceIsFolder?: boolean;
  trashPath?: string;
  onConfirm: (destFolder: string) => void | Promise<void>;
};

export function FilesFolderPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  initialPath = '/',
  sourcePath,
  sourceIsFolder,
  trashPath,
  onConfirm,
}: Props) {
  const toast = useToast();
  const [pickerPath, setPickerPath] = useState(initialPath);
  const [folders, setFolders] = useState<FilesListItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listFiles(pickerPath);
      setFolders(
        data.items.filter(
          (item) =>
            item.isFolder &&
            !item.locked &&
            !(trashPath && item.path === trashPath),
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al listar carpetas');
    } finally {
      setLoading(false);
    }
  }, [pickerPath, toast, trashPath]);

  useEffect(() => {
    if (open) setPickerPath(initialPath || '/');
  }, [open, initialPath]);

  useEffect(() => {
    if (open) void loadFolders();
  }, [open, loadFolders]);

  const breadcrumbs = useMemo(
    () => buildPickerBreadcrumbs(pickerPath),
    [pickerPath],
  );

  const destInvalid = isInvalidDest(
    pickerPath,
    sourcePath,
    sourceIsFolder,
    trashPath,
  );

  async function handleConfirm() {
    if (destInvalid) return;
    setSubmitting(true);
    try {
      await onConfirm(pickerPath || '/');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-3">
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, idx) => (
                <BreadcrumbItem key={crumb.path}>
                  {idx > 0 ? <BreadcrumbSeparator /> : null}
                  {idx === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="cursor-pointer"
                      onClick={() => setPickerPath(crumb.path)}
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Destino:{' '}
            <span className="font-mono text-xs">
              {pickerPath === '/' ? '/' : pickerPath}
            </span>
          </p>

          <div className="max-h-56 overflow-y-auto rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando…
              </div>
            ) : folders.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No hay subcarpetas aquí
              </p>
            ) : (
              <ul className="divide-y">
                {folders.map((folder) => {
                  const blocked = isInvalidDest(
                    folder.path,
                    sourcePath,
                    sourceIsFolder,
                    trashPath,
                  );
                  return (
                    <li key={folder.path}>
                      <button
                        type="button"
                        disabled={blocked}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50',
                          blocked && 'cursor-not-allowed opacity-40',
                        )}
                        onClick={() => setPickerPath(folder.path)}
                      >
                        <Folder className="size-4 shrink-0 text-amber-600" />
                        <span className="truncate">{folder.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {destInvalid ? (
            <p className="text-sm text-destructive">
              No puedes mover aquí (misma carpeta, subcarpeta del origen o
              papelera).
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={destInvalid || submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting ? 'Procesando…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildPickerBreadcrumbs(path: string) {
  const clean = path.replace(/\/+$/, '') || '/';
  const parts = clean === '/' ? [] : clean.split('/').filter(Boolean);
  const crumbs = [{ label: 'Raíz', path: '/' }];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

function isInvalidDest(
  dest: string,
  sourcePath: string | undefined,
  sourceIsFolder: boolean | undefined,
  trashPath: string | undefined,
): boolean {
  const normalizedDest = dest.replace(/\/+$/, '') || '/';
  if (trashPath) {
    const trash = trashPath.replace(/\/+$/, '');
    if (
      normalizedDest === trash ||
      normalizedDest.startsWith(`${trash}/`)
    ) {
      return true;
    }
  }
  if (!sourcePath) return false;
  const src = sourcePath.replace(/\/+$/, '');
  if (normalizedDest === src) return true;
  if (sourceIsFolder && normalizedDest.startsWith(`${src}/`)) return true;
  return false;
}
