import { useEffect, useState } from 'react';
import type { PagoEfectivoPaymentDto, PagoEfectivoPaymentsDto, PagoEfectivoSyncStatusDto } from '@mali-one/shared';
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

export function PagoEfectivoPayments({ sourceId, sourceName, updateOpen, onUpdateOpenChange }: {
  sourceId: string; sourceName: string; updateOpen: boolean; onUpdateOpenChange: (open: boolean) => void;
}) {
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<PagoEfectivoPaymentsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<PagoEfectivoPaymentDto | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<PagoEfectivoSyncStatusDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [credentialsReady, setCredentialsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, String(value)));
    api.pagoEfectivoPayments(sourceId, params).then(value => !cancelled && setData(value))
      .catch(err => !cancelled && setError(err instanceof Error ? err.message : 'No se pudieron cargar las operaciones.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [sourceId, filters, revision]);

  useEffect(() => {
    if (!updateOpen) return;
    let cancelled = false;
    api.pagoEfectivoStatus(sourceId).then(value => {
      if (!cancelled) setStatus(value);
    }).catch(err => { if (!cancelled) setSyncError(err instanceof Error ? err.message : 'No se pudo consultar el estado.'); });
    return () => { cancelled = true; };
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
          <Input type="search" placeholder="CIP, operación, referencia, cliente o email" value={search} onChange={event => setSearch(event.target.value)} />
        </label><Button type="submit">Buscar</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Estado</span>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={filters.status} onChange={event => setFilter('status', event.target.value)}>
            <option value="">Todos</option>{data?.states.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Desde</span><Input type="date" value={filters.from} onChange={event => setFilter('from', event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Hasta</span><Input type="date" value={filters.to} onChange={event => setFilter('to', event.target.value)} /></label>
      </div>
      {hasFilters && <Button type="button" variant="ghost" className="self-start" onClick={() => { setSearch(''); setFilters(emptyFilters); }}>Limpiar filtros</Button>}
    </form>

    {loading ? <p role="status" className="flex items-center gap-2 text-sm"><Spinner /> Cargando operaciones…</p>
      : error ? <div role="alert" className="flex flex-col items-start gap-2"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setRevision(current => current + 1)}>Reintentar</Button></div>
      : data && <>
        <p className="text-sm"><span className="font-medium tabular-nums">{data.total}</span> {data.total === 1 ? 'operación' : 'operaciones'}</p>
        {data.payments.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Todavía no hay operaciones guardadas.</div>
          : <div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow>
            <TableHead>Fecha</TableHead><TableHead>CIP</TableHead><TableHead>Operación</TableHead><TableHead>Cliente</TableHead>
            <TableHead className="text-right">Importe</TableHead><TableHead className="text-right">Neto</TableHead><TableHead>Estado</TableHead>
          </TableRow></TableHeader><TableBody>{data.payments.map(payment => <TableRow key={payment.id} tabIndex={0} className="cursor-pointer"
            onClick={() => setDetail(payment)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetail(payment); } }}>
            <TableCell className="whitespace-nowrap">{formatDate(payment.createdAtPe)}</TableCell>
            <TableCell className="font-mono text-xs">{payment.cip || '—'}</TableCell><TableCell className="font-mono text-xs">{payment.transactionId}</TableCell>
            <TableCell className="max-w-[14rem] truncate">{payment.payerName || payment.payerEmail || '—'}</TableCell>
            <TableCell className="text-right tabular-nums">{money(payment.currency, payment.amount)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(payment.currency, payment.netAmount)}</TableCell>
            <TableCell><Badge variant="secondary">{payment.status}</Badge></TableCell>
          </TableRow>)}</TableBody></Table></div>}
        {data.total > 0 && <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={filters.page <= 1} onClick={() => setFilters(old => ({ ...old, page: old.page - 1 }))}>Anterior</Button>
          <span className="text-sm">Página {data.page} de {totalPages}</span><Button variant="outline" disabled={filters.page >= totalPages} onClick={() => setFilters(old => ({ ...old, page: old.page + 1 }))}>Siguiente</Button></div>}
      </>}

    <Dialog open={updateOpen} onOpenChange={onUpdateOpenChange}><DialogContent><DialogHeader><DialogTitle>Actualizar operaciones de PagoEfectivo</DialogTitle>
      <DialogDescription>Las credenciales quedan en Vaultwarden. La consulta de movimientos se conecta con el contrato oficial.</DialogDescription></DialogHeader>
      <div className="grid gap-4">
      {status && !status.configured && <p role="alert" className="text-sm text-destructive">Falta el ítem de Vaultwarden con accessKey, secretKey e idService, o el acceso a la bóveda en el servidor.</p>}
      {status?.configured && !status.connected && <p className="text-sm text-muted-foreground">Puedes comprobar el ítem ahora. Todavía no hay una consulta de movimientos: PagoEfectivo no publica un access token fijo como Mercado Pago.</p>}
      {credentialsReady && <p className="text-sm">El ítem se leyó. La consulta de movimientos sigue pendiente del contrato oficial.</p>}
      {syncError && <p role="alert" className="text-sm text-destructive">{syncError}</p>}
      <Button disabled={busy || status?.configured === false} onClick={async () => { setSyncError(''); setCredentialsReady(false); setBusy(true); try {
        await api.syncPagoEfectivo(sourceId);
        setCredentialsReady(true);
        setStatus(await api.pagoEfectivoStatus(sourceId));
      } catch (err) { setSyncError(err instanceof Error ? err.message : 'No se pudo leer el ítem.'); } finally { setBusy(false); } }}>{busy ? 'Comprobando…' : 'Comprobar credenciales'}</Button>
      </div></DialogContent></Dialog>

    <Dialog open={detail !== null} onOpenChange={open => !open && setDetail(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Detalle de operación</DialogTitle><DialogDescription>{detail ? `Operación ${detail.transactionId}` : sourceName}</DialogDescription></DialogHeader>
      {detail && <dl className="grid gap-3 text-sm"><Row label="Importe" value={money(detail.currency, detail.amount)} /><Row label="Neto" value={money(detail.currency, detail.netAmount)} />
        <Row label="Comisión" value={money(detail.currency, detail.feeAmount)} /><Row label="Estado" value={detail.status} /><Row label="CIP" value={detail.cip || '—'} />
        <Row label="Fecha" value={formatDate(detail.createdAtPe)} /><Row label="Pago" value={detail.paidAt ? formatDate(detail.paidAt) : '—'} />
        <Row label="Transferencia" value={detail.transferredAt ? formatDate(detail.transferredAt) : '—'} /><Row label="Cliente" value={detail.payerName || '—'} />
        <Row label="Email" value={detail.payerEmail || '—'} /><Row label="Canal" value={detail.paymentChannel || '—'} /><Row label="Entidad financiera" value={detail.financialEntity || '—'} />
        <Row label="Descripción" value={detail.description || '—'} /><Row label="Referencia" value={detail.externalReference || '—'} />
        {detail.payload && <div className="grid gap-1"><dt className="text-xs font-medium uppercase text-muted-foreground">Registro del portal</dt><dd><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">{JSON.stringify(detail.payload, null, 2)}</pre></dd></div>}
      </dl>}
    </DialogContent></Dialog>
  </section>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 border-b pb-2 last:border-0"><dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>;
}
