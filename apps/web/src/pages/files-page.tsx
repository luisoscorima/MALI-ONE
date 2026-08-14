import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Folder,
  FolderPlus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { FilesListItemDto } from '@mali-one/shared';
import { IconActionButton } from '@/components/icon-action-button';
import { api } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format-bytes';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

export function FilesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState('/');
  const [items, setItems] = useState<FilesListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mkdirName, setMkdirName] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listFiles(path);
      setItems(data.items);
      setPath(data.path || path);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Error al listar archivos';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [path, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSearchQuery('');
  }, [path]);

  const breadcrumbs = buildBreadcrumbs(path);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  function openFolder(item: FilesListItemDto) {
    if (item.isFolder) setPath(item.path);
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

  async function handleDelete(item: FilesListItemDto) {
    const ok = await confirm({
      title: `¿Eliminar ${item.name}?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteFile(item.path, item.isFolder);
      toast.success('Eliminado');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
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
      toast.success('Carpeta creada');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear carpeta');
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await api.uploadDiskFile(path, file);
      }
      toast.success(
        files.length === 1 ? 'Archivo subido' : `${files.length} archivos subidos`,
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Archivos (disco)"
        description="Explorador del disco compartido (SFTPGo)."
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
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="size-4" />
              {uploading ? 'Subiendo…' : 'Subir'}
            </Button>
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

      {error ? <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner> : null}

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
          <div className="flex gap-1.5">
            <Input
              className="h-8 w-40"
              placeholder="Nueva carpeta"
              value={mkdirName}
              onChange={(e) => setMkdirName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleMkdir();
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleMkdir()}
              disabled={!mkdirName.trim()}
            >
              <FolderPlus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Carpeta vacía"
          description="No hay archivos en esta ruta."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-28">Tamaño</TableHead>
                <TableHead className="w-40">Modificado</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.path}>
                  <TableCell>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-left font-medium hover:underline"
                      onClick={() => openFolder(item)}
                      disabled={!item.isFolder}
                    >
                      {item.isFolder ? (
                        <Folder className="size-4 text-amber-600" />
                      ) : null}
                      {item.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.isFolder
                      ? '—'
                      : formatBytes(item.size ?? 0)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lastModified
                      ? formatDate(item.lastModified)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {!item.isFolder ? (
                        <IconActionButton
                          label="Descargar"
                          onClick={() => void handleDownload(item)}
                        >
                          <Download className="size-4" />
                        </IconActionButton>
                      ) : null}
                      <IconActionButton
                        label="Eliminar"
                        onClick={() => void handleDelete(item)}
                      >
                        <Trash2 className="size-4" />
                      </IconActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function buildBreadcrumbs(path: string) {
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
