import { FormEvent, useEffect, useState } from 'react';
import { FileSpreadsheet, Link2, Pencil, Plus, RefreshCw, Store } from 'lucide-react';
import type { TreasuryPaymentDto, TreasuryPaymentsDto, TreasuryTargetInput } from '@mali-one/shared';
import { api } from '@/lib/api';
import { CopyableValue } from '@/components/copyable-value';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { TreasuryStatusBadge, TreasuryStatusFilter } from './treasury-status';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Pagination,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
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
  sourceId: string;
  sourceName: string;
  refreshKey: number;
  updateOpen: boolean;
  onUpdateOpenChange: (open: boolean) => void;
  merchantsOpen: boolean;
  onMerchantsOpenChange: (open: boolean) => void;
};

const blankMerchant: TreasuryTargetInput = {
  name: '',
  reference: '',
  externalName: '',
  active: true,
  paycashEnabled: false,
};

export function TreasuryPayments({
  sourceId,
  sourceName,
  refreshKey,
  updateOpen,
  onUpdateOpenChange,
  merchantsOpen,
  onMerchantsOpenChange,
}: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState<TreasuryPaymentsDto | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<TreasuryPaymentDto | null>(null);
  const [merchantCount, setMerchantCount] = useState<number | null>(null);
  const [merchantEdit, setMerchantEdit] = useState<{ id?: string; input: TreasuryTargetInput } | null>(null);
  const [merchantSaving, setMerchantSaving] = useState(false);
  const [merchantError, setMerchantError] = useState('');

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
  }, [filters, revision, refreshKey]);

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

  async function exportXlsx() {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (key !== 'page' && value) params.set(key, String(value));
      });
      await api.exportTreasuryPayments(params);
      toast.success('Exportación lista');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo exportar');
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = !!(filters.q || filters.merchant || filters.status || filters.from || filters.to);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const showCard = !!data?.payments.some((p) => cardLabel(p));
  const showWallet = !!data?.payments.some((p) => p.wallet);

  return (
    <section aria-labelledby="payments-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id="payments-title" className="text-lg font-semibold">Ventas Niubiz</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting || loading || !data?.total}
            onClick={() => void exportXlsx()}
          >
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            {exporting ? 'Exportando…' : 'Exportar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onUpdateOpenChange(true)}>
            <RefreshCw className="size-4" aria-hidden="true" /> Actualizar ventas
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMerchantsOpenChange(true)}>
            <Store className="size-4" aria-hidden="true" /> Comercios
          </Button>
        </div>
      </div>

      {data?.lastImport && (
        <p className="text-xs text-muted-foreground">
          Última actualización: {date(data.lastImport.createdAt)} · {data.lastImport.rowCount} operaciones
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
                <option key={m.targetId} value={m.merchantCode}>
                  {m.alias} · {m.merchantCode}
                </option>
              ))}
            </select>
          </label>
          <TreasuryStatusFilter
            id="niubiz-sales-status"
            value={filters.status}
            states={data?.states ?? []}
            onChange={(value) => filter('status', value)}
          />
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
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comercio</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Código de transacción</TableHead>
                    <TableHead>Edu</TableHead>
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
                        <span className="block font-medium">{p.merchantAlias || p.merchantName || dash}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{p.merchantCode}</span>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate tabular-nums">{p.orderNumber}</TableCell>
                      <TableCell className="max-w-[14rem]">
                        <CopyableValue value={p.transactionCode} label="Código de transacción" />
                      </TableCell>
                      <TableCell className="w-10">
                        {p.educationLink ? (
                          <span
                            className="inline-flex text-emerald-700 dark:text-emerald-300"
                            title={`Educación · ciclo #${p.educationLink.waCycleId} · ${p.educationLink.status}`}
                            aria-label={`Vinculado a Educación, ciclo ${p.educationLink.waCycleId}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link2 className="size-4" aria-hidden />
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{dash}</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">
                        {p.customerName || dash}
                      </TableCell>
                      <TableCell className="max-w-[14rem] truncate">{p.customerEmail || dash}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {p.currency} {p.amount}
                      </TableCell>
                      <TableCell>
                        <TreasuryStatusBadge status={p.status} />
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
            </TableShell>
          )}

          {data.total > 0 ? (
            <Pagination
              page={data.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              summary={`${data.total} en total`}
              showWhenSinglePage
            />
          ) : null}
        </>
      ) : null}

      <NiubizUpdateDialog
        open={updateOpen}
        onOpenChange={onUpdateOpenChange}
        onUpdated={() => {
          setSearch('');
          setFilters({ ...emptyFilters });
          setRevision((v) => v + 1);
        }}
      />

      <Dialog
        open={merchantsOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMerchantEdit(null);
            setMerchantError('');
          }
          onMerchantsOpenChange(open);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comercios Niubiz</DialogTitle>
            <DialogDescription>
              Catálogo de códigos de comercio:{' '}
              {merchantCount ?? data?.merchants.filter((m) => m.active).length ?? '…'} activos.
              Desactiva para omitir su sincronización con Niubiz o PagoEfectivo.
            </DialogDescription>
          </DialogHeader>
          {isAdmin && !merchantEdit && (
            <Button
              size="sm"
              className="self-start"
              onClick={() => {
                setMerchantError('');
                setMerchantEdit({ input: { ...blankMerchant } });
              }}
            >
              <Plus className="size-4" /> Añadir comercio
            </Button>
          )}
          {merchantEdit ? (
            <form
              className="grid gap-3"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                if (merchantSaving) return;
                setMerchantSaving(true);
                setMerchantError('');
                  void api
                  .saveTreasuryTarget(sourceId, {
                    name: merchantEdit.input.name,
                    reference: merchantEdit.input.reference,
                    active: merchantEdit.input.active,
                    paycashEnabled: merchantEdit.input.paycashEnabled,
                    currency: null,
                  }, merchantEdit.id)
                  .then(() => {
                    toast.success(merchantEdit.id ? 'Comercio actualizado' : 'Comercio creado');
                    setMerchantEdit(null);
                    setRevision((v) => v + 1);
                  })
                  .catch((err) => setMerchantError(err instanceof Error ? err.message : 'No se pudo guardar.'))
                  .finally(() => setMerchantSaving(false));
              }}
            >
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Alias MALI ONE</span>
                <Input
                  required
                  maxLength={120}
                  value={merchantEdit.input.name}
                  onChange={(e) => setMerchantEdit({ ...merchantEdit, input: { ...merchantEdit.input, name: e.target.value } })}
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Código Niubiz</span>
                <Input
                  required
                  maxLength={9}
                  pattern="\d{9}"
                  disabled={!!merchantEdit.id}
                  value={merchantEdit.input.reference}
                  onChange={(e) => setMerchantEdit({ ...merchantEdit, input: { ...merchantEdit.input, reference: e.target.value } })}
                />
              </label>
              <p className="text-sm text-muted-foreground">
                Nombre en Niubiz:{' '}
                {merchantEdit.input.externalName?.trim() || 'Por sincronizar'}
              </p>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="merchant-active" className="text-sm">Sincronizar con Ventas Niubiz</label>
                <Switch
                  id="merchant-active"
                  checked={merchantEdit.input.active}
                  onCheckedChange={(active) => setMerchantEdit({ ...merchantEdit, input: { ...merchantEdit.input, active } })}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="merchant-paycash" className="text-sm">Sincronizar con PagoEfectivo</label>
                <Switch
                  id="merchant-paycash"
                  checked={!!merchantEdit.input.paycashEnabled}
                  onCheckedChange={(paycashEnabled) => setMerchantEdit({ ...merchantEdit, input: { ...merchantEdit.input, paycashEnabled } })}
                />
              </div>
              {merchantError && <p role="alert" className="text-sm text-destructive">{merchantError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={merchantSaving}>{merchantSaving ? 'Guardando…' : 'Guardar'}</Button>
                <Button type="button" variant="ghost" disabled={merchantSaving} onClick={() => setMerchantEdit(null)}>Cancelar</Button>
              </div>
            </form>
          ) : !data?.merchants.length ? (
            <p className="text-sm text-muted-foreground">Todavía no hay comercios en el catálogo.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {data.merchants.map((m) => (
                <li key={m.targetId} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <span className="block font-medium">{m.alias}</span>
                    <span className="tabular-nums text-muted-foreground">{m.merchantCode}</span>
                    {m.merchantName ? <span className="block text-xs text-muted-foreground">{m.merchantName}</span> : null}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {m.active ? 'Sincronizando ventas' : 'Desactivado'}
                      {m.paycashEnabled ? ' · PagoEfectivo' : ''}
                    </span>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Editar ${m.alias}`}
                      onClick={() => {
                        setMerchantError('');
                        setMerchantEdit({
                          id: m.targetId,
                          input: {
                            name: m.alias,
                            reference: m.merchantCode,
                            externalName: m.merchantName,
                            active: m.active,
                            paycashEnabled: m.paycashEnabled,
                          },
                        });
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
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
                value={[detail.merchantAlias, detail.merchantCode, detail.merchantName].filter(Boolean).join(' · ')}
              />
              <DetailRow label="Pedido" value={detail.orderNumber} copyable />
              <DetailRow label="Código de transacción" value={detail.transactionCode} mono copyable />
              <DetailRow
                label="CRM Educación"
                value={
                  detail.educationLink
                    ? `Vinculado · ciclo #${detail.educationLink.waCycleId} · ${detail.educationLink.status}`
                    : dash
                }
              />
              <DetailRow label="Cliente" value={detail.customerName || dash} />
              <DetailRow label="Email" value={detail.customerEmail || dash} />

              <DetailRow label="Importe" value={`${detail.currency} ${detail.amount}`} />
              <div className="grid gap-1 border-b border-border pb-2">
                <dt className="text-xs font-medium uppercase text-muted-foreground">Estado</dt>
                <dd><TreasuryStatusBadge status={detail.status} /></dd>
              </div>
              {detail.settledOn && (
                <DetailRow label="Liquidación" value={dateOnly(detail.settledOn)} />
              )}
              {(cardLabel(detail) || detail.wallet) && (
                <>
                  <DetailRow label="Tarjeta" value={cardLabel(detail) || dash} />
                  <DetailRow label="Billetera" value={detail.wallet || dash} />
                </>
              )}
              {detail.payload && <PayloadRecord payload={detail.payload} />}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PayloadRecord({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium uppercase text-muted-foreground">Registro del portal</dt>
      <dd>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </dd>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border pb-2 last:border-0">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className={mono && !copyable ? 'break-all font-mono text-xs' : 'break-words'}>
        {copyable ? <CopyableValue value={value} label={label} mono={Boolean(mono)} /> : value}
      </dd>
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
          : 'Todavía no hay pagos guardados. Actualiza desde Niubiz.'}
      </p>
      {!hasFilters && (
        <Button className="mt-4" variant="outline" onClick={onUpdate}>
          Actualizar pagos
        </Button>
      )}
    </div>
  );
}
