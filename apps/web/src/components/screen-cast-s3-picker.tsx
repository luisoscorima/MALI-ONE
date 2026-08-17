import { useCallback, useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import type { S3ObjectItem } from '@mali-one/shared';
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
  const [bucket, setBucket] = useState<string | null>(null);
  const [defaultPrefix, setDefaultPrefix] = useState('');
  const [prefix, setPrefix] = useState('');
  const [items, setItems] = useState<S3ObjectItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const config = await api.getScreenCastS3PickerConfig();
      setBucket(config.bucket);
      setDefaultPrefix(config.defaultPrefix);
      setPrefix(config.defaultPrefix);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar S3');
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
    if (open) void loadConfig();
  }, [open, loadConfig]);

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

  function goUpOneLevel() {
    const current = prefix.replace(/\/$/, '');
    const min = defaultPrefix.replace(/\/$/, '');
    const parts = current.split('/').filter(Boolean);
    parts.pop();
    const next = parts.length ? `${parts.join('/')}/` : '';
    const nextDepth = parts.length;
    const minDepth = min ? min.split('/').filter(Boolean).length : 0;
    setPrefix(nextDepth < minDepth ? defaultPrefix : next || defaultPrefix);
  }

  const canGoUp =
    prefix.replace(/\/$/, '') !== defaultPrefix.replace(/\/$/, '');

  const visible = items.filter(
    (item) => item.isFolder || MEDIA_EXT.test(item.name),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Elegir de S3</DialogTitle>
          <DialogDescription>
            {bucket
              ? `Bucket ${bucket} · carpeta screen-cast`
              : 'Selecciona un JPG, PNG, GIF o MP4 con URL pública.'}
          </DialogDescription>
        </DialogHeader>

        {canGoUp ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={goUpOneLevel}
          >
            ← Subir un nivel
          </Button>
        ) : null}

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
  if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov'))
    return 'video';
  if (path.endsWith('.gif')) return 'gif';
  return 'image';
}
