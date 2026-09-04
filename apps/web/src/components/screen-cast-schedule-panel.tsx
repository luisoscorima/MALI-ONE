import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  ScreenCastMonitorDto,
  ScreenCastPlaylistDto,
  ScreenCastScheduleOverrideDto,
} from '@mali-one/shared';
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
} from '@/components/ui';

const LIMA_TZ = 'America/Lima';

const MONITOR_COLORS = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#ec4899',
  '#64748b',
] as const;

type ScheduleDraft = {
  id?: string;
  monitorId: string;
  playlistId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

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

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function limaYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '01';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function limaHm(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LIMA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

/** Convert America/Lima wall clock to UTC ISO. */
function limaWallToIso(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const utcGuess = Date.UTC(y!, mo! - 1, d!, h!, mi!, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: LIMA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(new Date(utcGuess))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asLimaMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(utcGuess - (asLimaMs - utcGuess)).toISOString();
}

function monitorColor(monitorId: string): string {
  let hash = 0;
  for (let i = 0; i < monitorId.length; i++) {
    hash = (hash * 31 + monitorId.charCodeAt(i)) >>> 0;
  }
  return MONITOR_COLORS[hash % MONITOR_COLORS.length]!;
}

function formatEndsAtLima(iso: string): string {
  return limaHm(new Date(iso));
}

export function ScreenCastSchedulePanel({
  monitors,
  playlists,
  onChanged,
}: {
  monitors: ScreenCastMonitorDto[];
  playlists: Array<ScreenCastPlaylistDto & { activo: boolean }>;
  onChanged: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [monthCursor, setMonthCursor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [overrides, setOverrides] = useState<ScreenCastScheduleOverrideDto[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const calendarDays = useMemo(
    () => buildMonthGrid(monthCursor),
    [monthCursor],
  );
  const todayKey = limaYmd(new Date());

  const range = useMemo(() => {
    const days = buildMonthGrid(monthCursor);
    const first = days[0]!.date;
    const last = days[days.length - 1]!.date;
    const from = limaWallToIso(
      `${first.getFullYear()}-${pad2(first.getMonth() + 1)}-${pad2(first.getDate())}`,
      '00:00',
    );
    const toDate = new Date(
      last.getFullYear(),
      last.getMonth(),
      last.getDate() + 1,
    );
    const to = limaWallToIso(
      `${toDate.getFullYear()}-${pad2(toDate.getMonth() + 1)}-${pad2(toDate.getDate())}`,
      '00:00',
    );
    return { from, to };
  }, [monthCursor]);

  const loadOverrides = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listScreenCastScheduleOverrides(
        range.from,
        range.to,
      );
      setOverrides(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Error al cargar programación',
      );
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, toast]);

  useEffect(() => {
    void loadOverrides();
  }, [loadOverrides]);

  const monitorsWithDefault = useMemo(
    () => monitors.filter((m) => Boolean(m.playlistId)),
    [monitors],
  );
  const activePlaylists = useMemo(
    () => playlists.filter((p) => p.activo),
    [playlists],
  );

  function openCreateForDay(date: Date) {
    const ymd = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    setDraft({
      monitorId: monitorsWithDefault[0]?.id ?? '',
      playlistId: activePlaylists[0]?.id ?? '',
      startDate: ymd,
      startTime: '18:00',
      endDate: ymd,
      endTime: '23:00',
    });
    setDialogOpen(true);
  }

  function openEdit(row: ScreenCastScheduleOverrideDto) {
    const start = new Date(row.startsAt);
    const end = new Date(row.endsAt);
    setDraft({
      id: row.id,
      monitorId: row.monitorId,
      playlistId: row.playlistId,
      startDate: limaYmd(start),
      startTime: limaHm(start),
      endDate: limaYmd(end),
      endTime: limaHm(end),
    });
    setDialogOpen(true);
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.monitorId || !draft.playlistId) {
      toast.error('Elige monitor y playlist');
      return;
    }
    const startsAt = limaWallToIso(draft.startDate, draft.startTime);
    const endsAt = limaWallToIso(draft.endDate, draft.endTime);
    if (!(new Date(endsAt) > new Date(startsAt))) {
      toast.error('La hora de fin debe ser posterior al inicio');
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        await api.updateScreenCastScheduleOverride(draft.id, {
          monitorId: draft.monitorId,
          playlistId: draft.playlistId,
          startsAt,
          endsAt,
        });
        toast.success('Programación actualizada');
      } else {
        await api.createScreenCastScheduleOverride({
          monitorId: draft.monitorId,
          playlistId: draft.playlistId,
          startsAt,
          endsAt,
        });
        toast.success('Programación creada');
      }
      setDialogOpen(false);
      setDraft(null);
      await loadOverrides();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function removeDraft() {
    if (!draft?.id) return;
    const ok = await confirm({
      title: '¿Eliminar esta programación?',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    setSaving(true);
    try {
      await api.deleteScreenCastScheduleOverride(draft.id);
      toast.success('Programación eliminada');
      setDialogOpen(false);
      setDraft(null);
      await loadOverrides();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  }

  function eventsForDay(ymd: string) {
    return overrides.filter((row) => {
      const start = limaYmd(new Date(row.startsAt));
      const end = limaYmd(new Date(new Date(row.endsAt).getTime() - 1));
      return ymd >= start && ymd <= end;
    });
  }

  return (
    <section className="space-y-4 border-t pt-8">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-medium">
          <CalendarDays size={18} />
          Programación
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Overrides opcionales sobre la playlist por defecto del monitor
          (horario America/Lima). Si solo programas un monitor de un par
          sincronizado, dejarán de ir al unísono hasta que ambos compartan otra
          vez la misma playlist.
        </p>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
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
        <h4 className="text-sm font-medium capitalize">
          {monthCursor.toLocaleDateString('es-PE', {
            month: 'long',
            year: 'numeric',
            timeZone: LIMA_TZ,
          })}
          {loading ? ' · …' : ''}
        </h4>
        <Button
          type="button"
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
          const ymd = `${day.date.getFullYear()}-${pad2(day.date.getMonth() + 1)}-${pad2(day.date.getDate())}`;
          const dayEvents = eventsForDay(ymd);
          const isToday = ymd === todayKey;
          return (
            <button
              key={ymd}
              type="button"
              onClick={() => openCreateForDay(day.date)}
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
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: monitorColor(ev.monitorId) }}
                    title={`${ev.monitorName}: ${ev.playlistName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(ev);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        openEdit(ev);
                      }
                    }}
                  >
                    {limaHm(new Date(ev.startsAt))} {ev.monitorName}
                  </span>
                ))}
                {dayEvents.length > 3 ? (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayEvents.length - 3}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDraft(null);
        }}
      >
        <DialogContent
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
              {draft?.id ? 'Editar programación' : 'Nueva programación'}
            </DialogTitle>
            <DialogDescription>
              Horario en America/Lima. El monitor debe tener playlist por
              defecto.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Monitor</Label>
                <Select
                  value={draft.monitorId || undefined}
                  onValueChange={(v) =>
                    setDraft({ ...draft, monitorId: v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Con playlist por defecto" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {monitorsWithDefault.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Playlist</Label>
                <Select
                  value={draft.playlistId || undefined}
                  onValueChange={(v) =>
                    setDraft({ ...draft, playlistId: v })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Playlist activa" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {activePlaylists.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-ov-start-date">Desde (fecha)</Label>
                <Input
                  id="sc-ov-start-date"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft({ ...draft, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-ov-start-time">Desde (hora)</Label>
                <Input
                  id="sc-ov-start-time"
                  type="time"
                  value={draft.startTime}
                  onChange={(e) =>
                    setDraft({ ...draft, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-ov-end-date">Hasta (fecha)</Label>
                <Input
                  id="sc-ov-end-date"
                  type="date"
                  value={draft.endDate}
                  onChange={(e) =>
                    setDraft({ ...draft, endDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sc-ov-end-time">Hasta (hora)</Label>
                <Input
                  id="sc-ov-end-time"
                  type="time"
                  value={draft.endTime}
                  onChange={(e) =>
                    setDraft({ ...draft, endTime: e.target.value })
                  }
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            {draft?.id ? (
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => void removeDraft()}
              >
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
                disabled={saving || !draft}
                onClick={() => void saveDraft()}
              >
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function ScheduleActiveBadge({
  scheduleActive,
}: {
  scheduleActive: ScreenCastMonitorDto['scheduleActive'];
}) {
  if (!scheduleActive) return null;
  return (
    <Badge className="gap-1">
      Programado · hasta {formatEndsAtLima(scheduleActive.endsAt)}
    </Badge>
  );
}
