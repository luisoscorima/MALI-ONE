import { useCallback, useEffect, useState } from 'react';
import * as React from 'react';
import {
  Download,
  Folder,
  HardDrive,
  Link2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { S3BucketInfo, S3ObjectItem } from '@mali-one/shared';
import { api } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format-bytes';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, Spinner } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { cn } from '@/lib/utils';

export function S3ManagerPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [buckets, setBuckets] = useState<S3BucketInfo[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [items, setItems] = useState<S3ObjectItem[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingBuckets, setLoadingBuckets] = useState(true);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [error, setError] = useState('');

  const loadBuckets = useCallback(async () => {
    setLoadingBuckets(true);
    setError('');
    try {
      const data = await api.listS3Buckets();
      setBuckets(data);
      setSelectedBucket((current) => current ?? data[0]?.name ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar buckets';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingBuckets(false);
    }
  }, [toast]);

  const loadObjects = useCallback(
    async (append = false, token?: string) => {
      if (!selectedBucket) return;
      setLoadingObjects(true);
      if (!append) setError('');
      try {
        const data = await api.listS3Objects(
          selectedBucket,
          prefix,
          append ? token : undefined,
        );
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextToken(data.nextContinuationToken);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al listar archivos';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoadingObjects(false);
      }
    },
    [selectedBucket, prefix, toast],
  );

  useEffect(() => {
    void loadBuckets();
  }, [loadBuckets]);

  useEffect(() => {
    if (selectedBucket) {
      setPrefix('');
    }
  }, [selectedBucket]);

  useEffect(() => {
    if (selectedBucket) {
      void loadObjects(false);
    }
  }, [selectedBucket, prefix, loadObjects]);

  function openFolder(item: S3ObjectItem) {
    if (item.isFolder) {
      setPrefix(item.key);
    }
  }

  function navigateToPrefix(newPrefix: string) {
    setPrefix(newPrefix);
  }

  const breadcrumbs = buildBreadcrumbs(prefix);

  async function handleDownload(item: S3ObjectItem) {
    if (!selectedBucket || item.isFolder) return;
    try {
      const { url } = await api.getS3DownloadUrl(selectedBucket, item.key);
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('Descarga iniciada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al descargar');
    }
  }

  async function handleDelete(item: S3ObjectItem) {
    if (!selectedBucket || item.isFolder) return;
    const ok = await confirm({
      title: `¿Eliminar ${item.name}?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteS3Object(selectedBucket, item.key);
      toast.success('Archivo eliminado');
      void loadObjects(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  async function handleCopyPublicUrl(item: S3ObjectItem) {
    if (!selectedBucket || item.isFolder) return;
    try {
      const { url } = await api.getS3PublicUrl(selectedBucket, item.key);
      if (!url) {
        toast.error('Este archivo no tiene enlace público');
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Enlace público copiado al portapapeles');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Error al obtener enlace público',
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Gestor S3"
        description="Explora buckets y archivos de AWS (solo super administrador)"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void loadBuckets();
              if (selectedBucket) void loadObjects(false);
            }}
          >
            <RefreshCw size={16} className="mr-2 inline" />
            Actualizar
          </Button>
        }
      />

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card className="h-fit p-3">
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted">
            Buckets
          </p>
          {loadingBuckets ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <ul className="space-y-1">
              {buckets.map((b) => (
                <li key={b.name}>
                  <button
                    type="button"
                    onClick={() => setSelectedBucket(b.name)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selectedBucket === b.name
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-border/60',
                    )}
                  >
                    <HardDrive size={16} />
                    <span className="truncate">{b.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <button type="button" onClick={() => navigateToPrefix('')}>
                      {selectedBucket ?? '—'}
                    </button>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.prefix}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            onClick={() => navigateToPrefix(crumb.prefix)}
                          >
                            {crumb.label}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="text-muted">
                  <TableHead className="p-4">Nombre</TableHead>
                  <TableHead className="p-4">Tamaño</TableHead>
                  <TableHead className="p-4">Modificado</TableHead>
                  <TableHead className="p-4">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingObjects && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-8 text-center text-muted">
                      <Spinner className="mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <EmptyState
                        title="Carpeta vacía"
                        description="No hay archivos en esta ubicación."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.key} className="border-border/60">
                      <TableCell className="p-4">
                        {item.isFolder ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 font-medium text-primary hover:underline"
                            onClick={() => openFolder(item)}
                          >
                            <Folder size={16} />
                            {item.name}
                          </button>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="text-muted">📄</span>
                            {item.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="p-4 text-muted">
                        {formatBytes(item.size)}
                      </TableCell>
                      <TableCell className="p-4 text-muted">
                        {formatDate(item.lastModified)}
                      </TableCell>
                      <TableCell className="p-4">
                        {!item.isFolder && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              onClick={() => void handleDownload(item)}
                            >
                              <Download size={14} className="mr-1 inline" />
                              Descargar
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handleCopyPublicUrl(item)}
                            >
                              <Link2 size={14} className="mr-1 inline" />
                              Enlace público
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => void handleDelete(item)}
                            >
                              <Trash2 size={14} className="mr-1 inline" />
                              Eliminar
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {nextToken && !loadingObjects && (
            <div className="border-t border-border p-4">
              <Button
                variant="outline"
                onClick={() => void loadObjects(true, nextToken)}
              >
                Cargar más
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function buildBreadcrumbs(prefix: string) {
  if (!prefix) return [];
  const parts = prefix.replace(/\/$/, '').split('/');
  return parts.map((part, i) => ({
    label: part,
    prefix: `${parts.slice(0, i + 1).join('/')}/`,
  }));
}
