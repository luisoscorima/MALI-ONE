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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  TodoEffort,
  TodoItemDto,
  TodoMetaDto,
  TodoPriority,
  TodoStatusDto,
} from '@mali-one/shared';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Badge,
  Button,
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

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const EFFORT_LABEL: Record<TodoEffort, string> = {
  xs: 'XS',
  s: 'S',
  m: 'M',
  l: 'L',
  xl: 'XL',
};

type ViewMode = 'kanban' | 'calendar' | 'list';

type FormState = {
  title: string;
  detail: string;
  notes: string;
  typeId: string;
  priority: TodoPriority;
  effort: string;
  statusId: string;
  dueAt: string;
  addMinutes: string;
};

const emptyForm = (statusId = ''): FormState => ({
  title: '',
  detail: '',
  notes: '',
  typeId: '',
  priority: 'medium',
  effort: '',
  statusId,
  dueAt: '',
  addMinutes: '',
});

function formatShortDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toDateInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TodosPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [meta, setMeta] = useState<TodoMetaDto | null>(null);
  const [items, setItems] = useState<TodoItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewMode>('kanban');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TodoItemDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
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
        api.listTodos(),
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
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeTypes = useMemo(
    () => (meta?.types ?? []).filter((t) => t.active),
    [meta],
  );
  const statuses = meta?.statuses ?? [];

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(statuses[0]?.id ?? ''));
    setDialogOpen(true);
  }

  function openEdit(item: TodoItemDto) {
    setEditing(item);
    setForm({
      title: item.title,
      detail: item.detail ?? '',
      notes: item.notes ?? '',
      typeId: item.typeId ?? '',
      priority: item.priority,
      effort: item.effort ?? '',
      statusId: item.statusId,
      dueAt: toDateInput(item.dueAt),
      addMinutes: '',
    });
    setDialogOpen(true);
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
        notes: form.notes.trim() || undefined,
        typeId: form.typeId || null,
        priority: form.priority,
        effort: (form.effort || null) as TodoEffort | null,
        statusId: form.statusId || undefined,
        dueAt: form.dueAt ? new Date(`${form.dueAt}T12:00:00`).toISOString() : null,
      };
      let saved: TodoItemDto;
      if (editing) {
        saved = await api.updateTodo(editing.id, payload);
        const minutes = Number(form.addMinutes);
        if (minutes > 0) {
          saved = await api.addTodoTime(editing.id, minutes);
        }
        setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
        toast.success('Tarea actualizada');
      } else {
        saved = await api.createTodo(payload);
        setItems((prev) => [saved, ...prev]);
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
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              statusId,
              status: statuses.find((s) => s.id === statusId) ?? i.status,
              statusChangedAt: new Date().toISOString(),
            }
          : i,
      ),
    );
    try {
      const saved = await api.updateTodo(itemId, { statusId });
      setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo mover');
      void load();
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    const status =
      statuses.find((s) => s.id === overId) ??
      items.find((i) => i.id === overId)?.status;
    if (!status) return;
    void moveToStatus(itemId, status.id);
  }

  const calendarDays = useMemo(
    () => buildMonthGrid(monthCursor),
    [monthCursor],
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Pendientes"
        description="Tareas personales con Kanban, calendario y lista."
        actions={
          <Button onClick={openCreate} disabled={!meta}>
            <Plus className="size-4" />
            Nueva tarea
          </Button>
        }
      />

      {error ? <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner> : null}

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
                        items={items.filter((i) => i.statusId === status.id)}
                        onOpen={openEdit}
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
                  const dayItems = items.filter(
                    (i) => i.dueAt && dayKey(new Date(i.dueAt)) === key,
                  );
                  return (
                    <div
                      key={key}
                      className={cn(
                        'min-h-24 bg-background p-1.5',
                        !day.inMonth && 'opacity-40',
                      )}
                    >
                      <div className="mb-1 text-[11px] text-muted-foreground">
                        {day.date.getDate()}
                      </div>
                      <div className="flex flex-col gap-1">
                        {dayItems.slice(0, 3).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openEdit(item)}
                            className="truncate rounded px-1 py-0.5 text-left text-[10px] text-white"
                            style={{
                              background:
                                item.status.color || 'var(--color-primary)',
                            }}
                          >
                            {item.title}
                          </button>
                        ))}
                        {dayItems.length > 3 ? (
                          <span className="text-[10px] text-muted-foreground">
                            +{dayItems.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-4">
              {items.length === 0 ? (
                <EmptyState
                  title="Sin pendientes"
                  description="Crea tu primera tarea para empezar."
                />
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Prioridad</TableHead>
                        <TableHead>Esfuerzo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead>Tiempo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => openEdit(item)}
                        >
                          <TableCell className="font-medium">
                            {item.title}
                          </TableCell>
                          <TableCell>{item.type?.name ?? '—'}</TableCell>
                          <TableCell>
                            {PRIORITY_LABEL[item.priority]}
                          </TableCell>
                          <TableCell>
                            {item.effort
                              ? EFFORT_LABEL[item.effort]
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.status.name}</Badge>
                          </TableCell>
                          <TableCell>{formatShortDate(item.dueAt)}</TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                rows={3}
                value={form.detail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, detail: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="todo-notes">Anotaciones</Label>
              <Textarea
                id="todo-notes"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
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
                  <SelectContent>
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
                  <SelectContent>
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
                  <SelectContent>
                    {(
                      Object.keys(PRIORITY_LABEL) as TodoPriority[]
                    ).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
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
                  <SelectContent>
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
                    value={form.addMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, addMinutes: e.target.value }))
                    }
                  />
                </div>
              ) : null}
            </div>
            {editing ? (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Registro: {formatShortDate(editing.registeredAt)}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {editing.timeSpentMinutes} min
                </span>
                <span>
                  Estado cambió: {formatShortDate(editing.statusChangedAt)}
                </span>
              </div>
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
  onOpen,
}: {
  status: TodoStatusDto;
  items: TodoItemDto[];
  onOpen: (item: TodoItemDto) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
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
            <KanbanCard key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function KanbanCard({
  item,
  onOpen,
}: {
  item: TodoItemDto;
  onOpen: (item: TodoItemDto) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(item)}
      className={cn(
        'rounded-md border bg-background p-2.5 text-left shadow-sm',
        isDragging && 'opacity-60',
      )}
    >
      <div className="text-sm font-medium leading-snug">{item.title}</div>
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
          <span className="text-[10px] text-muted-foreground">
            {formatShortDate(item.dueAt)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildMonthGrid(monthStart: Date) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
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
