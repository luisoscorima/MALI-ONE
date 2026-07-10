import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import type {
  ScreenCastMediaType,
  ScreenCastPlaylistItemDto,
} from '@mali-one/shared';
import { PageLoading, AlertBanner } from '@/components/feedback';
import { ScreenCastBackLink } from '@/pages/screen-cast-hub-page';
import { ScreenCastMediaUrlField } from '@/components/screen-cast-media-url-field';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingSwitchInline,
} from '@/components/ui';

type ItemDraft = {
  id?: string;
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
  durationMs: number;
  sortOrder: number;
  activo: boolean;
};

function emptyItem(sortOrder: number): ItemDraft {
  return {
    mediaUrl: '',
    mediaType: 'image',
    durationMs: 10_000,
    sortOrder,
    activo: true,
  };
}

export function ScreenCastPlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [activo, setActivo] = useState(true);
  const [items, setItems] = useState<ScreenCastPlaylistItemDto[]>([]);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getScreenCastPlaylist(id);
      setName(data.name);
      setActivo(data.activo);
      setItems(data.items ?? []);
      setError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta() {
    if (!id) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSavingMeta(true);
    try {
      await api.updateScreenCastPlaylist(id, { name: trimmed, activo });
      toast.success('Playlist guardada');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingMeta(false);
    }
  }

  async function persistItem(item: ItemDraft) {
    if (!id) return;
    const mediaUrl = item.mediaUrl.trim();
    if (!mediaUrl) {
      toast.error('La URL del medio es obligatoria');
      return;
    }
    const payload = {
      mediaUrl,
      mediaType: item.mediaType,
      durationMs: item.durationMs,
      sortOrder: item.sortOrder,
      activo: item.activo,
    };
    try {
      if (item.id) {
        await api.updateScreenCastPlaylistItem(item.id, payload);
        toast.success('Ítem guardado');
      } else {
        await api.createScreenCastPlaylistItem(id, payload);
        toast.success('Ítem creado');
      }
      setDraft(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar ítem');
    }
  }

  async function removeItem(item: ScreenCastPlaylistItemDto) {
    const ok = await confirm({
      title: '¿Eliminar este ítem?',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteScreenCastPlaylistItem(item.id);
      toast.success('Ítem eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  async function removePlaylist() {
    if (!id) return;
    const ok = await confirm({
      title: `¿Eliminar «${name}»?`,
      description: 'Los monitores asignados quedarán sin playlist.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteScreenCastPlaylist(id);
      toast.success('Playlist eliminada');
      navigate('/admin/screen-cast/playlists');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div>
      <ScreenCastBackLink />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Editar playlist</h1>
          <p className="mt-1 text-sm text-muted">
            JPG, PNG, GIF y MP4. Pega una URL o elige desde S3.
          </p>
        </div>
        <Button type="button" variant="destructive" onClick={() => void removePlaylist()}>
          <Trash2 size={16} />
          Eliminar playlist
        </Button>
      </div>

      {error && <AlertBanner>{error}</AlertBanner>}

      <Card className="mb-6 space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pl-detail-name">Nombre</Label>
            <Input
              id="pl-detail-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <SettingSwitchInline
              label="Activa"
              checked={activo}
              onCheckedChange={setActivo}
            />
          </div>
        </div>
        <Button type="button" disabled={savingMeta} onClick={() => void saveMeta()}>
          Guardar playlist
        </Button>
      </Card>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Ítems ({items.length})</h2>
        <Button
          type="button"
          onClick={() => setDraft(emptyItem(items.length))}
        >
          <Plus size={16} />
          Añadir ítem
        </Button>
      </div>

      {draft && (
        <Card className="mb-4 space-y-4 p-4">
          <h3 className="font-medium">
            {draft.id ? 'Editar ítem' : 'Nuevo ítem'}
          </h3>
          <div className="space-y-2">
            <Label>URL del medio</Label>
            <ScreenCastMediaUrlField
              value={draft.mediaUrl}
              onChange={(url, type) =>
                setDraft({
                  ...draft,
                  mediaUrl: url,
                  ...(type ? { mediaType: type } : {}),
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={draft.mediaType}
                onValueChange={(v) =>
                  setDraft({
                    ...draft,
                    mediaType: v as ScreenCastMediaType,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Imagen (JPG/PNG)</SelectItem>
                  <SelectItem value="gif">GIF</SelectItem>
                  <SelectItem value="video">Video (MP4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dur">Duración (ms)</Label>
              <Input
                id="dur"
                type="number"
                min={1000}
                step={1000}
                value={draft.durationMs}
                disabled={draft.mediaType === 'video'}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    durationMs: Number(e.target.value) || 10_000,
                  })
                }
              />
              {draft.mediaType === 'video' && (
                <p className="text-xs text-muted">
                  El video avanza al terminar (onEnded).
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">Orden</Label>
              <Input
                id="order"
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    sortOrder: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <SettingSwitchInline
            label="Activo"
            checked={draft.activo}
            onCheckedChange={(v) => setDraft({ ...draft, activo: v })}
          />
          <div className="flex gap-2">
            <Button type="button" onClick={() => void persistItem(draft)}>
              Guardar ítem
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft(null)}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-muted">
              {item.mediaType === 'video' ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  MP4
                </div>
              ) : (
                <img
                  src={item.mediaUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.mediaUrl}</p>
              <p className="text-xs text-muted">
                {item.mediaType} · orden {item.sortOrder}
                {item.mediaType !== 'video'
                  ? ` · ${Math.round(item.durationMs / 1000)}s`
                  : ''}
                {!item.activo ? ' · inactivo' : ''}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({
                    id: item.id,
                    mediaUrl: item.mediaUrl,
                    mediaType: item.mediaType,
                    durationMs: item.durationMs,
                    sortOrder: item.sortOrder,
                    activo: item.activo,
                  })
                }
              >
                Editar
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => void removeItem(item)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </Card>
        ))}
        {items.length === 0 && !draft && (
          <p className="text-sm text-muted">Aún no hay ítems en esta playlist.</p>
        )}
      </div>
    </div>
  );
}
