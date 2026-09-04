import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Cast,
  Copy,
  CopyPlus,
  Eye,
  Film,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  ScreenCastMediaType,
  ScreenCastMonitorDto,
  ScreenCastOrientation,
  ScreenCastPlaylistDto,
  ScreenCastPlaylistItemDto,
  ScreenCastPlaylistMonitorRefDto,
  ScreenCastPlaylistPreviewDto,
} from '@mali-one/shared';
import { PageLoading, EmptyState, AlertBanner } from '@/components/feedback';
import { ScreenCastMediaUrlField } from '@/components/screen-cast-media-url-field';
import {
  ScheduleActiveBadge,
  ScreenCastSchedulePanel,
} from '@/components/screen-cast-schedule-panel';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingSwitchInline,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui';

type PlaylistSummary = ScreenCastPlaylistDto & {
  _count?: { monitors: number; items: number };
  monitors?: ScreenCastPlaylistMonitorRefDto[];
  previewItems?: ScreenCastPlaylistPreviewDto[];
};

type ItemDraft = {
  id?: string;
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
  durationMs: number;
  activo: boolean;
};

type MonitorDraft = {
  id?: string;
  screenKey: string;
  name: string;
  location: string;
  orientation: ScreenCastOrientation;
  playlistId: string;
  photoUrl: string;
};

type AdminTab = 'config' | 'preview';

const DURATION_PRESETS_SEC = [5, 10, 15, 30] as const;

function emptyItem(): ItemDraft {
  return {
    mediaUrl: '',
    mediaType: 'image',
    durationMs: 10_000,
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
    photoUrl: '',
  };
}

function playerUrl(screenKey: string): string {
  return `${window.location.origin}/screen-cast?id=${encodeURIComponent(screenKey)}`;
}

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'Nunca visto';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return date.toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'hace unos segundos';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return date.toLocaleString();
}

function OnlineStatusBadge({
  online,
  lastSeenAt,
}: {
  online: boolean;
  lastSeenAt: string | null | undefined;
}) {
  const absolute =
    lastSeenAt && !Number.isNaN(new Date(lastSeenAt).getTime())
      ? new Date(lastSeenAt).toLocaleString()
      : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={online ? 'default' : 'secondary'}
          className="cursor-default"
        >
          {online ? 'Online' : 'Offline'}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-center">
        <p>Última vez: {formatLastSeen(lastSeenAt)}</p>
        {absolute ? (
          <p className="mt-0.5 text-[11px] opacity-80">{absolute}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function monitorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function MediaThumb({
  mediaUrl,
  mediaType,
  className,
}: {
  mediaUrl: string;
  mediaType: ScreenCastMediaType;
  className?: string;
}) {
  if (mediaType === 'video') {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground',
          className,
        )}
      >
        <Film size={20} />
        <span className="text-[10px] font-semibold tracking-wide">MP4</span>
      </div>
    );
  }
  return (
    <img src={mediaUrl} alt="" className={cn('object-cover', className)} />
  );
}

function MonitorAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={cn(
          'size-7 rounded-full border border-background object-cover',
          className,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex size-7 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground',
        className,
      )}
    >
      {monitorInitials(name)}
    </span>
  );
}

