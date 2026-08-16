import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  AppUserDto,
  TodoEffort,
  TodoItemDto,
  TodoMetaDto,
  TodoPriority,
  TodoStatusDto,
} from '@mali-one/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
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
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { isFloatingLayerBlockingDismiss } from '@/lib/floating-layer';

const VIEW_STORAGE_KEY = 'mali.todos.view';

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_RANK: Record<TodoPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

const EFFORT_LABEL: Record<TodoEffort, string> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
};

type ViewMode = 'kanban' | 'calendar' | 'list';
type ChipFilter = 'all' | 'today' | 'overdue' | 'high';
type ListSortKey = 'title' | 'priority' | 'dueAt' | 'time';

type FormState = {
  title: string;
  detail: string;
  typeId: string;
  priority: TodoPriority;
  effort: string;
  statusId: string;
  dueAt: string;
  addMinutes: string;
  archived: boolean;
};

const emptyForm = (statusId = ''): FormState => ({
  title: '',
  detail: '',
  typeId: '',
  priority: 'medium',
  effort: '',
  statusId,
  dueAt: '',
  addMinutes: '',
  archived: false,
});

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toDateInput(iso: string | null) {
  if (!iso) return '';
  return formatDateInput(new Date(iso));
}

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isDueToday(iso: string | null) {
  if (!iso) return false;
  return dayKey(new Date(iso)) === dayKey(new Date());
}

function isOverdue(item: TodoItemDto) {
  if (!item.dueAt || item.status.isDone) return false;
  return new Date(item.dueAt) < startOfDay();
}

function readStoredView(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw === 'kanban' || raw === 'calendar' || raw === 'list') return raw;
  } catch {
    /* ignore */
  }
  return 'kanban';
}

