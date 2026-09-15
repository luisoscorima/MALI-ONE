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
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  CalendarRange,
  LayoutGrid,
  List,
  Plus,
  Server,
  Trash2,
} from 'lucide-react';
import type {
  AppUserDto,
  OperationalServiceDto,
  OperationalServiceStatus,
  PortfolioArea,
  PortfolioDashboardDto,
  PortfolioImpact,
  PortfolioMetaDto,
  PortfolioProjectDto,
  PortfolioProjectStatusDto,
  PortfolioProjectType,
  TodoEffort,
  TodoItemDto,
  TodoMetaDto,
  TodoOrigin,
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
  Card,
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

const SECTION_STORAGE_KEY = 'mali.portfolio.section';
const PROJECTS_VIEW_KEY = 'mali.portfolio.projectsView';
const TASKS_VIEW_KEY = 'mali.portfolio.tasksView';

const AREA_LABEL: Record<PortfolioArea, string> = {
  infraestructura: 'Infraestructura',
  aplicaciones: 'Aplicaciones',
  datos: 'Datos',
  seguridad: 'Seguridad',
  contenidos: 'Contenidos',
  otros: 'Otros',
};

const IMPACT_LABEL: Record<PortfolioImpact, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const PROJECT_TYPE_LABEL: Record<PortfolioProjectType, string> = {
  estrategico: 'Estratégico',
  tactico: 'Táctico',
  operativo: 'Operativo',
  mejora: 'Mejora',
  migracion: 'Migración',
  otro: 'Otro',
};

const ORIGIN_LABEL: Record<TodoOrigin, string> = {
  internal: 'Interno',
  request: 'Solicitud',
  incident: 'Incidente',
};

const SERVICE_STATUS_LABEL: Record<OperationalServiceStatus, string> = {
  up: 'Operativo',
  degraded: 'Degradado',
  down: 'Caído',
  maintenance: 'Mantenimiento',
};

const SERVICE_STATUS_COLOR: Record<OperationalServiceStatus, string> = {
  up: '#16a34a',
  degraded: '#ca8a04',
  down: '#dc2626',
  maintenance: '#2563eb',
};

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

const DEFAULT_SERVICES = [
  'Sitio web',
  'API principal',
  'Base de datos',
  'Correo institucional',
];

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

type PortfolioSection = 'dashboard' | 'projects' | 'tasks' | 'operation';
type TaskViewMode = 'kanban' | 'calendar' | 'list';
type ProjectViewMode = 'kanban' | 'list' | 'timeline';
type ChipFilter = 'all' | 'today' | 'overdue' | 'high';
type TaskListSortKey = 'title' | 'priority' | 'dueAt' | 'time';
type ProjectListSortKey =
  | 'name'
  | 'area'
  | 'status'
  | 'progress'
  | 'targetAt'
  | 'impact';

type TodoFormState = {
  title: string;
  detail: string;
  typeId: string;
  projectId: string;
  area: string;
  origin: TodoOrigin;
  impact: PortfolioImpact;
  link: string;
  scheduledAt: string;
  priority: TodoPriority;
  effort: string;
  statusId: string;
  dueAt: string;
  addMinutes: string;
  archived: boolean;
};

type ProjectFormState = {
  name: string;
  detail: string;
  statusId: string;
  area: PortfolioArea;
  projectType: PortfolioProjectType;
  stakeholder: string;
  impact: PortfolioImpact;
  link: string;
  targetAt: string;
  archived: boolean;
};

function readStoredSection(): PortfolioSection {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    if (
      raw === 'dashboard' ||
      raw === 'projects' ||
      raw === 'tasks' ||
      raw === 'operation'
    ) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return 'tasks';
}

function readStoredView<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw && allowed.includes(raw as T)) return raw as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

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

function toDateTimeLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
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

function itemCalendarIso(item: TodoItemDto) {
  return item.scheduledAt ?? item.dueAt;
}

function calendarChipLabel(item: TodoItemDto) {
  const prefix = item.scheduledAt
    ? `${new Date(item.scheduledAt).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      })} `
    : '';
  return `${prefix}${item.title}`;
}

