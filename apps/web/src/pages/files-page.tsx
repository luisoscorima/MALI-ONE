import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Copy,
  Download,
  Folder,
  FolderPlus,
  Info,
  Lock,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { FilesConfigDto, FilesListItemDto } from '@mali-one/shared';
import { IconActionButton } from '@/components/icon-action-button';
import { api } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format-bytes';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { FilesFolderPickerDialog } from '@/components/files-folder-picker-dialog';
import { FilesItemInfoDialog } from '@/components/files-item-info-dialog';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

type SortKey = 'name' | 'size' | 'lastModified';
type SortDir = 'asc' | 'desc';

const IMAGE_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.tif',
  '.tiff',
]);

function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXT.has(lower.slice(dot));
}

export function FilesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filesConfig, setFilesConfig] = useState<FilesConfigDto | null>(null);
  const [trashMode, setTrashMode] = useState(false);
  const [path, setPath] = useState('/');
  const [items, setItems] = useState<FilesListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
    name: string;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<FilesListItemDto | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState('');
  const [moveTarget, setMoveTarget] = useState<FilesListItemDto | null>(null);
  const [copyTarget, setCopyTarget] = useState<FilesListItemDto | null>(null);
  const [infoTarget, setInfoTarget] = useState<FilesListItemDto | null>(null);

  useEffect(() => {
    void api.filesConfig().then(setFilesConfig).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = trashMode
        ? await api.listTrashFiles(path)
        : await api.listFiles(path);
      setItems(data.items);
      setPath(data.path || path);
      setSelectedPaths([]);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Error al listar archivos';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [path, toast, trashMode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSearchQuery('');
    setSelectedPaths([]);
  }, [path, trashMode]);

  const breadcrumbs = buildBreadcrumbs(path, trashMode);

  const sortedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = q
      ? items.filter((item) => item.name.toLowerCase().includes(q))
      : [...items];
    list.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'es');
      } else if (sortKey === 'size') {
        cmp = (a.size ?? 0) - (b.size ?? 0);
      } else {
        const ta = a.lastModified ? Date.parse(a.lastModified) : 0;
        const tb = b.lastModified ? Date.parse(b.lastModified) : 0;
        cmp = ta - tb;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [items, searchQuery, sortKey, sortDir]);

  const selectableItems = useMemo(
    () => sortedItems.filter((item) => !item.locked),
    [sortedItems],
  );

  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedPaths.includes(item.path));

  const someSelected = selectableItems.some((item) =>
    selectedPaths.includes(item.path),
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function toggleSelect(pathValue: string) {
    setSelectedPaths((prev) =>
      prev.includes(pathValue)
        ? prev.filter((p) => p !== pathValue)
        : [...prev, pathValue],
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedPaths([]);
    } else {
      setSelectedPaths(selectableItems.map((item) => item.path));
    }
  }

  function openItem(item: FilesListItemDto) {
    if (item.isFolder) {
      setPath(item.path);
      return;
    }
    if (isImageFile(item.name)) {
      setPreviewPath(item.path);
    }
  }

  function enterTrashMode() {
    const trashPath = filesConfig?.trashPath;
    if (!trashPath) {
      toast.error('Papelera no configurada');
      return;
    }
    setTrashMode(true);
    setPath(trashPath);
  }

  function exitTrashMode() {
    setTrashMode(false);
    setPath('/');
  }

  async function handleDownload(item: FilesListItemDto) {
    if (item.isFolder) return;
    try {
      const res = await fetch(api.downloadDiskFileUrl(item.path), {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(
          typeof err.message === 'string' ? err.message : 'Error al descargar',
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Descarga iniciada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al descargar');
    }
  }

  async function handleTrash(item: FilesListItemDto) {
    const ok = await confirm({
      title: `¿Mover a la papelera?`,
      description: item.name,
      confirmLabel: 'Mover a papelera',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteFile(item.path, item.isFolder);
      toast.success('Movido a la papelera');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al mover');
    }
  }

  async function handleRestore(item: FilesListItemDto) {
    const ok = await confirm({
      title: `¿Restaurar ${item.name}?`,
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    try {
      await api.restoreFile(item.path);
      toast.success('Restaurado');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al restaurar');
    }
  }

  async function handleMkdir() {
    const name = mkdirName.trim();
    if (!name) return;
    const next =
      path === '/' ? `/${name}` : `${path.replace(/\/$/, '')}/${name}`;
    try {
      await api.mkdirFile(next);
      setMkdirName('');
      setMkdirOpen(false);
      toast.success('Carpeta creada');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear carpeta');
    }
  }

  function openMkdirDialog() {
    setMkdirName('');
    setMkdirOpen(true);
  }

  async function handleUpload(files: FileList | File[] | null) {
    if (!files?.length || trashMode) return;
    const list = Array.from(files);
    setUploading(true);
    setUploadProgress({ done: 0, total: list.length, name: list[0].name });
    try {
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i];
        setUploadProgress({ done: i, total: list.length, name: file.name });
        await api.uploadDiskFile(path, file);
      }
      toast.success(
        list.length === 1 ? 'Archivo subido' : `${list.length} archivos subidos`,
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openRename(item: FilesListItemDto) {
    setRenameTarget(item);
    setRenameValue(item.name);
  }

  async function submitRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name || name === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    const parent = dirname(renameTarget.path);
    const to =
      parent === '/' ? `/${name}` : `${parent.replace(/\/$/, '')}/${name}`;
    try {
      await api.renameFile(renameTarget.path, to);
      toast.success('Renombrado');
      setRenameTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al renombrar');
    }
  }

  function openMove(item: FilesListItemDto) {
    setMoveTarget(item);
  }

  async function submitMove(destDir: string) {
    if (!moveTarget) return;
    const to =
      destDir === '/'
        ? `/${moveTarget.name}`
        : `${destDir.replace(/\/$/, '')}/${moveTarget.name}`;
    if (to === moveTarget.path) {
      toast.error('El destino es la misma ubicación');
      return;
    }
    try {
      await api.renameFile(moveTarget.path, to);
      toast.success('Movido');
      setMoveTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al mover');
    }
  }

  function openCopy(item: FilesListItemDto) {
    setCopyTarget(item);
  }

  async function submitCopy(destDir: string) {
    if (!copyTarget) return;
    const to =
      destDir === '/'
        ? `/${copyTarget.name}`
        : `${destDir.replace(/\/$/, '')}/${copyTarget.name}`;
    try {
      await api.copyFile(copyTarget.path, to);
      toast.success('Copiado');
      setCopyTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al copiar');
    }
  }

  async function bulkTrash() {
    const targets = sortedItems.filter(
      (item) => selectedPaths.includes(item.path) && !item.locked,
    );
    if (!targets.length) return;
    const ok = await confirm({
      title: `¿Mover ${targets.length} elemento(s) a la papelera?`,
      confirmLabel: 'Mover a papelera',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      for (const item of targets) {
        await api.deleteFile(item.path, item.isFolder);
      }
      toast.success('Movido a la papelera');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al mover');
    }
  }

  async function bulkDownload() {
    const files = sortedItems.filter(
      (item) =>
        selectedPaths.includes(item.path) && !item.isFolder && !item.locked,
    );
    for (const item of files) {
      await handleDownload(item);
    }
  }

  function canRestore(item: FilesListItemDto): boolean {
    if (!trashMode || item.locked) return false;
    const trashPath = filesConfig?.trashPath;
    if (!trashPath || item.path === trashPath) return false;
    const prefix = `${trashPath}/`;
    if (!item.path.startsWith(prefix)) return false;
    const rest = item.path.slice(prefix.length);
    return rest.includes('/');
  }

  const previewItem = previewPath
    ? items.find((i) => i.path === previewPath)
    : null;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Archivos TMS"
        description="Explorador del disco de TMS."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className="size-4" />
              Actualizar
            </Button>
            {!trashMode ? (
              <>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="size-4" />
                  {uploading ? 'Subiendo…' : 'Subir'}
                </Button>
                {filesConfig?.trashPath ? (
                  <Button variant="outline" size="sm" onClick={enterTrashMode}>
                    <Trash2 className="size-4" />
                    Papelera
                  </Button>
                ) : null}
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={exitTrashMode}>
                Volver al explorador
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => void handleUpload(e.target.files)}
            />
          </div>
        }
      />

      {uploadProgress ? (
        <p className="text-sm text-muted-foreground">
          Subiendo {uploadProgress.done + 1}/{uploadProgress.total}:{' '}
          {uploadProgress.name}
        </p>
      ) : null}

      {error ? <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner> : null}

      {trashMode ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Vista de papelera — restaura archivos o navega por las carpetas con
          fecha.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                    onClick={() => setPath(crumb.path)}
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-48 pl-8"
              placeholder="Buscar…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {!trashMode ? (
            <Button variant="outline" size="sm" onClick={openMkdirDialog}>
              <FolderPlus className="size-4" />
              Nueva carpeta
            </Button>
          ) : null}
        </div>
      </div>

      {selectedPaths.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {selectedPaths.length} seleccionado(s)
          </span>
          {!trashMode ? (
            <>
              <Button size="sm" variant="outline" onClick={() => void bulkDownload()}>
                <Download className="size-4" />
                Descargar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void bulkTrash()}
              >
                <Trash2 className="size-4" />
                Papelera
              </Button>
            </>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedPaths([])}
          >
            Limpiar
          </Button>
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={8} />
      ) : sortedItems.length === 0 ? (
        <EmptyState
          title={trashMode ? 'Papelera vacía' : 'Carpeta vacía'}
          description={
            trashMode
              ? 'No hay elementos en la papelera.'
              : 'No hay archivos en esta ruta.'
          }
        />
      ) : (
        <div
          className={cn(
            'overflow-x-auto rounded-lg border transition-colors',
            dragOver && !trashMode && 'border-primary ring-2 ring-primary/20',
          )}
          onDragOver={(e) => {
            if (trashMode) return;
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!trashMode) void handleUpload(e.dataTransfer.files);
          }}
        >
          {!trashMode ? (
            <p
              className={cn(
                'border-b px-3 py-2 text-center text-xs text-muted-foreground',
                dragOver && 'bg-primary/5 text-primary',
              )}
            >
              Arrastra archivos aquí para subirlos a esta carpeta
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allSelected
                        ? true
                        : someSelected
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={() => toggleSelectAll()}
                    disabled={selectableItems.length === 0}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort('name')}
                  >
                    Nombre
                    <ArrowUpDown className="size-3.5 opacity-60" />
                  </button>
                </TableHead>
                <TableHead className="w-28">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort('size')}
                  >
                    Tamaño
                    <ArrowUpDown className="size-3.5 opacity-60" />
                  </button>
                </TableHead>
                <TableHead className="w-40">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    onClick={() => toggleSort('lastModified')}
                  >
                    Modificado
                    <ArrowUpDown className="size-3.5 opacity-60" />
                  </button>
                </TableHead>
                <TableHead className="w-44 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => (
                <TableRow key={item.path}>
                  <TableCell>
                    <Checkbox
                      checked={selectedPaths.includes(item.path)}
                      onCheckedChange={() => toggleSelect(item.path)}
                      disabled={item.locked}
                      aria-label={`Seleccionar ${item.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.isFolder ? (
                        <Folder className="size-4 shrink-0 text-amber-600" />
                      ) : isImageFile(item.name) ? (
                        <button
                          type="button"
                          className="size-8 shrink-0 overflow-hidden rounded border"
                          onClick={() => setPreviewPath(item.path)}
                        >
                          <img
                            src={api.previewDiskFileUrl(item.path)}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={cn(
                          'text-left font-medium',
                          (item.isFolder || isImageFile(item.name)) &&
                            'hover:underline',
                        )}
                        onClick={() => openItem(item)}
                        disabled={
                          !item.isFolder && !isImageFile(item.name)
                        }
                      >
                        {item.name}
                      </button>
                      {item.locked ? (
                        <Lock
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-label="Protegido"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.isFolder ? '—' : formatBytes(item.size ?? 0)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lastModified
                      ? formatDate(item.lastModified)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <IconActionButton
                        label="Información"
                        onClick={() => setInfoTarget(item)}
                      >
                        <Info className="size-4" />
                      </IconActionButton>
                      {!item.isFolder ? (
                        <IconActionButton
                          label="Descargar"
                          onClick={() => void handleDownload(item)}
                        >
                          <Download className="size-4" />
                        </IconActionButton>
                      ) : null}
                      {trashMode && canRestore(item) ? (
                        <IconActionButton
                          label="Restaurar"
                          onClick={() => void handleRestore(item)}
                        >
                          <RotateCcw className="size-4" />
                        </IconActionButton>
                      ) : null}
                      {!trashMode && !item.locked ? (
                        <>
                          <IconActionButton
                            label="Renombrar"
                            onClick={() => openRename(item)}
                          >
                            <Pencil className="size-4" />
                          </IconActionButton>
                          <IconActionButton
                            label="Mover"
                            onClick={() => openMove(item)}
                          >
                            <Folder className="size-4" />
                          </IconActionButton>
                          {!item.isFolder ? (
                            <IconActionButton
                              label="Copiar"
                              onClick={() => openCopy(item)}
                            >
                              <Copy className="size-4" />
                            </IconActionButton>
                          ) : null}
                          <IconActionButton
                            label="Mover a papelera"
                            variant="destructive"
                            onClick={() => void handleTrash(item)}
                          >
                            <Trash2 className="size-4" />
                          </IconActionButton>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={previewPath !== null}
        onOpenChange={(open) => !open && setPreviewPath(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewItem?.name ?? 'Vista previa'}</DialogTitle>
          </DialogHeader>
          {previewPath ? (
            <img
              src={api.previewDiskFileUrl(previewPath)}
              alt={previewItem?.name ?? ''}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={mkdirOpen}
        onOpenChange={(open) => {
          setMkdirOpen(open);
          if (!open) setMkdirName('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mkdir-input">Nombre</Label>
            <Input
              id="mkdir-input"
              placeholder="Mi carpeta"
              value={mkdirName}
              onChange={(e) => setMkdirName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleMkdir();
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Se creará en{' '}
              <span className="font-mono">{path === '/' ? '/' : path}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMkdirOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleMkdir()}
              disabled={!mkdirName.trim()}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">Nuevo nombre</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void submitRename()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilesItemInfoDialog
        open={infoTarget !== null}
        onOpenChange={(open) => !open && setInfoTarget(null)}
        item={infoTarget}
        trashMode={trashMode}
      />

      <FilesFolderPickerDialog
        open={moveTarget !== null}
        onOpenChange={(open) => !open && setMoveTarget(null)}
        title={moveTarget ? `Mover «${moveTarget.name}»` : 'Mover'}
        description="Navega y elige la carpeta de destino."
        confirmLabel="Mover aquí"
        initialPath={dirname(moveTarget?.path ?? path)}
        sourcePath={moveTarget?.path}
        sourceIsFolder={moveTarget?.isFolder}
        trashPath={filesConfig?.trashPath}
        onConfirm={submitMove}
      />

      <FilesFolderPickerDialog
        open={copyTarget !== null}
        onOpenChange={(open) => !open && setCopyTarget(null)}
        title={copyTarget ? `Copiar «${copyTarget.name}»` : 'Copiar'}
        description="Navega y elige la carpeta de destino."
        confirmLabel="Copiar aquí"
        initialPath={path}
        trashPath={filesConfig?.trashPath}
        onConfirm={submitCopy}
      />
    </div>
  );
}

function buildBreadcrumbs(path: string, trashMode: boolean) {
  const clean = path.replace(/\/+$/, '') || '/';
  const parts = clean === '/' ? [] : clean.split('/').filter(Boolean);

  if (trashMode) {
    if (parts.length === 0) {
      return [{ label: 'Papelera', path: '/' }];
    }
    const crumbs = [{ label: 'Papelera', path: `/${parts[0]}` }];
    let acc = `/${parts[0]}`;
    for (let i = 1; i < parts.length; i += 1) {
      acc += `/${parts[i]}`;
      crumbs.push({ label: parts[i], path: acc });
    }
    return crumbs;
  }

  const crumbs = [{ label: 'Raíz', path: '/' }];
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

function dirname(filePath: string): string {
  const clean = filePath.replace(/\/+$/, '');
  if (clean === '' || clean === '/') return '/';
  const idx = clean.lastIndexOf('/');
  if (idx <= 0) return '/';
  return clean.slice(0, idx);
}
