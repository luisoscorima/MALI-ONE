import { lazy, Suspense, useEffect, useState } from 'react';
import type {
  MalichimpCampaignSendEvent,
  MalichimpCampaignSendsPageDto,
  MalichimpCampaignStatsDto,
  MalichimpSendScope,
} from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { Button, Card, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell } from '@/components/ui';
import { api } from '@/lib/api';
import {
  getCachedMalichimpCampaignStats,
  setCachedMalichimpCampaignStats,
} from '@/lib/stats-cache';

const MalichimpCampaignStatsChart = lazy(() =>
  import('@/components/malichimp-campaign-stats-chart').then((m) => ({
    default: m.MalichimpCampaignStatsChart,
  })),
);

const nf = new Intl.NumberFormat('es-PE');
const pf = new Intl.NumberFormat('es-PE', {
  style: 'percent',
  maximumFractionDigits: 1,
});
const df = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const EVENT_OPTIONS: Array<{ value: MalichimpCampaignSendEvent; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'sent', label: 'Enviados' },
  { value: 'delivered', label: 'Recibieron' },
  { value: 'opened', label: 'Abrieron' },
  { value: 'clicked', label: 'Clicaron' },
  { value: 'replied', label: 'Respondieron' },
  { value: 'bounced', label: 'Rebotes' },
  { value: 'suppressed', label: 'Omitidos' },
  { value: 'failed', label: 'Fallidos' },
  { value: 'complained', label: 'Quejas' },
];

interface MalichimpCampaignStatsPanelProps {
  campaignId: string;
  campaignName: string;
  loadStats?: (
    campaignId: string,
    days: number,
    scope?: MalichimpSendScope,
  ) => Promise<MalichimpCampaignStatsDto>;
}

