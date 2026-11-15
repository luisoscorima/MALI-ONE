import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { NiubizPayCashPaymentDto, NiubizPayCashPaymentsDto, NiubizPayCashSyncStatusDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Spinner } from '@/components/feedback';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';

const emptyFilters = { q: '', status: '', from: '', to: '', page: 1 };
const formatDate = (value: string) => new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value));

const errorText: Record<string, string> = {
  VAULT_AUTH: 'Vaultwarden rechazó el acceso.',
  VAULT_UNLOCK: 'No se pudo desbloquear Vaultwarden.',
  VAULT_ITEM: 'Revisa el ítem de Niubiz Comercio en Vaultwarden.',
  NIUBIZ_LOGIN_REQUIRED: 'Niubiz requiere iniciar sesión o verificar el acceso.',
  LOGIN_WORKER_FAILED: 'No se pudo ejecutar el inicio de sesión de Niubiz.',
  RATE_LIMITED: 'Niubiz limitó las consultas. Reintenta más tarde.',
  API_SCHEMA_ERROR: 'Niubiz cambió la respuesta. No se guardaron operaciones.',
  API_DATA_MISMATCH: 'Hay operaciones inválidas o repetidas. No se guardó el lote.',
  EXPORT_INCOMPLETE: 'La cantidad recibida no coincide con el total. No se guardó el lote.',
};