export function TodosPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'admin';

  const [meta, setMeta] = useState<TodoMetaDto | null>(null);
  const [items, setItems] = useState<TodoItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewMode>(readStoredView);
  const [chip, setChip] = useState<ChipFilter>('all');
  const [hideDone, setHideDone] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [appUsers, setAppUsers] = useState<AppUserDto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TodoItemDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [listSort, setListSort] = useState<{
    key: ListSortKey;
    dir: 'asc' | 'desc';
  }>({ key: 'dueAt', dir: 'asc' });
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, list] = await Promise.all([
        api.getTodoMeta(),
        api.listTodos({
          ...(ownerFilter ? { ownerId: ownerFilter } : {}),
          includeDone: !hideDone,
          includeArchived: false,
        }),
      ]);
      setMeta(m);
      setItems(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar pendientes';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast, ownerFilter, hideDone]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    void api
      .listAppUsers()
      .then(setAppUsers)
      .catch(() => setAppUsers([]));
  }, [isAdmin]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const activeTypes = useMemo(
    () => (meta?.types ?? []).filter((t) => t.active),
    [meta],
  );
  const statuses = meta?.statuses ?? [];
  const doneStatus = useMemo(
    () => statuses.find((s) => s.isDone) ?? null,
    [statuses],
  );

  const counters = useMemo(() => {
    const open = items.filter((i) => !i.status.isDone);
    return {
      open: open.length,
      today: open.filter((i) => isDueToday(i.dueAt)).length,
      overdue: open.filter((i) => isOverdue(i)).length,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (chip === 'today') return isDueToday(item.dueAt) && !item.status.isDone;
      if (chip === 'overdue') return isOverdue(item);
      if (chip === 'high') {
        return (
          !item.status.isDone &&
          (item.priority === 'high' || item.priority === 'urgent')
        );
      }
      return true;
    });
  }, [items, chip]);

  const sortedListItems = useMemo(() => {
    const list = [...visibleItems];
    const dir = listSort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (listSort.key) {
        case 'title':
          return a.title.localeCompare(b.title, 'es') * dir;
        case 'priority':
          return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * dir;
        case 'time':
          return (a.timeSpentMinutes - b.timeSpentMinutes) * dir;
        case 'dueAt': {
          const av = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
          const bv = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
          return (av - bv) * dir;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [visibleItems, listSort]);

  function toggleListSort(key: ListSortKey) {
    setListSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  function openCreate(prefill?: { dueAt?: string; statusId?: string }) {
    setEditing(null);
    setForm({
      ...emptyForm(prefill?.statusId || statuses[0]?.id || ''),
      dueAt: prefill?.dueAt ?? '',
    });
    setDialogOpen(true);
  }

  function openEdit(item: TodoItemDto) {
    setEditing(item);
    setForm({
      title: item.title,
      detail: item.detail ?? '',
      typeId: item.typeId ?? '',
      priority: item.priority,
      effort: item.effort ?? '',
      statusId: item.statusId,
      dueAt: toDateInput(item.dueAt),
      addMinutes: '',
      archived: Boolean(item.archivedAt),
    });
    setDialogOpen(true);
  }

  function upsertItem(saved: TodoItemDto) {
    setItems((prev) => {
      if (saved.archivedAt) {
        return prev.filter((i) => i.id !== saved.id);
      }
      if (hideDone && saved.status.isDone) {
        return prev.filter((i) => i.id !== saved.id);
      }
      const exists = prev.some((i) => i.id === saved.id);
      if (exists) {
        return prev.map((i) => (i.id === saved.id ? saved : i));
      }
      return [...prev, saved].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          (a.dueAt ? new Date(a.dueAt).getTime() : 0) -
            (b.dueAt ? new Date(b.dueAt).getTime() : 0),
      );
    });
  }

  async function saveTodo() {
    if (!form.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        detail: form.detail.trim() || undefined,
        typeId: form.typeId || null,
        priority: form.priority,
        effort: (form.effort || null) as TodoEffort | null,
        statusId: form.statusId || undefined,
        dueAt: form.dueAt ? new Date(`${form.dueAt}T12:00:00`).toISOString() : null,
      };
      let saved: TodoItemDto;
      if (editing) {
        saved = await api.updateTodo(editing.id, {
          ...payload,
          archived: form.archived,
        });
        const minutes = Number(form.addMinutes);
        if (minutes > 0) {
          saved = await api.addTodoTime(editing.id, minutes);
        }
        upsertItem(saved);
        toast.success('Tarea actualizada');
      } else {
        saved = await api.createTodo(payload);
        upsertItem(saved);
        toast.success('Tarea creada');
      }
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function removeTodo(item: TodoItemDto) {
    const ok = await confirm({
      title: `¿Eliminar «${item.title}»?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteTodo(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success('Tarea eliminada');
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  async function moveToStatus(itemId: string, statusId: string) {
    const current = items.find((i) => i.id === itemId);
    if (!current || current.statusId === statusId) return;
    const status = statuses.find((s) => s.id === statusId);
    if (!status) return;

    const maxOrder = Math.max(
      -1,
      ...items.filter((i) => i.statusId === statusId).map((i) => i.sortOrder),
    );

    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              statusId,
              status,
              sortOrder: maxOrder + 1,
              statusChangedAt: new Date().toISOString(),
              completedAt: status.isDone
                ? i.completedAt ?? new Date().toISOString()
                : null,
            }
          : i,
      ),
    );
    try {
      const saved = await api.updateTodo(itemId, { statusId });
      upsertItem(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo mover');
      void load();
    }
  }

  async function reorderInColumn(statusId: string, orderedIds: string[]) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.statusId !== statusId) return item;
        const idx = orderedIds.indexOf(item.id);
        return idx >= 0 ? { ...item, sortOrder: idx } : item;
      }),
    );
    try {
      await api.reorderTodos({ statusId, orderedIds });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo reordenar');
      void load();
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    const activeItem = items.find((i) => i.id === itemId);
    if (!activeItem) return;

    const overStatus =
      statuses.find((s) => s.id === overId) ??
      items.find((i) => i.id === overId)?.status;
    if (!overStatus) return;

    if (activeItem.statusId === overStatus.id) {
      const columnItems = items
        .filter((i) => i.statusId === overStatus.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = columnItems.findIndex((i) => i.id === itemId);
      const newIndex = columnItems.findIndex((i) => i.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(columnItems, oldIndex, newIndex);
      void reorderInColumn(
        overStatus.id,
        reordered.map((i: TodoItemDto) => i.id),
      );
      return;
    }

    void moveToStatus(itemId, overStatus.id);
  }

  async function markDone(item: TodoItemDto) {
    if (!doneStatus || item.status.isDone) return;
    await moveToStatus(item.id, doneStatus.id);
  }

  async function addQuickTime(item: TodoItemDto, minutes: number) {
    try {
      const saved = await api.addTodoTime(item.id, minutes);
      upsertItem(saved);
      toast.success(`+${minutes} min`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo sumar tiempo');
    }
  }

  async function archiveItem(item: TodoItemDto) {
    try {
      const saved = await api.updateTodo(item.id, { archived: true });
      upsertItem(saved);
      toast.success('Tarea archivada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo archivar');
    }
  }

  async function quickCreate(statusId: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const saved = await api.createTodo({ title: trimmed, statusId });
      upsertItem(saved);
      toast.success('Tarea creada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    }
  }

  const calendarDays = useMemo(
    () => buildMonthGrid(monthCursor),
    [monthCursor],
  );
  const todayKey = dayKey(new Date());

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Pendientes"
        description={
          `${counters.open} abiertas · ${counters.today} hoy · ${counters.overdue} vencidas`
        }
        actions={
          <Button onClick={() => openCreate()} disabled={!meta}>
            <Plus className="size-4" />
            Nueva tarea
          </Button>
        }
      />

      {error ? <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner> : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['all', 'Todas'],
            ['today', 'Hoy'],
            ['overdue', 'Vencidas'],
            ['high', 'Alta+Urgente'],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={chip === id ? 'default' : 'outline'}
            onClick={() => setChip(id)}
          >
            {label}
          </Button>
        ))}
        <label className="ml-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={hideDone}
            onCheckedChange={(v) => setHideDone(v === true)}
          />
          Ocultar hechas
        </label>
        {isAdmin ? (
          <div className="ml-auto min-w-48">
            <Select
              value={ownerFilter || '__all__'}
              onValueChange={(v) =>
                setOwnerFilter(v === '__all__' ? '' : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Dueño" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="__all__">Todos los usuarios</SelectItem>
                {appUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
        <TabsList>
          <TabsTrigger value="kanban">
            <LayoutGrid className="size-3.5" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="size-3.5" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="list">
            <List className="size-3.5" />
            Lista
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <>
            <TabsContent value="kanban" className="mt-4">
              {statuses.length === 0 ? (
                <EmptyState
                  title="Sin estados"
                  description="No hay estados configurados todavía."
                />
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragEnd={onDragEnd}
                >
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {statuses.map((status) => (
                      <KanbanColumn
                        key={status.id}
                        status={status}
                        items={visibleItems
                          .filter((i) => i.statusId === status.id)
                          .sort((a, b) => a.sortOrder - b.sortOrder)}
                        doneStatus={doneStatus}
                        onOpen={openEdit}
                        onMarkDone={markDone}
                        onAddTime={addQuickTime}
                        onArchive={archiveItem}
                        onQuickCreate={
                          status.isDone
                            ? undefined
                            : (title) => void quickCreate(status.id, title)
                        }
                      />
                    ))}
                  </div>
                </DndContext>
              )}
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMonthCursor(
                      new Date(
                        monthCursor.getFullYear(),
                        monthCursor.getMonth() - 1,
                        1,
                      ),
                    )
                  }
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <h3 className="text-sm font-medium capitalize">
                  {monthCursor.toLocaleDateString('es-PE', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMonthCursor(
                      new Date(
                        monthCursor.getFullYear(),
                        monthCursor.getMonth() + 1,
                        1,
                      ),
                    )
                  }
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div
                    key={d}
                    className="bg-muted/50 px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const key = dayKey(day.date);
                  const dayItems = visibleItems.filter(
                    (i) => i.dueAt && dayKey(new Date(i.dueAt)) === key,
                  );
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        openCreate({ dueAt: formatDateInput(day.date) })
                      }
                      className={cn(
                        'min-h-24 bg-background p-1.5 text-left transition-colors hover:bg-muted/40',
                        !day.inMonth && 'opacity-40',
                        isToday && 'ring-1 ring-inset ring-primary/50',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-1 text-[11px] text-muted-foreground',
                          isToday && 'font-semibold text-foreground',
                        )}
                      >
                        {day.date.getDate()}
                      </div>
                      <div className="flex flex-col gap-1">
                        {dayItems.slice(0, 3).map((item) => (
                          <span
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(item);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                openEdit(item);
                              }
                            }}
                            className={cn(
                              'truncate rounded px-1 py-0.5 text-left text-[10px] text-white',
                              isOverdue(item) && 'ring-1 ring-red-400',
                            )}
                            style={{
                              background:
                                item.status.color || 'var(--color-primary)',
                            }}
                          >
                            {item.title}
                          </span>
                        ))}
                        {dayItems.length > 3 ? (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayItems.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              {sortedListItems.length === 0 ? (
                <EmptyState
                  title="Sin pendientes"
                  description="Crea tu primera tarea para empezar."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button
                            type="button"
                            className="font-medium"
                            onClick={() => toggleListSort('title')}
                          >
                            Título
                          </button>
                        </TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="font-medium"
                            onClick={() => toggleListSort('priority')}
                          >
                            Prioridad
                          </button>
                        </TableHead>
                        <TableHead>Esfuerzo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="font-medium"
                            onClick={() => toggleListSort('dueAt')}
                          >
                            Vence
                          </button>
                        </TableHead>
                        <TableHead>
                          <button
                            type="button"
                            className="font-medium"
                            onClick={() => toggleListSort('time')}
                          >
                            Tiempo
                          </button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedListItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className={cn(
                            'cursor-pointer',
                            isOverdue(item) && 'bg-red-50/60 dark:bg-red-950/20',
                          )}
                          onClick={() => openEdit(item)}
                        >
                          <TableCell
                            className={cn(
                              'font-medium',
                              isOverdue(item) && 'text-red-700 dark:text-red-300',
                            )}
                          >
                            {item.title}
                          </TableCell>
                          <TableCell>{item.type?.name ?? '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.priority === 'urgent' ||
                                item.priority === 'high'
                                  ? 'destructive'
                                  : 'outline'
                              }
                            >
                              {PRIORITY_LABEL[item.priority]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.effort ? EFFORT_LABEL[item.effort] : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              style={
                                item.status.color
                                  ? {
                                      backgroundColor: `${item.status.color}22`,
                                      color: item.status.color,
                                    }
                                  : undefined
                              }
                            >
                              {item.status.name}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={cn(
                              isOverdue(item) && 'font-medium text-red-600',
                            )}
                          >
                            {formatShortDate(item.dueAt)}
                          </TableCell>
                          <TableCell>{item.timeSpentMinutes} min</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && isFloatingLayerBlockingDismiss()) return;
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar tarea' : 'Nueva tarea'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="todo-title">Título</Label>
              <Input
                id="todo-title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="todo-detail">Detalle</Label>
              <Textarea
                id="todo-detail"
                rows={4}
                placeholder="Qué hay que hacer y el contexto de la tarea"
                value={form.detail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, detail: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.typeId || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      typeId: v === '__none__' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin tipo" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">Sin tipo</SelectItem>
                    {activeTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.statusId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, statusId: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Prioridad</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      priority: v as TodoPriority,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(Object.keys(PRIORITY_LABEL) as TodoPriority[]).map(
                      (p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Esfuerzo</Label>
                <Select
                  value={form.effort || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      effort: v === '__none__' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">—</SelectItem>
                    {(Object.keys(EFFORT_LABEL) as TodoEffort[]).map((e) => (
                      <SelectItem key={e} value={e}>
                        {EFFORT_LABEL[e]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="todo-due">Fecha límite</Label>
                <Input
                  id="todo-due"
                  type="date"
                  value={form.dueAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueAt: e.target.value }))
                  }
                />
              </div>
              {editing ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="todo-mins">Sumar minutos</Label>
                  <Input
                    id="todo-mins"
                    type="number"
                    min={1}
                    max={480}
                    value={form.addMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, addMinutes: e.target.value }))
                    }
                  />
                  <div className="flex flex-wrap gap-1">
                    {[15, 30, 60].map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            addMinutes: String(
                              Number(f.addMinutes || 0) + m,
                            ),
                          }))
                        }
                      >
                        +{m}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {editing ? (
              <>
                <label className="inline-flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.archived}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, archived: v === true }))
                    }
                  />
                  Archivar tarea
                </label>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Registro: {formatShortDate(editing.registeredAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {editing.timeSpentMinutes} min
                  </span>
                  <span>
                    Estado cambió: {formatShortDate(editing.statusChangedAt)}
                  </span>
                  {editing.completedAt ? (
                    <span>
                      Completada: {formatShortDate(editing.completedAt)}
                    </span>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void removeTodo(editing)}
              >
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void saveTodo()}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanColumn({
  status,
  items,
  doneStatus,
  onOpen,
  onMarkDone,
  onAddTime,
  onArchive,
  onQuickCreate,
}: {
  status: TodoStatusDto;
  items: TodoItemDto[];
  doneStatus: TodoStatusDto | null;
  onOpen: (item: TodoItemDto) => void;
  onMarkDone: (item: TodoItemDto) => void;
  onAddTime: (item: TodoItemDto, minutes: number) => void;
  onArchive: (item: TodoItemDto) => void;
  onQuickCreate?: (title: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const [draft, setDraft] = useState('');

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30',
        isOver && 'ring-2 ring-primary/40',
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span
          className="size-2.5 rounded-full"
          style={{ background: status.color || '#94a3b8' }}
        />
        <span className="text-sm font-medium">{status.name}</span>
        <Badge variant="secondary" className="ml-auto">
          {items.length}
        </Badge>
      </div>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 p-2">
          {items.map((item) => (
            <KanbanCard
              key={item.id}
              item={item}
              canMarkDone={Boolean(doneStatus) && !item.status.isDone}
              onOpen={onOpen}
              onMarkDone={onMarkDone}
              onAddTime={onAddTime}
              onArchive={onArchive}
            />
          ))}
        </div>
      </SortableContext>
      {onQuickCreate ? (
        <div className="border-t p-2">
          <Input
            value={draft}
            placeholder="Nueva tarea…"
            className="h-8 text-sm"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const title = draft;
                setDraft('');
                onQuickCreate(title);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function KanbanCard({
  item,
  canMarkDone,
  onOpen,
  onMarkDone,
  onAddTime,
  onArchive,
}: {
  item: TodoItemDto;
  canMarkDone: boolean;
  onOpen: (item: TodoItemDto) => void;
  onMarkDone: (item: TodoItemDto) => void;
  onAddTime: (item: TodoItemDto, minutes: number) => void;
  onArchive: (item: TodoItemDto) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const overdue = isOverdue(item);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border bg-background p-2.5 shadow-sm',
        isDragging && 'opacity-60',
        overdue && 'border-red-300',
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(item)}
      >
        <div
          className={cn(
            'text-sm font-medium leading-snug',
            overdue && 'text-red-700 dark:text-red-300',
          )}
        >
          {item.title}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            {PRIORITY_LABEL[item.priority]}
          </Badge>
          {item.type ? (
            <Badge variant="secondary" className="text-[10px]">
              {item.type.name}
            </Badge>
          ) : null}
          {item.dueAt ? (
            <span
              className={cn(
                'text-[10px] text-muted-foreground',
                overdue && 'font-medium text-red-600',
              )}
            >
              {formatShortDate(item.dueAt)}
            </span>
          ) : null}
        </div>
      </button>
      <div className="mt-2 flex flex-wrap gap-1">
        {canMarkDone ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              onMarkDone(item);
            }}
          >
            <Check className="size-3" />
            Hecho
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          onClick={(e) => {
            e.stopPropagation();
            onAddTime(item, 15);
          }}
        >
          <Clock className="size-3" />
          +15′
        </Button>
        {item.status.isDone ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              onArchive(item);
            }}
          >
            <Archive className="size-3" />
            Archivar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function buildMonthGrid(monthStart: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i,
    );
    days.push({ date, inMonth: date.getMonth() === month });
  }
  return days;
}