export function MalichimpCampaignStatsPanel({
  campaignId,
  campaignName,
  loadStats = api.getMalichimpCampaignStats,
}: MalichimpCampaignStatsPanelProps) {
  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<MalichimpSendScope>('production');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MalichimpCampaignStatsDto | null>(null);
  const [error, setError] = useState('');
  const [event, setEvent] = useState<MalichimpCampaignSendEvent>('delivered');
  const [sendsQuery, setSendsQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sendsPage, setSendsPage] = useState(1);
  const [sends, setSends] = useState<MalichimpCampaignSendsPageDto | null>(null);
  const [sendsLoading, setSendsLoading] = useState(false);
  const [sendsError, setSendsError] = useState('');
  const supportsScope = loadStats === api.getMalichimpCampaignStats;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(sendsQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [sendsQuery]);

  useEffect(() => {
    setSendsPage(1);
  }, [event, debouncedQuery, campaignId, scope]);

  useEffect(() => {
    let cancelled = false;
    if (supportsScope) {
      const cached = getCachedMalichimpCampaignStats(campaignId, days, scope);
      if (cached) {
        setStats(cached);
        setLoading(false);
        setError('');
        return;
      }
    }

    setLoading(true);
    setError('');
    void loadStats(campaignId, days, supportsScope ? scope : undefined)
      .then((data) => {
        if (!cancelled) {
          if (supportsScope) {
            setCachedMalichimpCampaignStats(campaignId, days, data, scope);
          }
          setStats(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setStats(null);
          setError(
            e instanceof Error ? e.message : 'Error al cargar estadísticas',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, days, loadStats, scope, supportsScope]);

  useEffect(() => {
    if (!supportsScope) return;
    let cancelled = false;
    setSendsLoading(true);
    setSendsError('');
    void api
      .listMalichimpCampaignSends(campaignId, {
        event,
        scope,
        q: debouncedQuery || undefined,
        page: sendsPage,
        pageSize: 25,
      })
      .then((data) => {
        if (!cancelled) setSends(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setSends(null);
          setSendsError(e instanceof Error ? e.message : 'No se pudo cargar la lista');
        }
      })
      .finally(() => {
        if (!cancelled) setSendsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, debouncedQuery, event, scope, sendsPage, supportsScope]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
        <Spinner /> Cargando estadísticas...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        {error || 'Sin datos'}
      </p>
    );
  }

  const chartData = stats.opensByDay.map((day, index) => ({
    date: day.date,
    label: day.date.slice(5),
    opens: day.count,
    clicks: stats.clicksByDay[index]?.count ?? 0,
  }));

  const replied = stats.replied ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Campaña</p>
          <p className="font-medium text-balance">{campaignName || stats.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {supportsScope ? (
            <div className="flex items-center gap-1">
              {(
                [
                  ['production', 'Producción'],
                  ['test', 'Pruebas'],
                  ['all', 'Todo'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={scope === value ? 'default' : 'outline'}
                  onClick={() => setScope(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          ) : null}
          <span className="text-sm text-muted">Período:</span>
          {[7, 30, 90].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Enviados"
          value={nf.format(stats.sent)}
          hint={`/ ${nf.format(stats.totalRecipients)}`}
          active={event === 'sent'}
          onClick={() => setEvent('sent')}
        />
        <Kpi
          label="Entregados"
          value={nf.format(stats.delivered)}
          active={event === 'delivered'}
          onClick={() => setEvent('delivered')}
        />
        <Kpi
          label="Aperturas"
          value={nf.format(stats.opened)}
          hint={pf.format(stats.openRate)}
          active={event === 'opened'}
          onClick={() => setEvent('opened')}
        />
        <Kpi
          label="Clics"
          value={nf.format(stats.clicked)}
          hint={pf.format(stats.clickRate)}
          active={event === 'clicked'}
          onClick={() => setEvent('clicked')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi
          label="Respondieron"
          value={nf.format(replied)}
          hint={pf.format(stats.replyRate ?? 0)}
          active={event === 'replied'}
          onClick={() => setEvent('replied')}
        />
        <Kpi
          label="Rebotes"
          value={nf.format(stats.bounced)}
          active={event === 'bounced'}
          onClick={() => setEvent('bounced')}
        />
        <Kpi
          label="Omitidos"
          value={nf.format(stats.suppressed)}
          active={event === 'suppressed'}
          onClick={() => setEvent('suppressed')}
        />
        <Kpi
          label="Fallidos"
          value={nf.format(stats.failed)}
          active={event === 'failed'}
          onClick={() => setEvent('failed')}
        />
        <Kpi
          label="Quejas"
          value={nf.format(stats.complaints)}
          active={event === 'complained'}
          onClick={() => setEvent('complained')}
        />
      </div>

      <p className="text-sm text-pretty text-muted-foreground">
        {nf.format(replied)} persona{replied === 1 ? '' : 's'} respondieron
      </p>

      <Card className="p-4">
        <h4 className="mb-4 text-sm font-medium">Aperturas y clics por día</h4>
        {chartData.every((row) => row.opens === 0 && row.clicks === 0) ? (
          <p className="py-10 text-center text-sm text-muted">
            Sin aperturas ni clics en este período
          </p>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-52 items-center justify-center">
                <Spinner className="size-5" />
              </div>
            }
          >
            <MalichimpCampaignStatsChart data={chartData} />
          </Suspense>
        )}
      </Card>

      {supportsScope ? (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium">Destinatarios</h4>
              <p className="text-xs text-muted-foreground">
                Lista filtrada por el evento y el alcance seleccionado
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={event}
                onChange={(e) => setEvent(e.target.value as MalichimpCampaignSendEvent)}
                aria-label="Filtrar por evento"
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                className="h-9 w-48"
                placeholder="Buscar correo o nombre"
                value={sendsQuery}
                onChange={(e) => setSendsQuery(e.target.value)}
              />
            </div>
          </div>

          {sendsError ? (
            <p className="text-sm text-destructive">{sendsError}</p>
          ) : null}

          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Clic</TableHead>
                  <TableHead>Reply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="size-4" /> Cargando…
                      </span>
                    </TableCell>
                  </TableRow>
                ) : sends?.items.length ? (
                  sends.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-48">
                        <p className="font-medium">{row.name || 'Sin nombre'}</p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </TableCell>
                      <TableCell>
                        {row.isTest ? (
                          <span className="text-xs font-medium text-amber-700">Prueba</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Prod</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{row.status}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {row.deliveredAt ? df.format(new Date(row.deliveredAt)) : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {row.openedAt ? df.format(new Date(row.openedAt)) : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {row.clickedAt ? df.format(new Date(row.clickedAt)) : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {row.repliedAt ? df.format(new Date(row.repliedAt)) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      Sin destinatarios en este filtro
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableShell>

          {sends ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground tabular-nums">
                {nf.format(sends.total)} resultado{sends.total === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sendsPage <= 1 || sendsLoading}
                  onClick={() => setSendsPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="tabular-nums">
                  {sends.page}/{sends.pages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={sendsPage >= sends.pages || sendsLoading}
                  onClick={() => setSendsPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`p-3 ${onClick ? 'cursor-pointer transition-colors hover:bg-muted/40' : ''} ${active ? 'ring-2 ring-primary/40' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">
        {label}
        {hint ? ` · ${hint}` : ''}
      </p>
    </Card>
  );
}
