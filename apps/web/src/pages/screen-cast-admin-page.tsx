import { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type {
  ScreenCastMediaType,
  ScreenCastMonitorDto,
  ScreenCastOrientation,
  ScreenCastPlaylistDto,
  ScreenCastPlaylistItemDto,
} from '@mali-one/shared';
import { PageLoading, EmptyState, AlertBanner } from '@/components/feedback';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { ScreenCastMediaUrlField } from '@/components/screen-cast-media-url-field';
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
  SettingSwitchInline,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

type PlaylistSummary = ScreenCastPlaylistDto & {
  _count?: { monitors: number; items: number };
};

type ItemDraft = {
  id?: string;
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
  durationMs: number;
  sortOrder: number;
  activo: boolean;
};

type MonitorDraft = {
  id?: string;
  screenKey: string;
  name: string;
  location: string;
  orientation: ScreenCastOrientation;
  playlistId: string;
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

function emptyMonitorDraft(): MonitorDraft {
  return {
    screenKey: '',
    name: '',
    location: '',
    orientation: 'LANDSCAPE',
    playlistId: '',
  };
}

export function ScreenCastAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [monitors, setMonitors] = useState<ScreenCastMonitorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null,
  );
  const [playlistName, setPlaylistName] = useState('');
  const [playlistActivo, setPlaylistActivo] = useState(true);
  const [items, setItems] = useState<ScreenCastPlaylistItemDto[]>([]);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const [monitorDraft, setMonitorDraft] = useState<MonitorDraft | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [syncingMonitors, setSyncingMonitors] = useState(false);
  const [previewMonitorId, setPreviewMonitorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  const loadLists = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([
        api.listScreenCastPlaylists(),
        api.listScreenCastMonitors(),
      ]);
      setPlaylists(p);
      setMonitors(m);
      setError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadPlaylistDetail = useCallback(
    async (id: string) => {
      setLoadingPlaylist(true);
      try {
        const data = await api.getScreenCastPlaylist(id);
        setPlaylistName(data.name);
        setPlaylistActivo(data.activo);
        setItems(data.items ?? []);
        setItemDraft(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al cargar playlist');
        setSelectedPlaylistId(null);
      } finally {
        setLoadingPlaylist(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (selectedPlaylistId) void loadPlaylistDetail(selectedPlaylistId);
  }, [selectedPlaylistId, loadPlaylistDetail]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void api.listScreenCastMonitors().then(setMonitors).catch(() => undefined);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (monitors.length === 0) {
      setPreviewMonitorId(null);
      return;
    }
    setPreviewMonitorId((current) => {
      if (current && monitors.some((m) => m.id === current)) return current;
      return monitors[0]!.id;
    });
  }, [monitors]);

  async function createPlaylist() {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setCreatingPlaylist(true);
    try {
      const created = await api.createScreenCastPlaylist({ name: trimmed });
      toast.success('Playlist creada');
      setNewPlaylistName('');
      await loadLists();
      setSelectedPlaylistId(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setCreatingPlaylist(false);
    }
  }

  async function savePlaylistMeta() {
    if (!selectedPlaylistId) return;
    const trimmed = playlistName.trim();
    if (!trimmed) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSavingMeta(true);
    try {
      await api.updateScreenCastPlaylist(selectedPlaylistId, {
        name: trimmed,
        activo: playlistActivo,
      });
      toast.success('Playlist guardada');
      await loadLists();
      await loadPlaylistDetail(selectedPlaylistId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingMeta(false);
    }
  }

  async function persistItem(item: ItemDraft) {
    if (!selectedPlaylistId) return;
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
        await api.createScreenCastPlaylistItem(selectedPlaylistId, payload);
        toast.success('Ítem creado');
      }
      setItemDraft(null);
      await loadLists();
      await loadPlaylistDetail(selectedPlaylistId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar ítem');
    }
  }

  async function removeItem(item: ScreenCastPlaylistItemDto) {
    if (!selectedPlaylistId) return;
    const ok = await confirm({
      title: '¿Eliminar este ítem?',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteScreenCastPlaylistItem(item.id);
      toast.success('Ítem eliminado');
      await loadLists();
      await loadPlaylistDetail(selectedPlaylistId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  async function removePlaylist(playlist: PlaylistSummary) {
    const ok = await confirm({
      title: `¿Eliminar «${playlist.name}»?`,
      description: 'Los monitores asignados quedarán sin playlist.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteScreenCastPlaylist(playlist.id);
      toast.success('Playlist eliminada');
      if (selectedPlaylistId === playlist.id) {
        setSelectedPlaylistId(null);
        setItems([]);
      }
      await loadLists();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  async function saveMonitorDraft() {
    if (!monitorDraft) return;
    const screenKey = monitorDraft.screenKey.trim().toLowerCase();
    const name = monitorDraft.name.trim();
    if (!screenKey || !name) {
      toast.error('ID y nombre son obligatorios');
      return;
    }
    const payload = {
      screenKey,
      name,
      location: monitorDraft.location.trim() || undefined,
      orientation: monitorDraft.orientation,
      playlistId: monitorDraft.playlistId || null,
    };
    try {
      if (monitorDraft.id) {
        await api.updateScreenCastMonitor(monitorDraft.id, payload);
        toast.success('Monitor actualizado');
      } else {
        await api.createScreenCastMonitor(payload);
        toast.success('Monitor creado');
      }
      setMonitorDraft(null);
      setPreviewKey((k) => k + 1);
      await loadLists();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function removeMonitor(monitor: ScreenCastMonitorDto) {
    const ok = await confirm({
      title: `¿Eliminar ${monitor.name}?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteScreenCastMonitor(monitor.id);
      toast.success('Monitor eliminado');
      await loadLists();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  async function syncAllMonitors() {
    if (monitors.length === 0) {
      toast.error('No hay monitores para sincronizar');
      return;
    }
    setSyncingMonitors(true);
    try {
      const result = await api.syncAllScreenCastMonitors();
      toast.success(
        result.notified === 1
          ? '1 pantalla notificada'
          : `${result.notified} pantallas notificadas`,
      );
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al sincronizar');
    } finally {
      setSyncingMonitors(false);
    }
  }

  function copyUrl(screenKey: string) {
    const url = `${window.location.origin}/screen-cast?id=${encodeURIComponent(screenKey)}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success('URL copiada'),
      () => toast.error('No se pudo copiar'),
    );
  }

  function selectPlaylistFromMonitor(playlistId: string | null | undefined) {
    if (!playlistId) return;
    setSelectedPlaylistId(playlistId);
  }

  function selectMonitorForPreview(monitorId: string) {
    setPreviewMonitorId(monitorId);
    setPreviewKey((k) => k + 1);
    setActiveTab('preview');
  }

  if (loading) return <PageLoading />;

  const previewMonitor =
    monitors.find((m) => m.id === previewMonitorId) ?? monitors[0] ?? null;
  const previewScreenKey = previewMonitor?.screenKey;

  return (
    <WidgetToolLayout
      title="Transmisión a pantallas"
      description="Configura listas de reproducción y monitores quiosco desde un solo panel."
      activeTab={activeTab}
      onActiveTabChange={setActiveTab}
      config={
        <div className="space-y-10">
          {error && <AlertBanner>{error}</AlertBanner>}

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">Listas de reproducción</h2>
              <p className="mt-1 text-sm text-muted">
                Playlists reutilizables con imágenes, GIFs y videos.
              </p>
            </div>

            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="pl-name">Nueva playlist</Label>
                <Input
                  id="pl-name"
                  value={newPlaylistName}
                  placeholder="Lobby principal"
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createPlaylist();
                  }}
                />
              </div>
              <Button
                type="button"
                disabled={creatingPlaylist}
                onClick={() => void createPlaylist()}
              >
                <Plus size={16} />
                Crear
              </Button>
            </Card>

            {playlists.length === 0 ? (
              <EmptyState
                title="Sin playlists"
                description="Crea una lista y añade imágenes o videos."
              />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Ítems</TableHead>
                      <TableHead>Monitores</TableHead>
                      <TableHead className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playlists.map((p) => (
                      <TableRow
                        key={p.id}
                        className={
                          selectedPlaylistId === p.id
                            ? 'bg-muted/50'
                            : undefined
                        }
                      >
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => setSelectedPlaylistId(p.id)}
                          >
                            {p.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.activo ? 'default' : 'secondary'}>
                            {p.activo ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </TableCell>
                        <TableCell>{p._count?.items ?? 0}</TableCell>
                        <TableCell>{p._count?.monitors ?? 0}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Editar"
                              onClick={() => setSelectedPlaylistId(p.id)}
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Eliminar"
                              onClick={() => void removePlaylist(p)}
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

            {selectedPlaylistId && (
              <Card className="space-y-6 p-4">
                {loadingPlaylist ? (
                  <p className="text-sm text-muted">Cargando playlist…</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium">Editar playlist</h3>
                        <p className="mt-1 text-sm text-muted">
                          JPG, PNG, GIF y MP4. Pega una URL o elige desde S3.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedPlaylistId(null);
                          setItemDraft(null);
                        }}
                      >
                        Cerrar
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pl-detail-name">Nombre</Label>
                        <Input
                          id="pl-detail-name"
                          value={playlistName}
                          onChange={(e) => setPlaylistName(e.target.value)}
                        />
                      </div>
                      <div className="flex items-end">
                        <SettingSwitchInline
                          label="Activa"
                          checked={playlistActivo}
                          onCheckedChange={setPlaylistActivo}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      disabled={savingMeta}
                      onClick={() => void savePlaylistMeta()}
                    >
                      Guardar playlist
                    </Button>

                    <div className="flex items-center justify-between border-t pt-4">
                      <h4 className="font-medium">Ítems ({items.length})</h4>
                      <Button
                        type="button"
                        onClick={() => setItemDraft(emptyItem(items.length))}
                      >
                        <Plus size={16} />
                        Añadir ítem
                      </Button>
                    </div>

                    {itemDraft && (
                      <div className="space-y-4 rounded-md border p-4">
                        <h4 className="font-medium">
                          {itemDraft.id ? 'Editar ítem' : 'Nuevo ítem'}
                        </h4>
                        <div className="space-y-2">
                          <Label>URL del medio</Label>
                          <ScreenCastMediaUrlField
                            value={itemDraft.mediaUrl}
                            onChange={(url, type) =>
                              setItemDraft({
                                ...itemDraft,
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
                              value={itemDraft.mediaType}
                              onValueChange={(v) =>
                                setItemDraft({
                                  ...itemDraft,
                                  mediaType: v as ScreenCastMediaType,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="image">
                                  Imagen (JPG/PNG)
                                </SelectItem>
                                <SelectItem value="gif">GIF</SelectItem>
                                <SelectItem value="video">
                                  Video (MP4)
                                </SelectItem>
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
                              value={itemDraft.durationMs}
                              disabled={itemDraft.mediaType === 'video'}
                              onChange={(e) =>
                                setItemDraft({
                                  ...itemDraft,
                                  durationMs:
                                    Number(e.target.value) || 10_000,
                                })
                              }
                            />
                            {itemDraft.mediaType === 'video' && (
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
                              value={itemDraft.sortOrder}
                              onChange={(e) =>
                                setItemDraft({
                                  ...itemDraft,
                                  sortOrder: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>
                        <SettingSwitchInline
                          label="Activo"
                          checked={itemDraft.activo}
                          onCheckedChange={(v) =>
                            setItemDraft({ ...itemDraft, activo: v })
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={() => void persistItem(itemDraft)}
                          >
                            Guardar ítem
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setItemDraft(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center gap-4 rounded-md border p-3"
                        >
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
                            <p className="truncate text-sm font-medium">
                              {item.mediaUrl}
                            </p>
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
                                setItemDraft({
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
                        </div>
                      ))}
                      {items.length === 0 && !itemDraft && (
                        <p className="text-sm text-muted">
                          Aún no hay ítems en esta playlist.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </Card>
            )}
          </section>

          <section className="space-y-4 border-t pt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium">Monitores</h2>
                <p className="mt-1 text-sm text-muted">
                  Registra pantallas físicas y asigna una playlist. El estado
                  Online/Offline refleja la conexión WebSocket en vivo.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={syncingMonitors || monitors.length === 0}
                  onClick={() => void syncAllMonitors()}
                >
                  <RefreshCw
                    size={16}
                    className={syncingMonitors ? 'animate-spin' : undefined}
                  />
                  Sincronizar todos
                </Button>
                <Button
                  type="button"
                  onClick={() => setMonitorDraft(emptyMonitorDraft())}
                >
                  <Plus size={16} />
                  Nuevo monitor
                </Button>
              </div>
            </div>

            {monitorDraft && (
              <Card className="space-y-4 p-4">
                <h3 className="font-medium">
                  {monitorDraft.id ? 'Editar monitor' : 'Nuevo monitor'}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sc-key">ID de pantalla</Label>
                    <Input
                      id="sc-key"
                      value={monitorDraft.screenKey}
                      placeholder="pantalla_001"
                      onChange={(e) =>
                        setMonitorDraft({
                          ...monitorDraft,
                          screenKey: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sc-name">Nombre</Label>
                    <Input
                      id="sc-name"
                      value={monitorDraft.name}
                      onChange={(e) =>
                        setMonitorDraft({
                          ...monitorDraft,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sc-loc">Ubicación</Label>
                    <Input
                      id="sc-loc"
                      value={monitorDraft.location}
                      onChange={(e) =>
                        setMonitorDraft({
                          ...monitorDraft,
                          location: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Orientación</Label>
                    <Select
                      value={monitorDraft.orientation}
                      onValueChange={(v) =>
                        setMonitorDraft({
                          ...monitorDraft,
                          orientation: v as ScreenCastOrientation,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LANDSCAPE">
                          Horizontal (Landscape)
                        </SelectItem>
                        <SelectItem value="PORTRAIT">
                          Vertical (Portrait)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Playlist</Label>
                    <Select
                      value={monitorDraft.playlistId || '__none__'}
                      onValueChange={(v) =>
                        setMonitorDraft({
                          ...monitorDraft,
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
                  <Button type="button" onClick={() => void saveMonitorDraft()}>
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMonitorDraft(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </Card>
            )}

            {monitors.length === 0 ? (
              <EmptyState
                title="Sin monitores"
                description="Crea el primero para obtener su URL de reproducción."
              />
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
                      <TableHead className="w-44" />
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
                          {m.orientation === 'PORTRAIT'
                            ? 'Vertical'
                            : 'Horizontal'}
                        </TableCell>
                        <TableCell>{m.location || '—'}</TableCell>
                        <TableCell>
                          {m.playlistName ? (
                            <button
                              type="button"
                              className="text-sm underline-offset-2 hover:underline"
                              onClick={() =>
                                selectPlaylistFromMonitor(m.playlistId)
                              }
                            >
                              {m.playlistName}
                            </button>
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
                              title="Previsualizar"
                              onClick={() => selectMonitorForPreview(m.id)}
                            >
                              <Eye size={16} />
                            </Button>
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
                              onClick={() => {
                                setPreviewMonitorId(m.id);
                                setMonitorDraft({
                                  id: m.id,
                                  screenKey: m.screenKey,
                                  name: m.name,
                                  location: m.location ?? '',
                                  orientation: m.orientation ?? 'LANDSCAPE',
                                  playlistId: m.playlistId ?? '',
                                });
                              }}
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Eliminar"
                              onClick={() => void removeMonitor(m)}
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
          </section>
        </div>
      }
      preview={
        previewScreenKey && previewMonitor ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full max-w-sm space-y-2">
                <Label htmlFor="sc-preview-monitor">Monitor a previsualizar</Label>
                <Select
                  value={previewMonitor.id}
                  onValueChange={(id) => selectMonitorForPreview(id)}
                >
                  <SelectTrigger id="sc-preview-monitor">
                    <SelectValue placeholder="Elige un monitor" />
                  </SelectTrigger>
                  <SelectContent>
                    {monitors.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.screenKey})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted">
                {previewMonitor.playlistName
                  ? `Playlist: ${previewMonitor.playlistName}`
                  : 'Sin playlist asignada'}
              </p>
            </div>
            <WidgetPreviewFrame
              key={`${previewKey}-${previewMonitor.id}`}
              tabs={[
                {
                  id: 'player',
                  label: previewMonitor.name,
                  src: `/screen-cast?id=${encodeURIComponent(previewScreenKey)}`,
                  height: '540px',
                  previewMode: true,
                },
              ]}
            />
          </div>
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
