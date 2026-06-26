import { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight,
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
import { AlertBanner, EmptyState, Spinner } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export function S3ManagerPage() {
  const toast = useToast();
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
    if (!confirm(`¿Eliminar ${item.name}?`)) return;
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
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-3 text-sm">
            <button
              type="button"
              className="rounded px-2 py-1 hover:bg-border/60"
              onClick={() => navigateToPrefix('')}
            >
              {selectedBucket ?? '—'}
            </button>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.prefix} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-muted" />
                <button
                  type="button"
                  className="rounded px-2 py-1 hover:bg-border/60"
                  onClick={() => navigateToPrefix(crumb.prefix)}
                >
                  {crumb.label}
                </button>
              </span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-muted">
                <tr>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Tamaño</th>
                  <th className="p-4">Modificado</th>
                  <th className="p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingObjects && items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted">
                      <Spinner className="mx-auto" />
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        title="Carpeta vacía"
                        description="No hay archivos en esta ubicación."
                      />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.key} className="border-b border-border/60">
                      <td className="p-4">
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
                      </td>
                      <td className="p-4 text-muted">
                        {formatBytes(item.size)}
                      </td>
                      <td className="p-4 text-muted">
                        {formatDate(item.lastModified)}
                      </td>
                      <td className="p-4">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
