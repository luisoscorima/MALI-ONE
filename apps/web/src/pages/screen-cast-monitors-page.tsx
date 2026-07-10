import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import type {
  ScreenCastMonitorDto,
  ScreenCastOrientation,
  ScreenCastPlaylistDto,
} from '@mali-one/shared';
import { PageLoading, EmptyState, AlertBanner } from '@/components/feedback';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { ScreenCastBackLink } from '@/pages/screen-cast-hub-page';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

type Draft = {
  id?: string;
  screenKey: string;
  name: string;
  location: string;
  orientation: ScreenCastOrientation;
  playlistId: string;
};

const emptyDraft = (): Draft => ({
  screenKey: '',
  name: '',
  location: '',
  orientation: 'LANDSCAPE',
  playlistId: '',
});

export function ScreenCastMonitorsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [monitors, setMonitors] = useState<ScreenCastMonitorDto[]>([]);
  const [playlists, setPlaylists] = useState<ScreenCastPlaylistDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([
        api.listScreenCastMonitors(),
        api.listScreenCastPlaylists(),
      ]);
      setMonitors(m);
      setPlaylists(p);
      setError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void api.listScreenCastMonitors().then(setMonitors).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function saveDraft() {
    if (!draft) return;
    const screenKey = draft.screenKey.trim().toLowerCase();
    const name = draft.name.trim();
    if (!screenKey || !name) {
      toast.error('ID y nombre son obligatorios');
      return;
    }
    const payload = {
      screenKey,
      name,
      location: draft.location.trim() || undefined,
      orientation: draft.orientation,
      playlistId: draft.playlistId || null,
    };
    try {
      if (draft.id) {
        await api.updateScreenCastMonitor(draft.id, payload);
        toast.success('Monitor actualizado');
      } else {
        await api.createScreenCastMonitor(payload);
        toast.success('Monitor creado');
      }
      setDraft(null);
      setPreviewKey((k) => k + 1);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function remove(monitor: ScreenCastMonitorDto) {
    const ok = await confirm({
      title: `¿Eliminar ${monitor.name}?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteScreenCastMonitor(monitor.id);
      toast.success('Monitor eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function copyUrl(screenKey: string) {
    const url = `${window.location.origin}/screen-cast?id=${encodeURIComponent(screenKey)}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success('URL copiada'),
      () => toast.error('No se pudo copiar'),
    );
  }

  if (loading) return <PageLoading />;

  const previewScreenKey = draft?.screenKey || monitors[0]?.screenKey;

  return (
    <WidgetToolLayout
      title="Monitores"
      description="Registra pantallas físicas y asigna una playlist. El estado Online/Offline se actualiza con el latido cada 30s."
      backLink={<ScreenCastBackLink />}
      config={
        <div className="space-y-6">
          {error && <AlertBanner>{error}</AlertBanner>}

          <div className="flex justify-end">
            <Button type="button" onClick={() => setDraft(emptyDraft())}>
              <Plus size={16} />
              Nuevo monitor
            </Button>
          </div>

          {draft && (
            <Card className="space-y-4 p-4">
              <h2 className="font-medium">
                {draft.id ? 'Editar monitor' : 'Nuevo monitor'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sc-key">ID de pantalla</Label>
                  <Input
                    id="sc-key"
                    value={draft.screenKey}
                    placeholder="pantalla_001"
                    onChange={(e) =>
                      setDraft({ ...draft, screenKey: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-name">Nombre</Label>
                  <Input
                    id="sc-name"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sc-loc">Ubicación</Label>
                  <Input
                    id="sc-loc"
                    value={draft.location}
                    onChange={(e) =>
                      setDraft({ ...draft, location: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Orientación</Label>
                  <Select
                    value={draft.orientation}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        orientation: v as ScreenCastOrientation,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LANDSCAPE">Horizontal (Landscape)</SelectItem>
                      <SelectItem value="PORTRAIT">Vertical (Portrait)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Playlist</Label>
                  <Select
                    value={draft.playlistId || '__none__'}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        playlistId: v === '__none__' ? '' : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin playlist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin playlist</SelectItem>
                      {playlists.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void saveDraft()}>
                  Guardar
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

          {monitors.length === 0 ? (
            <EmptyState title="Sin monitores" description="Crea el primero para obtener su URL de reproducción." />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Orientación</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Playlist</TableHead>
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitors.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant={m.online ? 'default' : 'secondary'}>
                          {m.online ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {m.screenKey}
                      </TableCell>
                      <TableCell>
                        {m.orientation === 'PORTRAIT' ? 'Vertical' : 'Horizontal'}
                      </TableCell>
                      <TableCell>{m.location || '—'}</TableCell>
                      <TableCell>
                        {m.playlistName ? (
                          <Link
                            to={`/admin/screen-cast/playlists/${m.playlistId}`}
                            className="text-sm underline-offset-2 hover:underline"
                          >
                            {m.playlistName}
                          </Link>
                        ) : (
                          <span className="text-muted">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Copiar URL"
                            onClick={() => copyUrl(m.screenKey)}
                          >
                            <Copy size={16} />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            onClick={() =>
                              setDraft({
                                id: m.id,
                                screenKey: m.screenKey,
                                name: m.name,
                                location: m.location ?? '',
                                orientation: m.orientation ?? 'LANDSCAPE',
                                playlistId: m.playlistId ?? '',
                              })
                            }
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Eliminar"
                            onClick={() => void remove(m)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      }
      preview={
        previewScreenKey ? (
          <WidgetPreviewFrame
            key={previewKey}
            tabs={[
              {
                id: 'player',
                label: `Pantalla ${previewScreenKey}`,
                src: `/screen-cast?id=${encodeURIComponent(previewScreenKey)}`,
                height: '540px',
              },
            ]}
          />
        ) : (
          <EmptyState
            title="Sin vista previa"
            description="Crea un monitor para previsualizar el reproductor."
          />
        )
      }
    />
  );
}
