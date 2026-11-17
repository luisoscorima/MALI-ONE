import { lazy, Suspense, useEffect, useState } from 'react';
import type { MalichimpCampaignStatsDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { Button, Card } from '@/components/ui';
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

interface MalichimpCampaignStatsPanelProps {
  campaignId: string;
  campaignName: string;
  loadStats?: (
    campaignId: string,
    days: number,
  ) => Promise<MalichimpCampaignStatsDto>;
}

export function MalichimpCampaignStatsPanel({
  campaignId,
  campaignName,
  loadStats = api.getMalichimpCampaignStats,
}: MalichimpCampaignStatsPanelProps) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MalichimpCampaignStatsDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const useSharedCache = loadStats === api.getMalichimpCampaignStats;
    if (useSharedCache) {
      const cached = getCachedMalichimpCampaignStats(campaignId, days);
      if (cached) {
        setStats(cached);
        setLoading(false);
        setError('');
        return;
      }
    }

    setLoading(true);
    setError('');
    void loadStats(campaignId, days)
      .then((data) => {
        if (!cancelled) {
          if (useSharedCache) {
            setCachedMalichimpCampaignStats(campaignId, days, data);
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
  }, [campaignId, days, loadStats]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Campaña</p>
          <p className="font-medium">{campaignName || stats.name}</p>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Enviados" value={nf.format(stats.sent)} hint={`/ ${nf.format(stats.totalRecipients)}`} />
        <Kpi label="Entregados" value={nf.format(stats.delivered)} />
        <Kpi
          label="Aperturas"
          value={nf.format(stats.opened)}
          hint={pf.format(stats.openRate)}
        />
        <Kpi
          label="Clics"
          value={nf.format(stats.clicked)}
          hint={pf.format(stats.clickRate)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Rebotes" value={nf.format(stats.bounced)} />
        <Kpi label="Omitidos" value={nf.format(stats.suppressed)} />
        <Kpi label="Fallidos" value={nf.format(stats.failed)} />
        <Kpi label="Quejas" value={nf.format(stats.complaints)} />
      </div>

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
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-3">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted">
        {label}
        {hint ? ` · ${hint}` : ''}
      </p>
    </Card>
  );
}
