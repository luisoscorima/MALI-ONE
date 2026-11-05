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
  idle: 'Sin ejecuciones',
  running: 'Sincronizando',
  completed: 'Completada',
  partial: 'Completada con errores',
  failed: 'No se pudo completar',
  interrupted: 'Ejecución interrumpida',
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
  sourceName: string;
  lastImport: { createdAt: string; rowCount: number; origin: string } | null;
  onUpdated: () => void;
};

const formatStamp = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

export function NiubizUpdateDialog({ open, onOpenChange, sourceName, lastImport, onUpdated }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<NiubizSyncStatusDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState('');
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
          setError(err instanceof Error ? err.message : 'No se pudo consultar la sincronización.');
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

  async function importFile() {
    if (!file || importing) return;
    setImporting(true);
    setImportError('');
    setImportResult('');
    try {
      const result = await api.importNiubizPayments(file);
      setImportResult(
        `${result.rows} operaciones: ${result.createdCount} nuevas, ${result.updatedCount} actualizadas y ${result.unchangedCount} sin cambios.`,
      );
      callback.current();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'No se pudo importar.');
    } finally {
      setImporting(false);
    }
  }

  const run = data?.lastRun;
  const failed = run?.results.filter((r) => r.status !== 'ok') ?? [];
  const syncRunning = busy || run?.status === 'running';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Actualizar pagos</DialogTitle>
          <DialogDescription>
            {sourceName}. Trae operaciones por API o importa el Excel de Ventas Niubiz.
          </DialogDescription>
        </DialogHeader>

        {lastImport && (
          <p className="text-xs text-muted-foreground">
            Último lote guardado: {formatStamp(lastImport.createdAt)} · {lastImport.rowCount} operaciones ·{' '}
            {lastImport.origin === 'niubiz_api' ? 'API Niubiz' : 'Archivo Excel'}
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <h3 className="font-medium">Por API Niubiz</h3>
            <p className="text-sm text-muted-foreground">
              Consulta los {data?.merchantCount ?? 77} comercios del conector y guarda los pagos sin
              duplicarlos. Sin fechas, actualiza los últimos 32 días.
            </p>
            {data && (
              <p className="text-sm">
                {data.configured ? 'Conexión configurada' : 'Falta configurar la conexión en el servidor'} ·{' '}
                {data.scheduled ? 'Programada cada 2 horas' : 'Programación desactivada'}
              </p>
            )}
            {user?.role === 'admin' && (
              <div className="flex flex-col gap-3">
                <label className="grid gap-1 text-sm">
                  Sincronizar desde
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">
                  Sincronizar hasta
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </label>
                <Button disabled={!data?.configured || syncRunning} onClick={() => void sync()}>
                  {syncRunning ? 'Sincronizando…' : 'Sincronizar pagos'}
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
                  {labels[run.status] ?? run.status} ·{' '}
                  {run.results.filter((r) => r.status === 'ok').length}/{data?.merchantCount} comercios
                  consultados correctamente
                  {run.fromDate && ` · ${run.fromDate} al ${run.toDate}`}
                </p>
                <p>
                  {run.results.reduce((sum, r) => sum + (r.createdCount ?? 0), 0)} pagos nuevos ·{' '}
                  {run.results.reduce((sum, r) => sum + (r.updatedCount ?? 0), 0)} actualizados
                </p>
                {run.errorCode && (
                  <p className="text-destructive">
                    {errors[run.errorCode] ??
                      'La sincronización falló. Los comercios ya guardados se conservan; puedes reintentar el mismo rango.'}
                  </p>
                )}
                {run.status === 'interrupted' && (
                  <p>La ejecución anterior perdió la conexión. Puedes volver a ejecutar el mismo rango.</p>
                )}
                {failed.length > 0 && (
                  <details>
                    <summary className="cursor-pointer">
                      Ver {failed.length} comercios pendientes de revisión
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {failed.map((r) => (
                        <li key={r.merchant}>
                          {r.merchant}:{' '}
                          {r.status === 'EXPORT_INCOMPLETE'
                            ? 'Demasiados resultados; selecciona un rango menor.'
                            : 'Consulta fallida; reintenta el rango.'}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <h3 className="font-medium">Por archivo Excel</h3>
            <p className="text-sm text-muted-foreground">
              Importa el Excel original de Ventas Niubiz. Los estados se actualizarán según ese archivo.
            </p>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Archivo XLSX (hasta 5 MB)</span>
              <Input
                type="file"
                accept=".xlsx"
                disabled={importing}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setImportResult('');
                  setImportError('');
                }}
              />
            </label>
            <Button disabled={!file || importing} onClick={() => void importFile()}>
              {importing ? 'Importando…' : 'Importar pagos'}
            </Button>
            {importResult && (
              <p role="status" className="text-sm">
                {importResult}
              </p>
            )}
            {importError && (
              <p role="alert" className="text-sm text-destructive">
                {importError}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