function impactBadgeVariant(impact: PortfolioImpact) {
  if (impact === 'high') return 'destructive' as const;
  if (impact === 'medium') return 'default' as const;
  return 'outline' as const;
}

function emptyTodoForm(statusId = ''): TodoFormState {
  return {
    title: '',
    detail: '',
    typeId: '',
    projectId: '',
    area: '',
    origin: 'internal',
    impact: 'medium',
    link: '',
    scheduledAt: '',
    priority: 'medium',
    effort: '',
    statusId,
    dueAt: '',
    addMinutes: '',
    archived: false,
  };
}

function emptyProjectForm(
  statusId = '',
  area: PortfolioArea = 'otros',
): ProjectFormState {
  return {
    name: '',
    detail: '',
    statusId,
    area,
    projectType: 'otro',
    stakeholder: '',
    impact: 'medium',
    link: '',
    targetAt: '',
    archived: false,
  };
}

function exportTasksCsv(items: TodoItemDto[]) {
  const rows = items.map((i) => {
    const date = itemCalendarIso(i);
    const cols = [
      i.title.replace(/"/g, '""'),
      (i.project?.name ?? '').replace(/"/g, '""'),
      i.status.name.replace(/"/g, '""'),
      PRIORITY_LABEL[i.priority],
      date ? formatDateInput(new Date(date)) : '',
    ];
    return cols.map((c) => `"${c}"`).join(',');
  });
  const content = `Tarea,Proyecto,Estado,Prioridad,Fecha\n${rows.join('\n')}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tareas-portafolio.csv';
  a.click();
  URL.revokeObjectURL(url);
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

export function PortfolioPage() {
  const [section, setSection] = useState<PortfolioSection>(readStoredSection);

  useEffect(() => {
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, section);
    } catch {
      /* ignore */
    }
  }, [section]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader title="Portafolio de área" />

      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as PortfolioSection)}
      >
        <TabsList>
          <TabsTrigger value="dashboard">
            <BarChart3 className="size-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="projects">Proyectos</TabsTrigger>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="operation">
            <Server className="size-3.5" />
            Operación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardSection />
        </TabsContent>
        <TabsContent value="projects" className="mt-4">
          <ProjectsSection />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksSection />
        </TabsContent>
        <TabsContent value="operation" className="mt-4">
          <OperationSection onGoTasks={() => setSection('tasks')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DashboardSection() {
  const toast = useToast();
  const [data, setData] = useState<PortfolioDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.getPortfolioDashboard());
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Error al cargar el dashboard';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <TableSkeleton rows={6} />;
  if (error) return <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>;
  if (!data) return null;

  const stats = [
    { label: 'Activos', value: data.projectsActive },
    { label: 'En ejecución', value: data.projectsInProgress },
    { label: 'Planificados', value: data.projectsPlanned },
    { label: 'Bloqueados', value: data.projectsBlocked },
    { label: 'Cerrados', value: data.projectsClosed },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">Distribución por área</h3>
          {data.areaDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.areaDistribution.map((row) => (
                <div key={row.area}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{AREA_LABEL[row.area]}</span>
                    <span className="text-muted-foreground">
                      {row.count} ({row.percent}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">Semana en curso</h3>
          <div className="mb-3 flex gap-4 text-sm">
            <span>
              <strong>{data.weekCompletedTasks}</strong> tareas completadas
            </span>
            <span>
              <strong>{data.weekTimeMinutes}</strong> min registrados
            </span>
          </div>
          {data.weekCompletedTitles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay tareas completadas esta semana.
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {data.weekCompletedTitles.map((t, i) => (
                <li key={`${t}-${i}`} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-medium">Próximos hitos</h3>
        {data.upcomingMilestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin hitos próximos.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.upcomingMilestones.map((m) => (
                  <TableRow key={`${m.kind}-${m.id}`}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {m.kind === 'project' ? 'Proyecto' : 'Tarea'}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.projectName ?? '—'}</TableCell>
                    <TableCell>{formatShortDate(m.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProjectsSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const [meta, setMeta] = useState<PortfolioMetaDto | null>(null);
  const [projects, setProjects] = useState<PortfolioProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<ProjectViewMode>(() =>
    readStoredView(PROJECTS_VIEW_KEY, ['kanban', 'list', 'timeline'], 'kanban'),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioProjectDto | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm());
  const [saving, setSaving] = useState(false);
  const [listSort, setListSort] = useState<{
    key: ProjectListSortKey;
    dir: 'asc' | 'desc';
  }>({ key: 'name', dir: 'asc' });

  const statuses = meta?.projectStatuses ?? [];
  const timelineYear = new Date().getFullYear();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [m, list] = await Promise.all([
        api.getPortfolioMeta(),
        api.listProjects({ includeClosed: true }),
      ]);
      setMeta(m);
      setProjects(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar proyectos';
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
    try {
      localStorage.setItem(PROJECTS_VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const sortedList = useMemo(() => {
    const list = [...projects];
    const dir = listSort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (listSort.key) {
        case 'name':
          return a.name.localeCompare(b.name, 'es') * dir;
        case 'area':
          return a.area.localeCompare(b.area, 'es') * dir;
        case 'status':
          return a.status.name.localeCompare(b.status.name, 'es') * dir;
        case 'progress':
          return (a.progress - b.progress) * dir;
        case 'targetAt': {
          const av = a.targetAt
            ? new Date(a.targetAt).getTime()
            : Number.POSITIVE_INFINITY;
          const bv = b.targetAt
            ? new Date(b.targetAt).getTime()
            : Number.POSITIVE_INFINITY;
          return (av - bv) * dir;
        }
        case 'impact': {
          const rank = { low: 0, medium: 1, high: 2 };
          return (rank[a.impact] - rank[b.impact]) * dir;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [projects, listSort]);

  function toggleListSort(key: ProjectListSortKey) {
    setListSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  function openCreate() {
    const defaultStatus = statuses.find((s) => !s.isClosed) ?? statuses[0];
    setEditing(null);
    setForm(
      emptyProjectForm(
        defaultStatus?.id ?? '',
        meta?.areas[0] ?? 'otros',
      ),
    );
    setDialogOpen(true);
  }

  function openEdit(project: PortfolioProjectDto) {
    setEditing(project);
    setForm({
      name: project.name,
      detail: project.detail ?? '',
      statusId: project.statusId,
      area: project.area,
      projectType: project.projectType,
      stakeholder: project.stakeholder ?? '',
      impact: project.impact,
      link: project.link ?? '',
      targetAt: toDateInput(project.targetAt),
      archived: Boolean(project.archivedAt),
    });
    setDialogOpen(true);
  }

  function upsertProject(saved: PortfolioProjectDto) {
    setProjects((prev) => {
      if (saved.archivedAt) {
        return prev.filter((p) => p.id !== saved.id);
      }
      const exists = prev.some((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      return [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  async function saveProject() {
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        detail: form.detail.trim() || undefined,
        statusId: form.statusId || undefined,
        area: form.area,
        projectType: form.projectType,
        stakeholder: form.stakeholder.trim() || null,
        impact: form.impact,
        link: form.link.trim() || null,
        targetAt: form.targetAt
          ? new Date(`${form.targetAt}T12:00:00`).toISOString()
          : null,
      };
      let saved: PortfolioProjectDto;
      if (editing) {
        saved = await api.updateProject(editing.id, {
          ...payload,
          archived: form.archived,
        });
        toast.success('Proyecto actualizado');
      } else {
        saved = await api.createProject(payload);
        toast.success('Proyecto creado');
      }
      upsertProject(saved);
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function removeProject(project: PortfolioProjectDto) {
    const ok = await confirm({
      title: `¿Eliminar «${project.name}»?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success('Proyecto eliminado');
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  async function moveToStatus(projectId: string, statusId: string) {
    const current = projects.find((p) => p.id === projectId);
    if (!current || current.statusId === statusId) return;
    const status = statuses.find((s) => s.id === statusId);
    if (!status) return;

    const maxOrder = Math.max(
      -1,
      ...projects.filter((p) => p.statusId === statusId).map((p) => p.sortOrder),
    );

    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, statusId, status, sortOrder: maxOrder + 1 }
          : p,
      ),
    );
    try {
      const saved = await api.updateProject(projectId, { statusId });
      upsertProject(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo mover');
      void load();
    }
  }

  async function reorderInColumn(statusId: string, orderedIds: string[]) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.statusId !== statusId) return p;
        const idx = orderedIds.indexOf(p.id);
        return idx >= 0 ? { ...p, sortOrder: idx } : p;
      }),
    );
    try {
      await api.reorderProjects({ statusId, orderedIds });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo reordenar');
      void load();
    }
  }

  function onProjectDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const projectId = String(active.id);
    const overId = String(over.id);
    const activeProject = projects.find((p) => p.id === projectId);
    if (!activeProject) return;

    const overStatus =
      statuses.find((s) => s.id === overId) ??
      projects.find((p) => p.id === overId)?.status;
    if (!overStatus) return;

    if (activeProject.statusId === overStatus.id) {
      const columnItems = projects
        .filter((p) => p.statusId === overStatus.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = columnItems.findIndex((p) => p.id === projectId);
      const newIndex = columnItems.findIndex((p) => p.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(columnItems, oldIndex, newIndex);
      void reorderInColumn(
        overStatus.id,
        reordered.map((p: PortfolioProjectDto) => p.id),
      );
      return;
    }

    void moveToStatus(projectId, overStatus.id);
  }

  const timelineByMonth = useMemo(() => {
    const buckets: PortfolioProjectDto[][] = Array.from({ length: 12 }, () => []);
    for (const p of projects) {
      if (!p.targetAt) continue;
      const d = new Date(p.targetAt);
      if (d.getFullYear() !== timelineYear) continue;
      buckets[d.getMonth()].push(p);
    }
    return buckets;
  }, [projects, timelineYear]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as ProjectViewMode)}>
          <TabsList>
            <TabsTrigger value="kanban">
              <LayoutGrid className="size-3.5" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="size-3.5" />
              Lista
            </TabsTrigger>
            <TabsTrigger value="timeline">
              <CalendarRange className="size-3.5" />
              Timeline
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={openCreate} disabled={!meta}>
          <Plus className="size-4" />
          Nuevo proyecto
        </Button>
      </div>

      {error ? <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner> : null}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : view === 'kanban' ? (
        statuses.length === 0 ? (
          <EmptyState
            title="Sin estados"
            description="No hay estados de proyecto configurados."
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={onProjectDragEnd}
          >
            <div className="flex gap-3 overflow-x-auto pb-2">
              {statuses.map((status) => (
                <ProjectKanbanColumn
                  key={status.id}
                  status={status}
                  projects={projects
                    .filter((p) => p.statusId === status.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder)}
                  onOpen={openEdit}
                />
              ))}
            </div>
          </DndContext>
        )
      ) : view === 'list' ? (
        sortedList.length === 0 ? (
          <EmptyState
            title="Sin proyectos"
            description="Crea tu primer proyecto para empezar."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" className="font-medium" onClick={() => toggleListSort('name')}>
                      Nombre
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="font-medium" onClick={() => toggleListSort('area')}>
                      Área
                    </button>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stakeholder</TableHead>
                  <TableHead>
                    <button type="button" className="font-medium" onClick={() => toggleListSort('status')}>
                      Estado
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="font-medium" onClick={() => toggleListSort('progress')}>
                      Progreso
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="font-medium" onClick={() => toggleListSort('targetAt')}>
                      Meta
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="font-medium" onClick={() => toggleListSort('impact')}>
                      Impacto
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedList.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => openEdit(p)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{AREA_LABEL[p.area]}</TableCell>
                    <TableCell>{PROJECT_TYPE_LABEL[p.projectType]}</TableCell>
                    <TableCell>{p.stakeholder || '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        style={
                          p.status.color
                            ? {
                                backgroundColor: `${p.status.color}22`,
                                color: p.status.color,
                              }
                            : undefined
                        }
                      >
                        {p.status.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">{p.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatShortDate(p.targetAt)}</TableCell>
                    <TableCell>
                      <Badge variant={impactBadgeVariant(p.impact)}>
                        {IMPACT_LABEL[p.impact]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : (
        <div>
          <h3 className="mb-3 text-sm font-medium">{timelineYear}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
            {MONTH_LABELS.map((label, monthIdx) => (
              <div key={label} className="rounded-lg border bg-muted/20 p-2">
                <div className="mb-2 text-center text-xs font-medium text-muted-foreground">
                  {label}
                </div>
                <div className="flex flex-col gap-1">
                  {timelineByMonth[monthIdx].length === 0 ? (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  ) : (
                    timelineByMonth[monthIdx].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openEdit(p)}
                        className="rounded border bg-background px-1.5 py-1 text-left text-[10px] hover:bg-muted/50"
                        style={{
                          borderLeftColor: p.status.color ?? undefined,
                          borderLeftWidth: p.status.color ? 3 : undefined,
                        }}
                      >
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="text-muted-foreground">
                          {p.progress}% · {IMPACT_LABEL[p.impact]}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              {editing ? 'Editar proyecto' : 'Nuevo proyecto'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="proj-name">Nombre</Label>
              <Input
                id="proj-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="proj-detail">Detalle</Label>
              <Textarea
                id="proj-detail"
                rows={3}
                value={form.detail}
                onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.statusId}
                  onValueChange={(v) => setForm((f) => ({ ...f, statusId: v }))}
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
                <Label>Área</Label>
                <Select
                  value={form.area}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, area: v as PortfolioArea }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(meta?.areas ?? Object.keys(AREA_LABEL)).map((a) => (
                      <SelectItem key={a} value={a}>
                        {AREA_LABEL[a as PortfolioArea]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo de proyecto</Label>
                <Select
                  value={form.projectType}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      projectType: v as PortfolioProjectType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(Object.keys(PROJECT_TYPE_LABEL) as PortfolioProjectType[]).map(
                      (k) => (
                        <SelectItem key={k} value={k}>
                          {PROJECT_TYPE_LABEL[k]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="proj-stakeholder">Stakeholder</Label>
                <Input
                  id="proj-stakeholder"
                  placeholder="Gerencia, Biblioteca, Educación…"
                  value={form.stakeholder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stakeholder: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Impacto</Label>
                <Select
                  value={form.impact}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, impact: v as PortfolioImpact }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(Object.keys(IMPACT_LABEL) as PortfolioImpact[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {IMPACT_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="proj-target">Fecha meta</Label>
                <Input
                  id="proj-target"
                  type="date"
                  value={form.targetAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetAt: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="proj-link">Enlace</Label>
                <Input
                  id="proj-link"
                  value={form.link}
                  onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                />
              </div>
            </div>
            {editing ? (
              <label className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.archived}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, archived: v === true }))
                  }
                />
                Archivar proyecto
              </label>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void removeProject(editing)}
              >
                <Trash2 className="size-4" />
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={saving} onClick={() => void saveProject()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TasksSection() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === 'admin';

  const [meta, setMeta] = useState<TodoMetaDto | null>(null);
  const [projects, setProjects] = useState<PortfolioProjectDto[]>([]);
  const [items, setItems] = useState<TodoItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<TaskViewMode>(() =>
    readStoredView(TASKS_VIEW_KEY, ['kanban', 'calendar', 'list'], 'kanban'),
  );
  const [chip, setChip] = useState<ChipFilter>('all');
  const [hideDone, setHideDone] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [appUsers, setAppUsers] = useState<AppUserDto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TodoItemDto | null>(null);
  const [form, setForm] = useState<TodoFormState>(emptyTodoForm());
  const [saving, setSaving] = useState(false);
  const [listSort, setListSort] = useState<{
    key: TaskListSortKey;
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
      const [m, list, projs] = await Promise.all([
        api.getTodoMeta(),
        api.listTodos({
          ...(ownerFilter ? { ownerId: ownerFilter } : {}),
          includeDone: !hideDone,
          includeArchived: false,
        }),
        api.listProjects({ includeClosed: true }),
      ]);
      setMeta(m);
      setItems(list);
      setProjects(projs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar tareas';
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
    void api.listAppUsers().then(setAppUsers).catch(() => setAppUsers([]));
  }, [isAdmin]);

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_VIEW_KEY, view);
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
      if (projectFilter && item.projectId !== projectFilter) return false;
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
  }, [items, chip, projectFilter]);

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
          const av = a.dueAt
            ? new Date(a.dueAt).getTime()
            : Number.POSITIVE_INFINITY;
          const bv = b.dueAt
            ? new Date(b.dueAt).getTime()
            : Number.POSITIVE_INFINITY;
          return (av - bv) * dir;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [visibleItems, listSort]);

  function toggleListSort(key: TaskListSortKey) {
    setListSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  function openCreate(prefill?: {
    dueAt?: string;
    scheduledAt?: string;
    statusId?: string;
  }) {
    setEditing(null);
    setForm({
      ...emptyTodoForm(prefill?.statusId || statuses[0]?.id || ''),
      projectId: projectFilter || projects.find((p) => !p.status.isClosed)?.id || '',
      dueAt: prefill?.dueAt ?? '',
      scheduledAt: prefill?.scheduledAt ?? '',
    });
    setDialogOpen(true);
  }

  function openEdit(item: TodoItemDto) {
    setEditing(item);
    setForm({
      title: item.title,
      detail: item.detail ?? '',
      typeId: item.typeId ?? '',
      projectId: item.projectId ?? '',
      area: item.area ?? '',
      origin: item.origin,
      impact: item.impact,
      link: item.link ?? '',
      scheduledAt: toDateTimeLocal(item.scheduledAt),
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
    if (form.origin !== 'incident' && !form.projectId) {
      toast.error('Selecciona un proyecto (solo incidentes pueden ir sin proyecto)');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        detail: form.detail.trim() || undefined,
        typeId: form.typeId || null,
        projectId: form.projectId || null,
        area: (form.area || null) as PortfolioArea | null,
        origin: form.origin,
        impact: form.impact,
        link: form.link.trim() || null,
        priority: form.priority,
        effort: (form.effort || null) as TodoEffort | null,
        statusId: form.statusId || undefined,
        dueAt: form.dueAt
          ? new Date(`${form.dueAt}T12:00:00`).toISOString()
          : null,
        scheduledAt: form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : null,
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
    if (!projectFilter) {
      toast.error(
        'Elige un proyecto en el filtro o usa «Nueva tarea». Solo los incidentes van sin proyecto.',
      );
      return;
    }
    try {
      const saved = await api.createTodo({
        title: trimmed,
        statusId,
        projectId: projectFilter,
        origin: 'internal',
      });
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {counters.open} abiertas · {counters.today} hoy · {counters.overdue} vencidas
        </p>
        <Button onClick={() => openCreate()} disabled={!meta}>
          <Plus className="size-4" />
          Nueva tarea
        </Button>
      </div>

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
        <div className="min-w-48">
          <Select
            value={projectFilter || '__all__'}
            onValueChange={(v) => setProjectFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Proyecto" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="__all__">Todos los proyectos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isAdmin ? (
          <div className="ml-auto min-w-48">
            <Select
              value={ownerFilter || '__all__'}
              onValueChange={(v) => setOwnerFilter(v === '__all__' ? '' : v)}
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

      <Tabs value={view} onValueChange={(v) => setView(v as TaskViewMode)}>
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
                      new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1),
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
                      new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1),
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
                  const dayItems = visibleItems.filter((i) => {
                    const iso = itemCalendarIso(i);
                    return iso && dayKey(new Date(iso)) === key;
                  });
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
                            {calendarChipLabel(item)}
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
              <div className="mb-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => exportTasksCsv(sortedListItems)}
                  disabled={sortedListItems.length === 0}
                >
                  <Download className="size-3.5" />
                  Exportar CSV
                </Button>
              </div>
              {sortedListItems.length === 0 ? (
                <EmptyState
                  title="Sin tareas"
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
                        <TableHead>Proyecto</TableHead>
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
                          <TableCell>{item.project?.name ?? '—'}</TableCell>
                          <TableCell>{item.type?.name ?? '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.priority === 'urgent' || item.priority === 'high'
                                  ? 'destructive'
                                  : 'outline'
                              }
                            >
                              {PRIORITY_LABEL[item.priority]}
                            </Badge>
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
            <DialogTitle>{editing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="todo-title">Título</Label>
              <Input
                id="todo-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="todo-detail">Detalle</Label>
              <Textarea
                id="todo-detail"
                rows={3}
                value={form.detail}
                onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Proyecto{form.origin !== 'incident' ? ' *' : ''}</Label>
                <Select
                  value={form.projectId || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      projectId: v === '__none__' ? '' : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.origin === 'incident'
                          ? 'Sin proyecto (incidente)'
                          : 'Seleccionar proyecto'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {form.origin === 'incident' ? (
                      <SelectItem value="__none__">
                        Sin proyecto (operación)
                      </SelectItem>
                    ) : null}
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.typeId || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, typeId: v === '__none__' ? '' : v }))
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
                <Label>Área</Label>
                <Select
                  value={form.area || '__none__'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, area: v === '__none__' ? '' : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin área" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="__none__">Sin área</SelectItem>
                    {(Object.keys(AREA_LABEL) as PortfolioArea[]).map((a) => (
                      <SelectItem key={a} value={a}>
                        {AREA_LABEL[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Origen</Label>
                <Select
                  value={form.origin}
                  onValueChange={(v) => {
                    const origin = v as TodoOrigin;
                    setForm((f) => ({
                      ...f,
                      origin,
                      projectId:
                        origin !== 'incident' && !f.projectId
                          ? projectFilter ||
                            projects.find((p) => !p.status.isClosed)?.id ||
                            ''
                          : f.projectId,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(Object.keys(ORIGIN_LABEL) as TodoOrigin[]).map((o) => (
                      <SelectItem key={o} value={o}>
                        {ORIGIN_LABEL[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Impacto</Label>
                <Select
                  value={form.impact}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, impact: v as PortfolioImpact }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(Object.keys(IMPACT_LABEL) as PortfolioImpact[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {IMPACT_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Estado</Label>
                <Select
                  value={form.statusId}
                  onValueChange={(v) => setForm((f) => ({ ...f, statusId: v }))}
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
                    setForm((f) => ({ ...f, priority: v as TodoPriority }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {(Object.keys(PRIORITY_LABEL) as TodoPriority[]).map((p) => (
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
                    setForm((f) => ({ ...f, effort: v === '__none__' ? '' : v }))
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
                  onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="todo-scheduled">Programada</Label>
                <Input
                  id="todo-scheduled"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, scheduledAt: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="todo-link">Enlace</Label>
                <Input
                  id="todo-link"
                  value={form.link}
                  onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
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
                            addMinutes: String(Number(f.addMinutes || 0) + m),
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
                    <span>Completada: {formatShortDate(editing.completedAt)}</span>
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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" disabled={saving} onClick={() => void saveTodo()}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OperationSection({ onGoTasks }: { onGoTasks: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [services, setServices] = useState<OperationalServiceDto[]>([]);
  const [todoMeta, setTodoMeta] = useState<TodoMetaDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, meta] = await Promise.all([
        api.listOperationalServices(),
        api.getTodoMeta(),
      ]);
      setServices(list);
      setTodoMeta(meta);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar servicios';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createService(name: string, notes?: string) {
    try {
      const saved = await api.createOperationalService({ name, notes });
      setServices((prev) => [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder));
      toast.success('Servicio creado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    }
  }

  async function saveNew() {
    const name = formName.trim();
    if (!name) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await createService(name, formNotes.trim() || undefined);
      setFormName('');
      setFormNotes('');
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: OperationalServiceStatus) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );
    try {
      const saved = await api.updateOperationalService(id, { status });
      setServices((prev) => prev.map((s) => (s.id === id ? saved : s)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
      void load();
    }
  }

  async function updateNotes(id: string, notes: string) {
    try {
      const saved = await api.updateOperationalService(id, {
        notes: notes.trim() || null,
      });
      setServices((prev) => prev.map((s) => (s.id === id ? saved : s)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar notas');
    }
  }

  async function removeService(service: OperationalServiceDto) {
    const ok = await confirm({
      title: `¿Eliminar «${service.name}»?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteOperationalService(service.id);
      setServices((prev) => prev.filter((s) => s.id !== service.id));
      toast.success('Servicio eliminado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  async function openIncident(service: OperationalServiceDto) {
    const incidentType = todoMeta?.types.find(
      (t) => t.active && t.name.toLowerCase() === 'incidente',
    );
    try {
      await api.createTodo({
        title: `[Incidente] ${service.name}`,
        detail: service.notes ?? undefined,
        origin: 'incident',
        typeId: incidentType?.id ?? null,
      });
      toast.success('Incidente registrado como tarea');
      onGoTasks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir incidente');
    }
  }

  if (loading) return <TableSkeleton rows={4} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      </div>

      {error ? <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner> : null}

      {services.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            title="Sin servicios operativos"
            description="Registra los servicios que monitoreas en el área."
          />
          <div className="flex flex-wrap justify-center gap-2">
            {DEFAULT_SERVICES.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void createService(name)}
              >
                <Plus className="size-3.5" />
                {name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium">{service.name}</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="size-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => void removeService(service)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Select
                value={service.status}
                onValueChange={(v) =>
                  void updateStatus(service.id, v as OperationalServiceStatus)
                }
              >
                <SelectTrigger
                  className="h-8"
                  style={{
                    borderColor: SERVICE_STATUS_COLOR[service.status],
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {(Object.keys(SERVICE_STATUS_LABEL) as OperationalServiceStatus[]).map(
                    (st) => (
                      <SelectItem key={st} value={st}>
                        <span
                          className="mr-2 inline-block size-2 rounded-full"
                          style={{ background: SERVICE_STATUS_COLOR[st] }}
                        />
                        {SERVICE_STATUS_LABEL[st]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
              <Textarea
                rows={2}
                placeholder="Notas…"
                defaultValue={service.notes ?? ''}
                className="text-sm"
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val !== (service.notes ?? '')) {
                    void updateNotes(service.id, val);
                  }
                }}
              />
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Actualizado: {formatShortDate(service.updatedAt)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void openIncident(service)}
                >
                  <AlertTriangle className="size-3.5" />
                  Abrir incidente
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo servicio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="svc-name">Nombre</Label>
              <Input
                id="svc-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-notes">Notas</Label>
              <Textarea
                id="svc-notes"
                rows={3}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void saveNew()}>
              {saving ? 'Guardando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectKanbanColumn({
  status,
  projects,
  onOpen,
}: {
  status: PortfolioProjectStatusDto;
  projects: PortfolioProjectDto[];
  onOpen: (project: PortfolioProjectDto) => void;
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
          {projects.length}
        </Badge>
      </div>
      <SortableContext
        items={projects.map((p) => p.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 p-2">
          {projects.map((project) => (
            <ProjectKanbanCard key={project.id} project={project} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function ProjectKanbanCard({
  project,
  onOpen,
}: {
  project: PortfolioProjectDto;
  onOpen: (project: PortfolioProjectDto) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border bg-background p-2.5 shadow-sm',
        isDragging && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(project)}
      >
        <div className="text-sm font-medium leading-snug">{project.name}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            {AREA_LABEL[project.area]}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {PROJECT_TYPE_LABEL[project.projectType]}
          </Badge>
          <Badge variant={impactBadgeVariant(project.impact)} className="text-[10px]">
            {IMPACT_LABEL[project.impact]}
          </Badge>
          {project.stakeholder ? (
            <span className="text-[10px] text-muted-foreground">
              {project.stakeholder}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${project.progress}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {project.progress}%
          </span>
        </div>
      </button>
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
        {item.project ? (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {item.project.name}
          </div>
        ) : null}
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
