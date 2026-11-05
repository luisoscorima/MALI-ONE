import { useEffect, useState } from 'react';
import type { TreasuryPaymentDto, TreasuryPaymentsDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { Spinner } from '@/components/feedback';
import { NiubizUpdateDialog } from './niubiz-sync';

const date = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

const dateOnly = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    dateStyle: 'short',
  }).format(new Date(value));

const emptyFilters = { q: '', merchant: '', status: '', from: '', to: '', page: 1 };
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';
const dash = '—';

function cardLabel(p: TreasuryPaymentDto) {
  const parts = [p.cardBrand, p.cardType, p.cardLastDigits ? `•••• ${p.cardLastDigits}` : null].filter(
    Boolean,
  );
  return parts.length ? parts.join(' · ') : null;
}

type Props = {
  sourceName: string;
  updateOpen: boolean;
  onUpdateOpenChange: (open: boolean) => void;
  merchantsOpen: boolean;
  onMerchantsOpenChange: (open: boolean) => void;
};

export function TreasuryPayments({
  sourceName,
  updateOpen,
  onUpdateOpenChange,
  merchantsOpen,
  onMerchantsOpenChange,
}: Props) {
  const [data, setData] = useState<TreasuryPaymentsDto | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<TreasuryPaymentDto | null>(null);
  const [merchantCount, setMerchantCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
    });
    api
      .treasuryPayments(params)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar los pagos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, revision]);

  useEffect(() => {
    if (!merchantsOpen) return;
    let cancelled = false;
    api
      .niubizStatus()
      .then((status) => {
        if (!cancelled) setMerchantCount(status.merchantCount);
      })
      .catch(() => {
        if (!cancelled) setMerchantCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [merchantsOpen]);

  function filter(key: 'merchant' | 'status' | 'from' | 'to', value: string) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  const hasFilters = !!(filters.q || filters.merchant || filters.status || filters.from || filters.to);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const showCard = !!data?.payments.some((p) => cardLabel(p));
  const showWallet = !!data?.payments.some((p) => p.wallet);

  return (
    <section aria-labelledby="payments-title" className="flex flex-col gap-5">
      <div className="sr-only">
        <h2 id="payments-title">Operaciones de {sourceName}</h2>
      </div>

      {data?.lastImport && (
        <p className="text-xs text-muted-foreground">
          Último lote guardado: {date(data.lastImport.createdAt)} · {data.lastImport.rowCount} operaciones ·{' '}
          {data.lastImport.origin === 'niubiz_api' ? 'API Niubiz' : 'Archivo Excel'}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <form
          role="search"
          aria-label="Buscar pagos"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters((f) => ({ ...f, q: search.trim(), page: 1 }));
          }}
        >
          <label className="grid min-w-0 flex-1 gap-1.5 text-sm">
            <span className="font-medium">Buscar</span>
            <Input
              type="search"
              maxLength={250}
              placeholder="Pedido, transacción, cliente o email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Button type="submit">Buscar</Button>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Comercio</span>
            <select
              className={selectClass}
              value={filters.merchant}
              onChange={(e) => filter('merchant', e.target.value)}
            >
              <option value="">Todos los comercios</option>
              {data?.merchants.map((m) => (
                <option key={m.merchantCode} value={m.merchantCode}>
                  {m.merchantCode} · {m.merchantName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Estado</span>
            <select
              className={selectClass}
              value={filters.status}
              onChange={(e) => filter('status', e.target.value)}
            >
              <option value="">Todos los estados</option>
              {data?.states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Desde</span>
            <Input type="date" value={filters.from} onChange={(e) => filter('from', e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">Hasta</span>
            <Input type="date" value={filters.to} onChange={(e) => filter('to', e.target.value)} />
          </label>
        </div>

        {hasFilters && (
          <Button
            className="self-start"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setFilters({ ...emptyFilters });
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Spinner /> Cargando pagos…
        </p>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-sm">{error}</p>
          <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
            Reintentar
          </Button>
        </div>
      ) : data ? (
        <>
          <p className="text-sm" role="status">
            <span className="tabular-nums font-medium">{data.total}</span>{' '}
            {data.total === 1 ? 'operación' : 'operaciones'}
            {hasFilters ? ' que coinciden con los filtros' : ' guardadas'}
            {filters.q ? ` · Búsqueda: ${filters.q}` : ''}
          </p>

          {data.payments.length === 0 ? (
            <EmptyPayments hasFilters={hasFilters} onUpdate={() => onUpdateOpenChange(true)} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comercio</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Código de transacción</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                    {showCard && <TableHead>Tarjeta</TableHead>}
                    {showWallet && <TableHead>Billetera</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => setDetail(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetail(p);
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap tabular-nums">{date(p.transactedAt)}</TableCell>
                      <TableCell>
                        <span className="block font-medium tabular-nums">{p.merchantCode}</span>
                        <span className="text-xs text-muted-foreground">{p.merchantName || dash}</span>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate tabular-nums">{p.orderNumber}</TableCell>
                      <TableCell className="max-w-[10rem] truncate font-mono text-xs">
                        {p.transactionCode}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">
                        {p.customerName || dash}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate">{p.customerEmail || dash}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {p.currency} {p.amount}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.status}</Badge>
                      </TableCell>
                      {showCard && (
                        <TableCell className="max-w-[12rem] truncate text-sm">
                          {cardLabel(p) || dash}
                        </TableCell>
                      )}
                      {showWallet && (
                        <TableCell className="whitespace-nowrap text-sm">{p.wallet || dash}</TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {data.total > 0 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Anterior
              </Button>
              <span className="text-sm tabular-nums">
                Página {data.page} de {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={filters.page * data.pageSize >= data.total}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      ) : null}

      <NiubizUpdateDialog
        open={updateOpen}
        onOpenChange={onUpdateOpenChange}
        sourceName={sourceName}
        lastImport={data?.lastImport ?? null}
        onUpdated={() => {
          setSearch('');
          setFilters({ ...emptyFilters });
          setRevision((v) => v + 1);
        }}
      />

      <Dialog open={merchantsOpen} onOpenChange={onMerchantsOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comercios de esta fuente</DialogTitle>
            <DialogDescription>
              El conector consulta {merchantCount ?? '…'} códigos. La lista muestra los que ya tienen
              operaciones guardadas.
            </DialogDescription>
          </DialogHeader>
          {!data?.merchants.length ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay comercios con operaciones. Actualiza pagos para poblar esta lista.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {data.merchants.map((m) => (
                <li key={m.merchantCode} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                  <span className="font-medium tabular-nums">{m.merchantCode}</span>
                  <span className="text-muted-foreground">{m.merchantName || 'Sin nombre'}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de operación</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.merchantCode} · ${detail.transactionCode}` : sourceName}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <dl className="grid gap-3 text-sm">
              <DetailRow label="Fecha" value={date(detail.transactedAt)} />
              <DetailRow
                label="Comercio"
                value={`${detail.merchantCode}${detail.merchantName ? ` · ${detail.merchantName}` : ''}`}
              />
              <DetailRow label="Pedido" value={detail.orderNumber} />
              <DetailRow label="Código de transacción" value={detail.transactionCode} mono />
              <DetailRow label="Cliente" value={detail.customerName || dash} />
              <DetailRow label="Email" value={detail.customerEmail || dash} />
              <DetailRow label="Importe" value={`${detail.currency} ${detail.amount}`} />
              <DetailRow label="Estado" value={detail.status} />
              {detail.settledOn && (
                <DetailRow label="Liquidación" value={dateOnly(detail.settledOn)} />
              )}
              {(cardLabel(detail) || detail.wallet) && (
                <>
                  <DetailRow label="Tarjeta" value={cardLabel(detail) || dash} />
                  <DetailRow label="Billetera" value={detail.wallet || dash} />
                </>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border pb-2 last:border-0">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className={mono ? 'break-all font-mono text-xs' : 'break-words'}>{value}</dd>
    </div>
  );
}

function EmptyPayments({
  hasFilters,
  onUpdate,
}: {
  hasFilters: boolean;
  onUpdate: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-pretty text-sm text-muted-foreground">
        {hasFilters
          ? 'No hay pagos para estos filtros.'
          : 'Todavía no hay pagos guardados. Actualiza desde la API Niubiz o un Excel.'}
      </p>
      {!hasFilters && (
        <Button className="mt-4" variant="outline" onClick={onUpdate}>
          Actualizar pagos
        </Button>
      )}
    </div>
  );
}