export function NiubizPayCashPayments({ updateOpen, onUpdateOpenChange, refreshKey }: {
  updateOpen: boolean;
  onUpdateOpenChange: (open: boolean) => void;
  refreshKey: number;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<NiubizPayCashPaymentsDto | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<NiubizPayCashPaymentDto | null>(null);
  const [status, setStatus] = useState<NiubizPayCashSyncStatusDto | null>(null);
  const [syncError, setSyncError] = useState('');
  const [busy, setBusy] = useState(false);
  const seenRun = useRef('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
    setLoading(true);
    setError('');
    api.niubizPayCashPayments(params).then(value => { if (!cancelled) setData(value); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las operaciones.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters, revision, refreshKey]);

  useEffect(() => {
    if (!updateOpen) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const value = await api.niubizPayCashStatus();
        if (cancelled) return;
        setStatus(value);
        setSyncError('');
        const version = `${value.lastRun?.runId}:${value.lastRun?.status}`;
        if (seenRun.current && seenRun.current !== version && value.lastRun?.status !== 'running') {
          setRevision(v => v + 1);
        }
        seenRun.current = version;
        timer = setTimeout(poll, value.lastRun?.status === 'running' ? 5000 : 15000);
      } catch (err) {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err.message : 'No se pudo consultar la actualización.');
          timer = setTimeout(poll, 15000);
        }
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [updateOpen]);

  const setFilter = (key: 'status' | 'from' | 'to', value: string) =>
    setFilters(current => ({ ...current, [key]: value, page: 1 }));
  const hasFilters = !!(filters.q || filters.status || filters.from || filters.to);
  const run = status?.lastRun;

  return <section aria-label="Operaciones PagoEfectivo de Niubiz" className="flex flex-col gap-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold">PagoEfectivo</h3>
        <p className="text-sm text-muted-foreground">Comercio 650177853 · CURSOSDELMALI</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onUpdateOpenChange(true)}>
        <RefreshCw className="size-4" aria-hidden="true" /> Actualizar PagoEfectivo
      </Button>
    </div>
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <form role="search" aria-label="Buscar operaciones PagoEfectivo" className="flex flex-wrap items-end gap-3"
        onSubmit={event => { event.preventDefault(); setFilters(current => ({ ...current, q: search.trim(), page: 1 })); }}>
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm"><span className="font-medium">Buscar</span>
          <Input type="search" maxLength={250} placeholder="Código CIP o email" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <Button type="submit">Buscar</Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Estado</span>
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={filters.status}
            onChange={event => setFilter('status', event.target.value)}>
            <option value="">Todos los estados</option>
            {data?.states.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Compra desde</span>
          <Input type="date" value={filters.from} onChange={event => setFilter('from', event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Compra hasta</span>
          <Input type="date" value={filters.to} onChange={event => setFilter('to', event.target.value)} />
        </label>
      </div>
      {hasFilters && <Button variant="ghost" className="self-start" onClick={() => { setSearch(''); setFilters({ ...emptyFilters }); }}>Limpiar filtros</Button>}
    </div>
    {loading ? <p role="status" className="flex items-center gap-2 text-sm"><Spinner /> Cargando operaciones…</p>
      : error ? <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" onClick={() => setRevision(v => v + 1)}>Reintentar</Button></div>
      : data && <>
        <p className="text-sm" role="status"><span className="font-medium tabular-nums">{data.total}</span> {data.total === 1 ? 'operación guardada' : 'operaciones guardadas'}</p>
        {data.payments.length ? <div className="overflow-x-auto rounded-xl border border-border"><Table><TableHeader><TableRow>
          <TableHead>Código CIP</TableHead><TableHead>Cliente</TableHead><TableHead>Moneda</TableHead>
          <TableHead className="text-right">Importe pedido</TableHead><TableHead>Fecha de compra</TableHead>
          <TableHead>Fecha de pago</TableHead><TableHead>Estado</TableHead>
        </TableRow></TableHeader><TableBody>{data.payments.map(payment => <TableRow key={payment.id} className="cursor-pointer" tabIndex={0}
          onClick={() => setDetail(payment)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetail(payment); } }}>
          <TableCell className="font-mono text-xs">{payment.cip}</TableCell>
          <TableCell className="max-w-[15rem] truncate">{payment.customerEmail || '—'}</TableCell>
          <TableCell>{payment.currency}</TableCell><TableCell className="text-right tabular-nums">{payment.amount}</TableCell>
          <TableCell className="whitespace-nowrap">{formatDate(payment.purchasedAt)}</TableCell>
          <TableCell className="whitespace-nowrap">{payment.paidAt ? formatDate(payment.paidAt) : '—'}</TableCell>
          <TableCell><Badge variant="secondary">{payment.status}</Badge></TableCell>
        </TableRow>)}</TableBody></Table></div>
          : <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {hasFilters ? 'No hay operaciones para estos filtros.' : 'Todavía no hay operaciones guardadas. Actualiza PagoEfectivo para consultar Niubiz.'}
          </div>}
        {data.total > 0 && <div className="flex items-center justify-between gap-3 text-sm">
          <Button variant="outline" disabled={filters.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Anterior</Button>
          <span>Página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
          <Button variant="outline" disabled={filters.page * data.pageSize >= data.total} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Siguiente</Button>
        </div>}
      </>}
    <Dialog open={updateOpen} onOpenChange={onUpdateOpenChange}><DialogContent>
      <DialogHeader><DialogTitle>Actualizar PagoEfectivo</DialogTitle><DialogDescription>
        Consulta por API todas las operaciones de 650177853 · CURSOSDELMALI y guarda los cambios sin duplicar CIP.
      </DialogDescription></DialogHeader>
      {status && <p className="text-sm">{status.configured ? 'Conexión Niubiz configurada' : 'Falta configurar Niubiz Comercio en el servidor'}</p>}
      {user?.role === 'admin' && <Button disabled={!status?.configured || busy || run?.status === 'running'} onClick={() => {
        setBusy(true); setSyncError('');
        void api.syncNiubizPayCash().then(() => api.niubizPayCashStatus()).then(setStatus)
          .catch(err => setSyncError(err instanceof Error ? err.message : 'No se pudo iniciar la actualización.'))
          .finally(() => setBusy(false));
      }}>{busy || run?.status === 'running' ? 'Actualizando…' : 'Sincronizar operaciones'}</Button>}
      {syncError && <p role="alert" className="text-sm text-destructive">{syncError}</p>}
      {run && <div role="status" className="space-y-1 text-sm">
        <p>{run.status === 'completed' ? 'Última actualización completada' : run.status === 'running' ? 'Actualización en curso' : run.status === 'interrupted' ? 'Actualización interrumpida' : 'La última actualización falló'}
          {run.finishedAt && ` · ${formatDate(run.finishedAt)}`}</p>
        {run.status === 'completed' && <p>{run.rowCount} operaciones · {run.createdCount} nuevas · {run.updatedCount} actualizadas</p>}
        {run.errorCode && <p className="text-destructive">{errorText[run.errorCode] ?? 'La consulta falló. Las operaciones anteriores se conservan; vuelve a intentar.'}</p>}
      </div>}
    </DialogContent></Dialog>
    <Dialog open={detail !== null} onOpenChange={open => !open && setDetail(null)}><DialogContent>
      <DialogHeader><DialogTitle>Operación PagoEfectivo</DialogTitle><DialogDescription>CIP {detail?.cip}</DialogDescription></DialogHeader>
      {detail && <dl className="grid gap-2 text-sm">
        <div><dt className="text-muted-foreground">Cliente</dt><dd>{detail.customerEmail || '—'}</dd></div>
        <div><dt className="text-muted-foreground">Importe</dt><dd>{detail.currency} {detail.amount}</dd></div>
        <div><dt className="text-muted-foreground">Marca</dt><dd>{detail.brand}</dd></div>
        <div><dt className="text-muted-foreground">Compra</dt><dd>{formatDate(detail.purchasedAt)}</dd></div>
        <div><dt className="text-muted-foreground">Pago</dt><dd>{detail.paidAt ? formatDate(detail.paidAt) : '—'}</dd></div>
        <div><dt className="text-muted-foreground">Estado</dt><dd>{detail.status}</dd></div>
      </dl>}
    </DialogContent></Dialog>
  </section>;
}
