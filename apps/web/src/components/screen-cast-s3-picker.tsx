import { useCallback, useEffect, useState } from 'react';
import { Folder, HardDrive } from 'lucide-react';
import type { S3BucketInfo, S3ObjectItem } from '@mali-one/shared';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/format-bytes';
import { useToast } from '@/contexts/toast-context';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

const MEDIA_EXT = /\.(jpe?g|png|gif|mp4)$/i;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
};

export function ScreenCastS3Picker({ open, onOpenChange, onSelect }: Props) {
  const toast = useToast();
  const [buckets, setBuckets] = useState<S3BucketInfo[]>([]);
  const [bucket, setBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState('');
  const [items, setItems] = useState<S3ObjectItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBuckets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listScreenCastS3Buckets();
      setBuckets(data);
      setBucket((current) => current ?? data[0]?.name ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar buckets');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadObjects = useCallback(async () => {
    if (!bucket) return;
    setLoading(true);
    try {
      const data = await api.listScreenCastS3Objects(bucket, prefix);
      setItems(data.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al listar archivos');
    } finally {
      setLoading(false);
    }
  }, [bucket, prefix, toast]);

  useEffect(() => {
    if (open) void loadBuckets();
  }, [open, loadBuckets]);

  useEffect(() => {
    if (open && bucket) void loadObjects();
  }, [open, bucket, prefix, loadObjects]);

  async function selectFile(item: S3ObjectItem) {
    if (!bucket || item.isFolder) return;
    try {
      const { url } = await api.getScreenCastS3PublicUrl(bucket, item.key);
      if (!url) {
        toast.error('Este archivo no tiene URL pública');
        return;
      }
      onSelect(url);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al obtener URL');
    }
  }

  const visible = items.filter(
    (item) => item.isFolder || MEDIA_EXT.test(item.name),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Elegir de S3</DialogTitle>
          <DialogDescription>
            Selecciona un JPG, PNG, GIF o MP4 con URL pública.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {buckets.map((b) => (
            <Button
              key={b.name}
              type="button"
              size="sm"
              variant={bucket === b.name ? 'default' : 'outline'}
              onClick={() => {
                setBucket(b.name);
                setPrefix('');
              }}
            >
              <HardDrive size={14} />
              {b.name}
            </Button>
          ))}
        </div>

        {prefix && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => {
              const parts = prefix.replace(/\/$/, '').split('/');
              parts.pop();
              setPrefix(parts.length ? `${parts.join('/')}/` : '');
            }}
          >
            ← Subir un nivel
          </Button>
        )}

        <div className="max-h-80 overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-24">Tamaño</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted">
                    Sin archivos multimedia en esta carpeta
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                visible.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {item.isFolder && <Folder size={14} />}
                        {item.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.isFolder ? '—' : formatBytes(item.size ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.isFolder ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPrefix(item.key)}
                        >
                          Abrir
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void selectFile(item)}
                        >
                          Usar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function inferScreenCastMediaType(
  url: string,
): 'image' | 'video' | 'gif' {
  const path = url.toLowerCase().split('?')[0] ?? '';
  if (path.endsWith('.mp4') || path.endsWith('.webm')) return 'video';
  if (path.endsWith('.gif')) return 'gif';
  return 'image';
}