function MonitorAvatarStack({
  monitors,
}: {
  monitors: ScreenCastPlaylistMonitorRefDto[];
}) {
  if (monitors.length === 0) {
    return <span className="text-muted">—</span>;
  }

  const visible = monitors.slice(0, 3);
  const overflow = monitors.length - visible.length;
  const names = monitors.map((m) => m.name).join(', ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-default items-center">
          {visible.map((m, index) => (
            <span
              key={m.id}
              title={m.name}
              className={cn(index > 0 && '-ml-1.5')}
            >
              <MonitorAvatar name={m.name} photoUrl={m.photoUrl} />
            </span>
          ))}
          {overflow > 0 ? (
            <span className="-ml-1.5 flex size-7 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold text-muted-foreground">
              +{overflow}
            </span>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {names}
      </TooltipContent>
    </Tooltip>
  );
}

function PlaylistPreviewStack({
  items,
}: {
  items: ScreenCastPlaylistPreviewDto[];
}) {
  if (items.length === 0) {
    return <span className="text-muted">—</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {items.slice(0, 4).map((item, index) => (
        <span
          key={`${item.mediaUrl}-${index}`}
          className="size-8 shrink-0 overflow-hidden rounded bg-muted"
        >
          <MediaThumb
            mediaUrl={item.mediaUrl}
            mediaType={item.mediaType}
            className="h-full w-full"
          />
        </span>
      ))}
    </div>
  );
}

function LivePlaylistBadge({
  monitors,
}: {
  monitors: ScreenCastPlaylistMonitorRefDto[];
}) {
  const live = monitors.filter((m) => m.online);
  if (live.length === 0) return null;
  const names = live.map((m) => m.name).join(', ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="default" className="cursor-default gap-1">
          <Cast size={12} />
          Live
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        En pantalla: {names}
      </TooltipContent>
    </Tooltip>
  );
}

function SortablePlaylistItemCard({
  item,
  disabled,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  item: ScreenCastPlaylistItemDto;
  disabled?: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group relative aspect-video overflow-hidden rounded-md border bg-muted',
        isDragging && 'z-10 opacity-80 shadow-lg ring-2 ring-primary/40',
        !item.activo && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <MediaThumb
          mediaUrl={item.mediaUrl}
          mediaType={item.mediaType}
          className="pointer-events-none h-full w-full"
        />
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {item.mediaType === 'video'
          ? 'video'
          : `${item.mediaType} · ${Math.round(item.durationMs / 1000)}s`}
        {!item.activo ? ' · inactivo' : ''}
      </div>
      <div className="absolute inset-x-0 top-0 z-10 flex justify-end gap-1 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-7 shadow-sm"
          title="Editar"
          onClick={onEdit}
        >
          <Pencil size={14} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-7 shadow-sm"
          title="Duplicar"
          onClick={onDuplicate}
        >
          <CopyPlus size={14} />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-7 shadow-sm"
          title="Eliminar"
          onClick={onRemove}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

export function ScreenCastAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [monitors, setMonitors] = useState<ScreenCastMonitorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<AdminTab>('config');

  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(
    null,
  );
  const [playlistName, setPlaylistName] = useState('');
  const [items, setItems] = useState<ScreenCastPlaylistItemDto[]>([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [reordering, setReordering] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  /** Avoid closing playlist dialog when nested item dialog dismisses (Radix). */
  const itemDialogOpenRef = useRef(false);
  const suppressPlaylistCloseRef = useRef(false);

  const [monitorDialogOpen, setMonitorDialogOpen] = useState(false);
  const [monitorDraft, setMonitorDraft] = useState<MonitorDraft | null>(null);
  const [savingMonitor, setSavingMonitor] = useState(false);
  const [uploadingMonitorPhoto, setUploadingMonitorPhoto] = useState(false);
  const monitorPhotoInputRef = useRef<HTMLInputElement>(null);

  const itemSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [previewKey, setPreviewKey] = useState(0);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingMonitorId, setSyncingMonitorId] = useState<string | null>(null);
  const [previewMonitorId, setPreviewMonitorId] = useState<string | null>(null);

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
        setItems(data.items ?? []);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Error al cargar playlist',
        );
        setPlaylistDialogOpen(false);
        setEditingPlaylistId(null);
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
    if (playlistDialogOpen && editingPlaylistId) {
      void loadPlaylistDetail(editingPlaylistId);
    }
  }, [playlistDialogOpen, editingPlaylistId, loadPlaylistDetail]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void Promise.all([
        api.listScreenCastPlaylists(),
        api.listScreenCastMonitors(),
      ])
        .then(([p, m]) => {
          setPlaylists(p);
          setMonitors(m);
        })
        .catch(() => undefined);
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

  const playlistMonitorOrients = useMemo(() => {
    if (!editingPlaylistId) {
      return { hasPortraitMonitors: false, hasLandscapeMonitors: false };
    }
    const assigned = monitors.filter((m) => m.playlistId === editingPlaylistId);
    return {
      hasPortraitMonitors: assigned.some((m) => m.orientation === 'PORTRAIT'),
      hasLandscapeMonitors: assigned.some((m) => m.orientation === 'LANDSCAPE'),
    };
  }, [editingPlaylistId, monitors]);

  function openPlaylistEditor(id: string) {
    setEditingPlaylistId(id);
    setLoadingPlaylist(true);
    itemDialogOpenRef.current = false;
    suppressPlaylistCloseRef.current = false;
    setItemDraft(null);
    setItemDialogOpen(false);
    setPlaylistDialogOpen(true);
  }

  function openCreatePlaylist() {
    setEditingPlaylistId(null);
    setPlaylistName('');
    setItems([]);
    setLoadingPlaylist(false);
    itemDialogOpenRef.current = false;
    suppressPlaylistCloseRef.current = false;
    setItemDraft(null);
    setItemDialogOpen(false);
    setPlaylistDialogOpen(true);
  }

  function closePlaylistEditor() {
    setPlaylistDialogOpen(false);
    setEditingPlaylistId(null);
    itemDialogOpenRef.current = false;
    suppressPlaylistCloseRef.current = false;
    setItemDialogOpen(false);
    setItemDraft(null);
    setItems([]);
  }

  async function ensurePlaylistSaved(): Promise<string | null> {
    const trimmed = playlistName.trim();
    if (!trimmed) {
      toast.error('Pon un nombre a la playlist antes de continuar');
      return null;
    }
    if (editingPlaylistId) return editingPlaylistId;

    setSavingMeta(true);
    try {
      const created = await api.createScreenCastPlaylist({
        name: trimmed,
        activo: true,
      });
      setEditingPlaylistId(created.id);
      await loadLists();
      await loadPlaylistDetail(created.id);
      return created.id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear');
      return null;
    } finally {
      setSavingMeta(false);
    }
  }

  async function savePlaylistMeta() {
    const trimmed = playlistName.trim();
    if (!trimmed) {
      toast.error('El nombre es obligatorio');
      return;
    }

    setSavingMeta(true);
    try {
      if (!editingPlaylistId) {
        await api.createScreenCastPlaylist({
          name: trimmed,
          activo: true,
        });
        toast.success('Playlist creada');
      } else {
        await api.updateScreenCastPlaylist(editingPlaylistId, {
          name: trimmed,
        });
        toast.success('Playlist guardada');
      }
      await loadLists();
      closePlaylistEditor();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingMeta(false);
    }
  }

  async function duplicatePlaylist(playlist: PlaylistSummary) {
    try {
      const created = await api.duplicateScreenCastPlaylist(playlist.id);
      toast.success('Playlist duplicada');
      await loadLists();
      openPlaylistEditor(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al duplicar');
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
      if (editingPlaylistId === playlist.id) closePlaylistEditor();
      await loadLists();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  async function togglePlaylistActivo(
    playlist: PlaylistSummary,
    next: boolean,
  ) {
    if (!next) {
      const assigned =
        playlist.monitors?.length ?? playlist._count?.monitors ?? 0;
      if (assigned > 0) {
        const ok = await confirm({
          title: `¿Desactivar «${playlist.name}»?`,
          description: `Se desasignará de ${assigned} monitor${assigned === 1 ? '' : 'es'}.`,
          confirmLabel: 'Desactivar',
          variant: 'destructive',
        });
        if (!ok) return;
      }
    }

    const previous = playlist.activo;
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlist.id
          ? {
              ...p,
              activo: next,
              monitors: next ? p.monitors : [],
              _count: p._count
                ? {
                    ...p._count,
                    monitors: next ? p._count.monitors : 0,
                  }
                : p._count,
            }
          : p,
      ),
    );

    try {
      await api.updateScreenCastPlaylist(playlist.id, { activo: next });
      await loadLists();
    } catch (e) {
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === playlist.id ? { ...p, activo: previous } : p,
        ),
      );
      toast.error(
        e instanceof Error ? e.message : 'Error al cambiar el estado',
      );
    }
  }

  async function openItemCreate() {
    const playlistId = await ensurePlaylistSaved();
    if (!playlistId) return;
    itemDialogOpenRef.current = true;
    setItemDraft(emptyItem());
    setItemDialogOpen(true);
  }

  function openItemEdit(item: ScreenCastPlaylistItemDto) {
    itemDialogOpenRef.current = true;
    setItemDraft({
      id: item.id,
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType,
      durationMs: item.durationMs,
      activo: item.activo,
    });
    setItemDialogOpen(true);
  }

  function closeItemDialog() {
    // Nested Dialog close can bubble and close the playlist dialog; suppress briefly.
    suppressPlaylistCloseRef.current = true;
    itemDialogOpenRef.current = false;
    setItemDialogOpen(false);
    setItemDraft(null);
    window.setTimeout(() => {
      suppressPlaylistCloseRef.current = false;
    }, 100);
  }

  async function persistItem() {
    if (!editingPlaylistId || !itemDraft) return;
    const mediaUrl = itemDraft.mediaUrl.trim();
    if (!mediaUrl) {
      toast.error('La URL del medio es obligatoria');
      return;
    }
    const payload = {
      mediaUrl,
      mediaType: itemDraft.mediaType,
      durationMs: itemDraft.durationMs,
      activo: itemDraft.activo,
    };
    setSavingItem(true);
    try {
      if (itemDraft.id) {
        await api.updateScreenCastPlaylistItem(itemDraft.id, payload);
        toast.success('Ítem guardado');
      } else {
        await api.createScreenCastPlaylistItem(editingPlaylistId, payload);
        toast.success('Ítem creado');
      }
      closeItemDialog();
      await loadLists();
      await loadPlaylistDetail(editingPlaylistId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar ítem');
    } finally {
      setSavingItem(false);
    }
  }

  async function duplicateItem(item: ScreenCastPlaylistItemDto) {
    if (!editingPlaylistId) return;
    try {
      await api.duplicateScreenCastPlaylistItem(item.id);
      toast.success('Ítem duplicado');
      await loadLists();
      await loadPlaylistDetail(editingPlaylistId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al duplicar ítem');
    }
  }

  async function removeItem(item: ScreenCastPlaylistItemDto) {
    if (!editingPlaylistId) return;
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
      await loadPlaylistDetail(editingPlaylistId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  async function handleItemDragEnd(event: DragEndEvent) {
    if (!editingPlaylistId || reordering) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const ordered = arrayMove(items, oldIndex, newIndex);
    setItems(ordered);
    setReordering(true);
    try {
      const updated = await api.reorderScreenCastPlaylistItems(
        editingPlaylistId,
        ordered.map((i) => i.id),
      );
      setItems(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al reordenar');
      await loadPlaylistDetail(editingPlaylistId);
    } finally {
      setReordering(false);
    }
  }

  function openMonitorCreate() {
    setMonitorDraft(emptyMonitorDraft());
    setMonitorDialogOpen(true);
  }

  function openMonitorEdit(m: ScreenCastMonitorDto) {
    setMonitorDraft({
      id: m.id,
      screenKey: m.screenKey,
      name: m.name,
      location: m.location ?? '',
      orientation: m.orientation ?? 'LANDSCAPE',
      playlistId: m.playlistId ?? '',
      photoUrl: m.photoUrl ?? '',
    });
    setMonitorDialogOpen(true);
  }

  function closeMonitorDialog() {
    setMonitorDialogOpen(false);
    setMonitorDraft(null);
    setUploadingMonitorPhoto(false);
  }

  async function uploadMonitorPhoto(file: File) {
    if (!monitorDraft) return;
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      toast.error('Usa una foto JPG o PNG');
      return;
    }
    setUploadingMonitorPhoto(true);
    try {
      const uploaded = await api.uploadScreenCastMedia(file);
      setMonitorDraft({ ...monitorDraft, photoUrl: uploaded.url });
      toast.success('Foto subida');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir la foto');
    } finally {
      setUploadingMonitorPhoto(false);
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
      photoUrl: monitorDraft.photoUrl.trim() || null,
    };
    setSavingMonitor(true);
    try {
      if (monitorDraft.id) {
        await api.updateScreenCastMonitor(monitorDraft.id, payload);
        toast.success('Monitor actualizado');
      } else {
        await api.createScreenCastMonitor(payload);
        toast.success('Monitor creado');
      }
      closeMonitorDialog();
      setPreviewKey((k) => k + 1);
      await loadLists();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingMonitor(false);
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
    setSyncingAll(true);
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
      setSyncingAll(false);
    }
  }

  async function syncOneMonitor(monitor: ScreenCastMonitorDto) {
    setSyncingMonitorId(monitor.id);
    try {
      const result = await api.syncScreenCastMonitor(monitor.id);
      toast.success(
        result.notified > 0
          ? `Pantalla «${monitor.name}» sincronizada`
          : `«${monitor.name}» no está conectada`,
      );
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al sincronizar');
    } finally {
      setSyncingMonitorId(null);
    }
  }

  function copyUrl(screenKey: string) {
    void navigator.clipboard.writeText(playerUrl(screenKey)).then(
      () => toast.success('URL copiada'),
      () => toast.error('No se pudo copiar'),
    );
  }

  function selectMonitorForPreview(monitorId: string) {
    setPreviewMonitorId(monitorId);
    setPreviewKey((k) => k + 1);
    setActiveTab('preview');
  }

  function goToPlaylistFromMonitor(playlistId: string | null | undefined) {
    if (!playlistId) return;
    setActiveTab('config');
    openPlaylistEditor(playlistId);
  }

  if (loading) return <PageLoading />;

  const previewMonitor =
    monitors.find((m) => m.id === previewMonitorId) ?? monitors[0] ?? null;
  const previewScreenKey = previewMonitor?.screenKey;
  const itemDurationSec = itemDraft
    ? Math.max(1, Math.round(itemDraft.durationMs / 1000))
    : 10;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Transmisión a pantallas
        </h2>
        <p className="mt-1 text-sm text-muted">
          Configura listas de reproducción y monitores quiosco desde un solo
          panel.
        </p>
      </div>

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AdminTab)}
      >
        <TabsList>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="preview">Vista previa</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium">Listas de reproducción</h3>
                <p className="mt-1 text-sm text-muted">
                  Playlists reutilizables con imágenes, GIFs y videos.
                </p>
              </div>
              <Button type="button" onClick={openCreatePlaylist}>
                <Plus size={16} />
                Nueva playlist
              </Button>
            </div>

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
                    <TableHead>Vista previa</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ítems</TableHead>
                    <TableHead>Monitores</TableHead>
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playlists.map((p) => {
                    const assigned = p.monitors ?? [];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={() => openPlaylistEditor(p.id)}
                            >
                              {p.name}
                            </button>
                            {p.activo ? (
                              <LivePlaylistBadge monitors={assigned} />
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <PlaylistPreviewStack items={p.previewItems ?? []} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={p.activo}
                              onCheckedChange={(checked) =>
                                void togglePlaylistActivo(p, checked)
                              }
                              aria-label={
                                p.activo
                                  ? `Desactivar ${p.name}`
                                  : `Activar ${p.name}`
                              }
                            />
                            <span className="text-sm text-muted">
                              {p.activo ? 'Activa' : 'Inactiva'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{p._count?.items ?? 0}</TableCell>
                        <TableCell>
                          <MonitorAvatarStack monitors={assigned} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Editar"
                              onClick={() => openPlaylistEditor(p.id)}
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Duplicar"
                              onClick={() => void duplicatePlaylist(p)}
                            >
                              <CopyPlus size={16} />
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          </section>

          <section className="space-y-4 border-t pt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium">Monitores</h3>
              <p className="mt-1 text-sm text-muted">
                Registra pantallas físicas y asigna una playlist. Online/Offline
                refleja la conexión WebSocket en vivo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={syncingAll || monitors.length === 0}
                onClick={() => void syncAllMonitors()}
              >
                <RefreshCw
                  size={16}
                  className={syncingAll ? 'animate-spin' : undefined}
                />
                Sincronizar todos
              </Button>
              <Button type="button" onClick={openMonitorCreate}>
                <Plus size={16} />
                Nuevo monitor
              </Button>
            </div>
          </div>

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
                    <TableHead>Reproducción</TableHead>
                    <TableHead>Playlist</TableHead>
                    <TableHead className="w-52" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitors.map((m) => {
                    const slideLabel =
                      m.online &&
                      m.playbackTotal != null &&
                      m.playbackTotal > 0 &&
                      m.playbackIndex != null
                        ? `${m.playbackIndex + 1}/${m.playbackTotal}`
                        : '—';
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <OnlineStatusBadge
                              online={m.online}
                              lastSeenAt={m.lastSeenAt}
                            />
                            <ScheduleActiveBadge
                              scheduleActive={m.scheduleActive}
                            />
                            {m.lastError ? (
                              <p
                                className="max-w-40 truncate text-xs text-destructive"
                                title={m.lastError}
                              >
                                {m.lastError}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <MonitorAvatar
                              name={m.name}
                              photoUrl={m.photoUrl}
                            />
                            <span>{m.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {m.screenKey}
                        </TableCell>
                        <TableCell>
                          {m.orientation === 'PORTRAIT'
                            ? 'Vertical'
                            : 'Horizontal'}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {slideLabel}
                        </TableCell>
                        <TableCell>
                          {m.playlistName ? (
                            <button
                              type="button"
                              className="flex max-w-56 items-center gap-2 text-left text-sm underline-offset-2 hover:underline"
                              onClick={() =>
                                goToPlaylistFromMonitor(m.playlistId)
                              }
                            >
                              {m.playlistPreview ? (
                                <span className="size-8 shrink-0 overflow-hidden rounded bg-muted">
                                  <MediaThumb
                                    mediaUrl={m.playlistPreview.mediaUrl}
                                    mediaType={m.playlistPreview.mediaType}
                                    className="h-full w-full"
                                  />
                                </span>
                              ) : (
                                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                  <Film size={14} />
                                </span>
                              )}
                              <span className="truncate">{m.playlistName}</span>
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
                              title="Sincronizar"
                              disabled={syncingMonitorId === m.id}
                              onClick={() => void syncOneMonitor(m)}
                            >
                              <RefreshCw
                                size={16}
                                className={
                                  syncingMonitorId === m.id
                                    ? 'animate-spin'
                                    : undefined
                                }
                              />
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
                              onClick={() => openMonitorEdit(m)}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          </section>

          <ScreenCastSchedulePanel
            monitors={monitors}
            playlists={playlists}
            onChanged={() => void loadLists()}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          {previewScreenKey && previewMonitor ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full max-w-sm space-y-2">
                  <Label htmlFor="sc-preview-monitor">
                    Monitor a previsualizar
                  </Label>
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
                <div className="space-y-1 text-sm text-muted">
                  <p>
                    {previewMonitor.playlistName
                      ? `Playlist: ${previewMonitor.playlistName}`
                      : 'Sin playlist asignada'}
                  </p>
                  <p className="flex flex-wrap items-center gap-2">
                    <OnlineStatusBadge
                      online={previewMonitor.online}
                      lastSeenAt={previewMonitor.lastSeenAt}
                    />
                    {previewMonitor.online &&
                    previewMonitor.playbackTotal != null &&
                    previewMonitor.playbackTotal > 0 &&
                    previewMonitor.playbackIndex != null ? (
                      <span className="tabular-nums">
                        Slide{' '}
                        {previewMonitor.playbackIndex + 1}/
                        {previewMonitor.playbackTotal}
                      </span>
                    ) : null}
                  </p>
                  {previewMonitor.lastError ? (
                    <p className="text-destructive">{previewMonitor.lastError}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-center">
                <div
                  key={`${previewKey}-${previewMonitor.id}`}
                  className={cn(
                    'overflow-hidden rounded-lg border border-border bg-black shadow-sm',
                    previewMonitor.orientation === 'PORTRAIT'
                      ? 'aspect-9/16 w-[min(100%,360px)]'
                      : 'aspect-video w-full max-w-4xl',
                  )}
                >
                  <iframe
                    title={`Vista previa ${previewMonitor.name}`}
                    src={`/screen-cast?id=${encodeURIComponent(previewScreenKey)}&preview=1`}
                    className="h-full w-full border-0 bg-black"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Sin vista previa"
              description="Crea un monitor para previsualizar el reproductor."
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={playlistDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (itemDialogOpenRef.current || suppressPlaylistCloseRef.current) {
              return;
            }
            closePlaylistEditor();
            return;
          }
          setPlaylistDialogOpen(true);
        }}
      >
        <DialogContent
          className="flex max-h-[min(90vh,900px)] w-[min(calc(100vw-2rem),56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          onPointerDownOutside={(e) => {
            if (itemDialogOpenRef.current) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (itemDialogOpenRef.current) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (itemDialogOpenRef.current) e.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>
              {editingPlaylistId ? 'Editar playlist' : 'Nueva playlist'}
            </DialogTitle>
            <DialogDescription>
              JPG, PNG, GIF, MP4 o MOV (iPhone → MP4). Pega una URL o elige desde
              S3. Arrastra las celdas para reordenar.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {loadingPlaylist ? (
              <p className="text-sm text-muted">Cargando playlist…</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pl-detail-name">Nombre</Label>
                  <Input
                    id="pl-detail-name"
                    autoFocus={!editingPlaylistId}
                    value={playlistName}
                    placeholder="Ej. Lobby principal"
                    onChange={(e) => setPlaylistName(e.target.value)}
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="mb-3 font-medium">Ítems ({items.length})</h4>
                  <DndContext
                    sensors={itemSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => void handleItemDragEnd(event)}
                  >
                    <SortableContext
                      items={items.map((item) => item.id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {items.map((item) => (
                          <SortablePlaylistItemCard
                            key={item.id}
                            item={item}
                            disabled={reordering}
                            onEdit={() => openItemEdit(item)}
                            onDuplicate={() => void duplicateItem(item)}
                            onRemove={() => void removeItem(item)}
                          />
                        ))}
                        <button
                          type="button"
                          className="flex aspect-video items-center justify-center rounded-md border border-dashed text-muted transition-colors hover:border-foreground/40 hover:text-foreground"
                          onClick={() => void openItemCreate()}
                        >
                          <Plus size={28} />
                          <span className="sr-only">Añadir ítem</span>
                        </button>
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={closePlaylistEditor}>
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={savingMeta || loadingPlaylist}
              onClick={() => void savePlaylistMeta()}
            >
              {savingMeta
                ? 'Guardando…'
                : editingPlaylistId
                  ? 'Guardar playlist'
                  : 'Crear playlist'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeItemDialog();
          else setItemDialogOpen(true);
        }}
      >
        <DialogContent className="max-h-[min(90vh,900px)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {itemDraft?.id ? 'Editar ítem' : 'Nuevo ítem'}
            </DialogTitle>
            <DialogDescription>
              Duración en segundos para imagen/GIF. El video avanza al terminar.
            </DialogDescription>
          </DialogHeader>

          {itemDraft ? (
            <div className="space-y-4">
              {itemDraft.mediaUrl.trim() ? (
                <div className="overflow-hidden rounded-md border bg-muted">
                  {itemDraft.mediaType === 'video' ? (
                    <div className="flex aspect-video flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Film size={40} />
                      <span className="text-sm font-semibold tracking-wide">
                        MP4
                      </span>
                    </div>
                  ) : (
                    <img
                      src={itemDraft.mediaUrl}
                      alt=""
                      className="mx-auto max-h-56 w-full object-contain"
                    />
                  )}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>URL del medio</Label>
                <ScreenCastMediaUrlField
                  value={itemDraft.mediaUrl}
                  hasPortraitMonitors={
                    playlistMonitorOrients.hasPortraitMonitors
                  }
                  hasLandscapeMonitors={
                    playlistMonitorOrients.hasLandscapeMonitors
                  }
                  onChange={(url, type, meta) =>
                    setItemDraft({
                      ...itemDraft,
                      mediaUrl: url,
                      ...(type ? { mediaType: type } : {}),
                      ...(type === 'video' &&
                      meta?.durationMs &&
                      meta.durationMs > 0
                        ? { durationMs: meta.durationMs }
                        : {}),
                    })
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                      <SelectItem value="image">Imagen (JPG/PNG)</SelectItem>
                      <SelectItem value="gif">GIF</SelectItem>
                      <SelectItem value="video">Video (MP4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dur-sec">Duración (segundos)</Label>
                  <Input
                    id="dur-sec"
                    type="number"
                    min={1}
                    step={1}
                    value={itemDurationSec}
                    disabled={itemDraft.mediaType === 'video'}
                    onChange={(e) => {
                      const sec = Math.max(1, Number(e.target.value) || 1);
                      setItemDraft({
                        ...itemDraft,
                        durationMs: sec * 1000,
                      });
                    }}
                  />
                  <div className="flex flex-wrap gap-1">
                    {DURATION_PRESETS_SEC.map((sec) => (
                      <Button
                        key={sec}
                        type="button"
                        size="sm"
                        variant={
                          itemDraft.mediaType !== 'video' &&
                          itemDurationSec === sec
                            ? 'default'
                            : 'outline'
                        }
                        disabled={itemDraft.mediaType === 'video'}
                        onClick={() =>
                          setItemDraft({
                            ...itemDraft,
                            durationMs: sec * 1000,
                          })
                        }
                      >
                        {sec}s
                      </Button>
                    ))}
                  </div>
                  {itemDraft.mediaType === 'video' ? (
                    <p className="text-xs text-muted">
                      El video avanza al terminar (onEnded).
                    </p>
                  ) : null}
                </div>
              </div>

              <SettingSwitchInline
                label="Activo"
                checked={itemDraft.activo}
                onCheckedChange={(v) =>
                  setItemDraft({ ...itemDraft, activo: v })
                }
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeItemDialog}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingItem || !itemDraft}
              onClick={() => void persistItem()}
            >
              Guardar ítem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={monitorDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeMonitorDialog();
          else setMonitorDialogOpen(true);
        }}
      >
        <DialogContent
          className="max-w-lg"
          onPointerDownOutside={(e) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest('[data-slot="select-content"]')) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest('[data-slot="select-content"]')) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {monitorDraft?.id ? 'Editar monitor' : 'Nuevo monitor'}
            </DialogTitle>
            <DialogDescription>
              El ID de pantalla forma parte de la URL del reproductor.
            </DialogDescription>
          </DialogHeader>

          {monitorDraft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto (opcional)</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <MonitorAvatar
                    name={monitorDraft.name || monitorDraft.screenKey || 'M'}
                    photoUrl={monitorDraft.photoUrl || null}
                    className="size-14 text-sm"
                  />
                  <input
                    ref={monitorPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadMonitorPhoto(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingMonitorPhoto}
                    onClick={() => monitorPhotoInputRef.current?.click()}
                  >
                    {uploadingMonitorPhoto ? 'Subiendo…' : 'Subir foto'}
                  </Button>
                  {monitorDraft.photoUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setMonitorDraft({ ...monitorDraft, photoUrl: '' })
                      }
                    >
                      Quitar
                    </Button>
                  ) : null}
                </div>
              </div>
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
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="LANDSCAPE">
                      Horizontal (Landscape)
                    </SelectItem>
                    <SelectItem value="PORTRAIT">
                      Vertical (Portrait)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
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
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin playlist" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">Sin playlist</SelectItem>
                    {playlists
                      .filter(
                        (p) =>
                          p.activo ||
                          p.id === (monitorDraft.playlistId || ''),
                      )
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.activo ? p.name : `${p.name} (inactiva)`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeMonitorDialog}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingMonitor || !monitorDraft}
              onClick={() => void saveMonitorDraft()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
