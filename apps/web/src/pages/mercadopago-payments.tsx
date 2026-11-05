import { useEffect, useState } from 'react';
import type { MercadoPagoPaymentDto, MercadoPagoPaymentsDto, MercadoPagoSyncStatusDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { Spinner } from '@/components/feedback';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';

const formatDate = (value: string) => new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value));
const money = (currency: string, amount: string | null) => amount == null ? '—' :
  new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(Number(amount));
const emptyFilters = { q: '', status: '', from: '', to: '', page: 1 };

export function MercadoPagoPayments({ sourceId, sourceName, updateOpen, onUpdateOpenChange }: {
  sourceId: string; sourceName: string; updateOpen: boolean; onUpdateOpenChange: (open: boolean) => void;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<MercadoPagoPaymentsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<MercadoPagoPaymentDto | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<MercadoPagoSyncStatusDto | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [range, setRange] = useState({ from: '', to: '' });

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, String(value)));
    api.mercadoPagoPayments(sourceId, params).then(value => !cancelled && setData(value))
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : 'No se pudieron cargar las ventas.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [sourceId, filters, revision]);

  useEffect(() => {
    if (!updateOpen) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => api.mercadoPagoStatus(sourceId).then(value => {
      if (cancelled) return;
      setStatus(value);
      setSyncing(value.lastRun?.status === 'running');
      if (value.lastRun?.status === 'running') timer = setTimeout(poll, 1500);
      else setRevision(value => value + 1);
    }).catch(err => !cancelled && setError(err instanceof Error ? err.message : 'No se pudo consultar el estado.'));
    void poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [sourceId, updateOpen]);

  const hasFilters = !!(filters.q || filters.status || filters.from || filters.to);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const setFilter = (key: 'status' | 'from' | 'to', value: string) => setFilters(old => ({ ...old, [key]: value, page: 1 }));

  return <section aria-label={`Operaciones de ${sourceName}`} className="flex flex-col gap-5">
    <form className="flex flex-col gap-3 rounded-xl border border-border p-4" onSubmit={event => {
      event.preventDefault(); setFilters(old => ({ ...old, q: search.trim(), page: 1 }));
    }}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 gap-1.5 text-sm"><span className="font-medium">Buscar</span>
          <Input type="search" placeholder="Operación, descripción, cliente o email" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <Button type="submit">Buscar</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Estado</span>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">Todos</option>{data?.states.map(state => <option key={state}>{state}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Desde</span><Input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Hasta</span><Input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} /></label>
      </div>
      {hasFilters && <Button type="button" variant="ghost" className="self-start" onClick={() => { setSearch(''); setFilters(emptyFilters); }}>Limpiar filtros</Button>}
    </form>

    {loading ? <p role="status" className="flex items-center gap-2 text-sm"><Spinner /> Cargando ventas…</p>
      : error ? <p role="alert" className="text-sm text-destructive">{error}</p>
      : data && <>
        <p className="text-sm"><span className="font-medium tabular-nums">{data.total}</span> {data.total === 1 ? 'operación' : 'operaciones'}</p>
        {data.payments.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Todavía no hay ventas guardadas.</div>
          : <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow>
            <TableHead>Fecha</TableHead><TableHead>Operación</TableHead><TableHead>Descripción</TableHead><TableHead>Cliente</TableHead>
            <TableHead className="text-right">Venta</TableHead><TableHead className="text-right">Neto</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader><TableBody>{data.payments.map(payment => <TableRow key={payment.id} tabIndex={0} className="cursor-pointer"
            onClick={() => setDetail(payment)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetail(payment); } }}>
            <TableCell className="whitespace-nowrap">{formatDate(payment.createdAtMp)}</TableCell>
            <TableCell className="font-mono text-xs">{payment.paymentId}</TableCell>
            <TableCell className="max-w-[15rem] truncate">{payment.description || '—'}</TableCell>
            <TableCell className="max-w-[14rem] truncate">{payment.payerName || payment.payerEmail || '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{money(payment.currency, payment.grossAmount)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(payment.currency, payment.netAmount)}</TableCell>
            <TableCell><Badge variant="secondary">{payment.status}</Badge></TableCell>
          </TableRow>)}</TableBody></Table></div>}
        {data.total > 0 && <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={filters.page <= 1} onClick={() => setFilters(old => ({ ...old, page: old.page - 1 }))}>Anterior</Button>
          <span className="text-sm">Página {data.page} de {totalPages}</span><Button variant="outline" disabled={filters.page >= totalPages} onClick={() => setFilters(old => ({ ...old, page: old.page + 1 }))}>Siguiente</Button></div>}
      </>}

    <Dialog open={updateOpen} onOpenChange={onUpdateOpenChange}><DialogContent><DialogHeader><DialogTitle>Actualizar ventas de Mercado Pago</DialogTitle>
      <DialogDescription>Consulta la API oficial y guarda las operaciones en esta fuente.</DialogDescription></DialogHeader>
      <div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm"><span className="font-medium">Desde</span><Input type="date" value={range.from} onChange={e => setRange(old => ({ ...old, from: e.target.value }))} /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Hasta</span><Input type="date" value={range.to} onChange={e => setRange(old => ({ ...old, to: e.target.value }))} /></label></div>
        {status && !status.configured && <p role="alert" className="text-sm text-destructive">Falta configurar el elemento de Vaultwarden o el runtime del servidor.</p>}
        {status?.lastRun?.errorCode && <p role="alert" className="text-sm text-destructive">La última actualización falló: {status.lastRun.errorCode}</p>}
        {status?.lastRun?.status === 'completed' && <p className="text-sm">Última actualización: {status.lastRun.rowCount} operaciones procesadas.</p>}
        <Button disabled={syncing || status?.configured === false} onClick={async () => { setError(''); setSyncing(true); try { await api.syncMercadoPago(sourceId, { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) });
          setStatus(await api.mercadoPagoStatus(sourceId)); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar.'); setSyncing(false); } }}>{syncing ? 'Actualizando…' : 'Sincronizar ventas'}</Button>
      </div></DialogContent></Dialog>

    <Dialog open={detail !== null} onOpenChange={open => !open && setDetail(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Detalle de operación</DialogTitle><DialogDescription>{detail ? `Operación ${detail.paymentId}` : sourceName}</DialogDescription></DialogHeader>
      {detail && <dl className="grid gap-3 text-sm">
        <Row label="Venta" value={money(detail.currency, detail.grossAmount)} /><Row label="Total recibido" value={money(detail.currency, detail.netAmount)} />
        <Row label="Costos" value={money(detail.currency, detail.feeAmount)} /><Row label="Estado" value={`${detail.status}${detail.statusDetail ? ` · ${detail.statusDetail}` : ''}`} />
        <Row label="Fecha" value={formatDate(detail.createdAtMp)} /><Row label="Liberación" value={detail.releasedAt ? formatDate(detail.releasedAt) : '—'} />
        <Row label="Medio de pago" value={[detail.issuerName, detail.paymentMethodId, detail.paymentTypeId, detail.cardLastDigits ? `•••• ${detail.cardLastDigits}` : null].filter(Boolean).join(' · ') || '—'} />
        <Row label="Cuotas" value={detail.installments ? String(detail.installments) : '—'} /><Row label="Cliente" value={detail.payerName || '—'} />
        <Row label="Email" value={detail.payerEmail || '—'} /><Row label="Descripción" value={detail.description || '—'} /><Row label="Referencia" value={detail.externalReference || '—'} />
        {detail.payload && <div className="grid gap-1"><dt className="text-xs font-medium uppercase text-muted-foreground">Registro del portal</dt><dd><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">{JSON.stringify(detail.payload, null, 2)}</pre></dd></div>}
      </dl>}
    </DialogContent></Dialog>
  </section>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 border-b pb-2 last:border-0"><dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>;
}
