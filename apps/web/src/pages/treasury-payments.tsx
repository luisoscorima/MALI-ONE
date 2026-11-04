import { useEffect, useState } from 'react';
import type { TreasuryPaymentsDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { Badge, Button, Card, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { Spinner } from '@/components/feedback';
import { NiubizSync } from './niubiz-sync';

const date = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));

const emptyFilters = { q: '', merchant: '', status: '', from: '', to: '', page: 1 };
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

type Props = {
  sourceName: string;
};

export function TreasuryPayments({ sourceName }: Props) {
  const [data, setData] = useState<TreasuryPaymentsDto | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [result, setResult] = useState('');

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

  function filter(key: 'merchant' | 'status' | 'from' | 'to', value: string) {
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  }

  async function importFile() {
    if (!file || importing) return;
    setImporting(true);
    setImportError('');
    setResult('');
    try {
      const r = await api.importNiubizPayments(file);
      setResult(
        `${r.rows} operaciones: ${r.createdCount} nuevas, ${r.updatedCount} actualizadas y ${r.unchangedCount} sin cambios.`,
      );
      setSearch('');
      setFilters({ ...emptyFilters });
      setRevision((v) => v + 1);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'No se pudo importar.');
    } finally {
      setImporting(false);
    }
  }

  const hasFilters = !!(filters.q || filters.merchant || filters.status || filters.from || filters.to);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section aria-labelledby="payments-title" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase text-muted-foreground">Registros</p>
        <h2 id="payments-title" className="text-balance text-xl font-semibold">
          {sourceName}
        </h2>
        <p className="text-pretty text-sm text-muted-foreground">
          Operaciones guardadas · Horario de Lima
        </p>
      </div>

      <NiubizSync onUpdated={() => setRevision((v) => v + 1)} />

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
              placeholder="Pedido, código de transacción o nombre del cliente"
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
            <EmptyPayments hasFilters={hasFilters} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comercio / pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">{date(p.transactedAt)}</TableCell>
                      <TableCell>
                        <span className="block font-medium">
                          {p.merchantCode} · {p.orderNumber}
                        </span>
                        <span className="text-xs text-muted-foreground">Transacción {p.transactionCode}</span>
                      </TableCell>
                      <TableCell className="max-w-[16rem] truncate">
                        {p.customerName || 'Sin nombre informado'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {p.currency} {p.amount}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.status}</Badge>
                      </TableCell>
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

      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Importación alternativa desde archivo</summary>
        <Card className="mt-3 gap-3 border-0 bg-transparent p-0 shadow-none">
          <p className="text-pretty text-sm text-muted-foreground">
            Para una recuperación manual, importa el Excel original de Niubiz. Los estados se actualizarán según ese
            archivo.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-0 flex-1 gap-1.5 text-sm">
              <span className="font-medium">Archivo XLSX (hasta 5 MB)</span>
              <Input
                type="file"
                accept=".xlsx"
                disabled={importing}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setResult('');
                  setImportError('');
                }}
              />
            </label>
            <Button disabled={!file || importing} onClick={() => void importFile()}>
              {importing ? 'Importando…' : 'Importar pagos'}
            </Button>
          </div>
          {result && (
            <p role="status" className="text-sm">
              {result}
            </p>
          )}
          {importError && (
            <p role="alert" className="text-sm text-destructive">
              {importError}
            </p>
          )}
        </Card>
      </details>
    </section>
  );
}

function EmptyPayments({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-pretty text-sm text-muted-foreground">
        {hasFilters
          ? 'No hay pagos para estos filtros.'
          : 'Todavía no hay pagos guardados. Inicia una sincronización con Niubiz.'}
      </p>
    </div>
  );
}
