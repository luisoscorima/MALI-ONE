import { lazy, Suspense, useEffect, useState } from 'react';
import type { LinkStatsDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { getCachedLinkStats, setCachedLinkStats } from '@/lib/stats-cache';
import { Spinner } from '@/components/feedback';
import { Button, Card } from '@/components/ui';

const LinkStatsChart = lazy(() =>
  import('@/components/link-stats-chart').then((m) => ({
    default: m.LinkStatsChart,
  })),
);

interface LinkStatsPanelProps {
  linkId: string;
  slug: string;
}

export function LinkStatsPanel({ linkId, slug }: LinkStatsPanelProps) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LinkStatsDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedLinkStats(linkId, days);
    if (cached) {
      setStats(cached);
      setLoading(false);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    void api
      .getLinkStats(linkId, days)
      .then((data) => {
        if (!cancelled) {
          setCachedLinkStats(linkId, days, data);
          setStats(data);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar estadísticas');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkId, days]);

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

  const chartData = stats.clicksByDay.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  function pct(count: number) {
    if (stats!.totalClicks === 0) return '0%';
    return `${Math.round((count / stats!.totalClicks) * 100)}%`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Enlace</p>
          <p className="font-medium">{slug}</p>
        </div>
        <div className="flex items-center gap-2">
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

      <Card className="p-4">
        <p className="mb-1 text-2xl font-semibold">{stats.totalClicks}</p>
        <p className="text-sm text-muted">Clicks / escaneos totales</p>
      </Card>

      <Card className="p-4">
        <h4 className="mb-4 text-sm font-medium">Actividad por día</h4>
        <Suspense
          fallback={
            <div className="flex h-52 items-center justify-center">
              <Spinner className="size-5" />
            </div>
          }
        >
          <LinkStatsChart data={chartData} />
        </Suspense>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsTable title="Dispositivos" rows={stats.devices} pct={pct} />
        <StatsTable
          title="Navegadores"
          rows={stats.browsers.map((b) => ({ type: b.name, count: b.count }))}
          pct={pct}
        />
        <StatsTable
          title="Sistemas operativos"
          rows={stats.operatingSystems.map((o) => ({
            type: o.name,
            count: o.count,
          }))}
          pct={pct}
        />
      </div>
    </div>
  );
}

function StatsTable({
  title,
  rows,
  pct,
}: {
  title: string;
  rows: { type: string; count: number }[];
  pct: (n: number) => string;
}) {
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-sm font-medium">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Sin datos en el período</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li
              key={row.type}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate capitalize">{row.type}</span>
              <span className="shrink-0 text-muted">
                {row.count}{' '}
                <span className="text-xs">({pct(row.count)})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
