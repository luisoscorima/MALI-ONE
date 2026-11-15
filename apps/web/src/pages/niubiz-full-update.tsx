import { useEffect, useRef, useState } from 'react';
import type { NiubizPayCashSyncStatusDto, NiubizSyncStatusDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

const runLabel = (status?: string) => {
  switch (status) {
    case 'running': return 'En curso';
    case 'completed': return 'Completada';
    case 'partial': return 'Completada con errores';
    case 'failed': return 'Fallida';
    case 'interrupted': return 'Interrumpida';
    default: return 'Sin ejecuciones';
  }
};

const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo iniciar la actualización.';

export function NiubizFullUpdateDialog({ open, onOpenChange, onUpdated }: Props) {
  const { user } = useAuth();
  const [sales, setSales] = useState<NiubizSyncStatusDto | null>(null);
  const [paycash, setPaycash] = useState<NiubizPayCashSyncStatusDto | null>(null);
  const [error, setError] = useState('');
  const [salesStartError, setSalesStartError] = useState('');
  const [paycashStartError, setPaycashStartError] = useState('');
  const [starting, setStarting] = useState(false);
  const seen = useRef('');
  const updated = useRef(onUpdated);
  updated.current = onUpdated;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const [salesStatus, paycashStatus] = await Promise.all([api.niubizStatus(), api.niubizPayCashStatus()]);
        if (cancelled) return;
        setSales(salesStatus);
        setPaycash(paycashStatus);
        setError('');
        const version = `${salesStatus.lastRun?.runId}:${salesStatus.lastRun?.status}:${salesStatus.lastRun?.results.length}|${paycashStatus.lastRun?.runId}:${paycashStatus.lastRun?.status}`;
        if (seen.current && seen.current !== version) updated.current();
        seen.current = version;
        const running = salesStatus.lastRun?.status === 'running' || paycashStatus.lastRun?.status === 'running';
        timer = setTimeout(poll, running ? 5000 : 15000);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar el estado de la fuente.');
        timer = setTimeout(poll, 15000);
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open]);

  async function start() {
    setStarting(true);
    setError('');
    setSalesStartError('');
    setPaycashStartError('');
    const [salesResult, paycashResult] = await Promise.allSettled([
      api.syncNiubiz({}),
      api.syncNiubizPayCash(),
    ]);
    if (salesResult.status === 'rejected') setSalesStartError(message(salesResult.reason));
    if (paycashResult.status === 'rejected') setPaycashStartError(message(paycashResult.reason));
    const [nextSales, nextPaycash] = await Promise.allSettled([api.niubizStatus(), api.niubizPayCashStatus()]);
    if (nextSales.status === 'fulfilled') setSales(nextSales.value);
    if (nextPaycash.status === 'fulfilled') setPaycash(nextPaycash.value);
    setStarting(false);
  }

  const running = starting || sales?.lastRun?.status === 'running' || paycash?.lastRun?.status === 'running';
  const configured = sales?.configured && paycash?.configured;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Actualizar toda la fuente</DialogTitle>
        <DialogDescription>
          Inicia Ventas Niubiz para los comercios del conector y PagoEfectivo para 650177853 · CURSOSDELMALI.
          Cada apartado guarda y muestra su resultado por separado.
        </DialogDescription>
      </DialogHeader>
      <div className="divide-y divide-border rounded-xl border border-border text-sm">
        <div className="flex items-center justify-between gap-3 p-3">
          <span className="font-medium">Ventas Niubiz</span>
          <span role="status">{sales ? runLabel(sales.lastRun?.status) : 'Consultando estado…'}</span>
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <span className="font-medium">PagoEfectivo</span>
          <span role="status">{paycash ? runLabel(paycash.lastRun?.status) : 'Consultando estado…'}</span>
        </div>
      </div>
      {!configured && sales && paycash && <p className="text-sm text-muted-foreground">Falta configurar el acceso a Niubiz Comercio.</p>}
      {user?.role === 'admin' && <Button disabled={!configured || !!running} onClick={() => void start()}>
        {running ? 'Actualización en curso…' : 'Iniciar ambas actualizaciones'}
      </Button>}
      {salesStartError && <p role="alert" className="text-sm text-destructive">Ventas Niubiz: {salesStartError}</p>}
      {paycashStartError && <p role="alert" className="text-sm text-destructive">PagoEfectivo: {paycashStartError}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {(sales?.lastRun?.errorCode || paycash?.lastRun?.errorCode) && <p className="text-sm text-destructive">
        La última ejecución tuvo errores. Abre el apartado correspondiente para ver el detalle y reintentar solo esa consulta.
      </p>}
    </DialogContent>
  </Dialog>;
}
