import { useEffect, useRef, useState } from 'react';
import type { NiubizSyncStatusDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui';

const labels: Record<string, string> = {
  idle: 'Sin actualizaciones',
  running: 'Actualizando',
  completed: 'Completada',
  partial: 'Completada con errores',
  failed: 'No se pudo completar',
  interrupted: 'Actualización interrumpida',
};

const errors: Record<string, string> = {
  VAULT_AUTH: 'Vaultwarden rechazó el acceso. Revisa la clave API configurada en el servidor.',
  VAULT_UNLOCK: 'No se pudo desbloquear la bóveda. Revisa la clave maestra y la versión del cliente.',
  VAULT_ITEM: 'No se pudo leer Niubiz Comercio. Revisa el ID del elemento y el acceso de la cuenta a Finanzas.',
  NIUBIZ_LOGIN_REQUIRED: 'Niubiz no permitió iniciar sesión. Revisa las credenciales y si exige una verificación manual.',
  LOGIN_WORKER_FAILED: 'No se pudo ejecutar el inicio de sesión. Revisa la instalación del conector en el servidor.',
  RATE_LIMITED: 'Niubiz limitó las consultas. Espera antes de volver a sincronizar.',
  SESSION_RENEWAL_LIMIT: 'La sesión no se mantuvo vigente. Revisa el acceso a Niubiz antes de reintentar.',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function NiubizUpdateDialog({ open, onOpenChange, onUpdated }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<NiubizSyncStatusDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const seen = useRef('');
  const callback = useRef(onUpdated);
  callback.current = onUpdated;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let running = false;
      try {
        const value = await api.niubizStatus();
        if (cancelled) return;
        setData(value);
        setError('');
        running = value.lastRun?.status === 'running';
        const version = `${value.lastRun?.runId}:${value.lastRun?.results.length}:${value.lastRun?.status}`;
        if (seen.current && seen.current !== version) callback.current();
        seen.current = version;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo consultar el estado.');
        }
      }
      if (!cancelled) timer = setTimeout(poll, running ? 5000 : 15000);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open]);

  async function sync() {
    setBusy(true);
    setError('');
    try {
      await api.syncNiubiz({ ...(from ? { from } : {}), ...(to ? { to } : {}) });
      setData(await api.niubizStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar.');
    } finally {
      setBusy(false);
    }
  }

  const run = data?.lastRun;
  const failed = run?.results.filter((r) => r.status !== 'ok') ?? [];
  const syncRunning = busy || run?.status === 'running';
  const created = run?.results.reduce((sum, r) => sum + (r.createdCount ?? 0), 0) ?? 0;
  const updated = run?.results.reduce((sum, r) => sum + (r.updatedCount ?? 0), 0) ?? 0;
  const okCount = run?.results.filter((r) => r.status === 'ok').length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Actualizar ventas Niubiz</DialogTitle>
          <DialogDescription>
            Consulta las ventas desde Niubiz Comercio. Actualiza los{' '}
            {data?.merchantCount ?? 5} comercios activos sin duplicar pagos. Sin fecha, toma los
            últimos 10 días.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {data && (
            <p className="text-sm text-muted-foreground">
              {!data.configured
                ? 'Conexión pendiente en el servidor'
                : data.scheduled
                  ? 'Actualización cada 15 minutos'
                  : 'Actualización automática desactivada'}
            </p>
          )}
          {user?.role === 'admin' && (
            <div className="flex flex-col gap-3">
              <label className="grid gap-1 text-sm">
                Desde
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                Hasta
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
              <Button disabled={!data?.configured || syncRunning} onClick={() => void sync()}>
                {syncRunning ? 'Actualizando…' : 'Actualizar ahora'}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {run && (
            <div className="space-y-2 text-sm" role="status">
              <p>
                {labels[run.status] ?? run.status} · {okCount}/{data?.merchantCount} comercios
                {run.fromDate ? ` · del ${run.fromDate} al ${run.toDate}` : ''} · {created}{' '}
                pagos nuevos · {updated} actualizados
              </p>
              {run.errorCode && (
                <p className="text-destructive">
                  {errors[run.errorCode] ??
                    'No se pudo completar. Los pagos ya guardados se mantienen; puedes reintentar el mismo periodo.'}
                </p>
              )}
              {run.status === 'interrupted' && (
                <p>La actualización anterior se cortó. Puedes volver a intentar el mismo periodo.</p>
              )}
              {failed.length > 0 && (
                <details>
                  <summary className="cursor-pointer">
                    Ver {failed.length} comercios con problemas
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {failed.map((r) => (
                      <li key={r.merchant}>
                        {r.merchant}:{' '}
                        {r.status === 'EXPORT_INCOMPLETE'
                          ? 'Hay demasiados resultados; elige un periodo más corto.'
                          : 'No se pudo consultar; vuelve a intentar.'}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
