import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, PackageSearch, RefreshCw } from 'lucide-react';
import type {
  BsaleKardexMovementDto,
  BsaleKardexResultDto,
  BsaleOfficeDto,
} from '@mali-one/shared';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
import { downloadKardexXlsx } from '@/lib/bsale-kardex-export';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

const PREVIEW_PAGE_SIZE = 50;
const KARDEX_POLL_MS = 2_000;
const KARDEX_MAX_WAIT_MS = 15 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultFrom(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

const MOVEMENT_LABELS: Record<BsaleKardexMovementDto['movementType'], string> = {
  opening: 'Saldo inicial',
  document: 'Documento',
  transfer: 'Traslado',
  reception: 'Recepción',
  consumption: 'Consumo',
  ending: 'Saldo final',
  omission: 'Por omisión',
};

export function BsaleKardexPage() {
  const toast = useToast();
  const [offices, setOffices] = useState<BsaleOfficeDto[]>([]);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<number[]>([]);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [includeOpening, setIncludeOpening] = useState(true);
  const [includeEnding, setIncludeEnding] = useState(true);
  const [includeTransfer, setIncludeTransfer] = useState(true);
  const [forceOmission, setForceOmission] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [loadingKardex, setLoadingKardex] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BsaleKardexResultDto | null>(null);
  const [resultQueryKey, setResultQueryKey] = useState('');
  const [page, setPage] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const loadOffices = useCallback(async () => {
    setLoadingOffices(true);
    setError('');
    try {
      const data = await api.getBsaleOffices();
      setOffices(data);
      setSelectedOfficeIds(data.map((o) => o.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar almacenes';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingOffices(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadOffices();
  }, [loadOffices]);

  const toggleOffice = (id: number) => {
    setSelectedOfficeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAllOffices = () => {
    setSelectedOfficeIds((prev) =>
      prev.length === offices.length ? [] : offices.map((o) => o.id),
    );
  };

  const queryBody = useMemo(
    () => ({
      from,
      to,
      officeIds: selectedOfficeIds,
      includeOpening,
      includeEnding,
      includeTransfer,
      forceOmission,
    }),
    [
      from,
      to,
      selectedOfficeIds,
      includeOpening,
      includeEnding,
      includeTransfer,
      forceOmission,
    ],
  );

  const queryKey = useMemo(() => {
    const offices = [...selectedOfficeIds].sort((a, b) => a - b).join(',');
    return [
      from,
      to,
      offices,
      includeOpening ? '1' : '0',
      includeEnding ? '1' : '0',
      includeTransfer ? '1' : '0',
      forceOmission ? '1' : '0',
    ].join('|');
  }, [
    from,
    to,
    selectedOfficeIds,
    includeOpening,
    includeEnding,
    includeTransfer,
    forceOmission,
  ]);

  const runPreview = async (refresh = false) => {
    if (selectedOfficeIds.length === 0) {
      toast.error('Selecciona al menos un almacén.');
      return;
    }
    setLoadingKardex(true);
    setError('');
    setPage(0);
    setElapsedSec(0);
    try {
      const deadline = Date.now() + KARDEX_MAX_WAIT_MS;
      let sendRefresh = refresh;
      while (true) {
        const job = await api.getBsaleKardex({
          ...queryBody,
          refresh: sendRefresh || undefined,
        });
        sendRefresh = false;
        if (job.status === 'ready') {
          setResult(job.data);
          setResultQueryKey(queryKey);
          toast.success(
            refresh
              ? `${job.data.totalMovements} movimientos actualizados desde Bsale`
              : `${job.data.totalMovements} movimientos consolidados`,
          );
          return;
        }
        if (job.status === 'error') {
          throw new Error(job.message);
        }
        setElapsedSec(
          Math.max(1, Math.round((Date.now() - job.startedAt) / 1000)),
        );
        if (Date.now() >= deadline) {
          throw new Error(
            'La consulta supera el tiempo máximo de espera. Intenta de nuevo en unos minutos.',
          );
        }
        await sleep(KARDEX_POLL_MS);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al consultar Kardex';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingKardex(false);
    }
  };

  const runExport = async () => {
    if (selectedOfficeIds.length === 0) {
      toast.error('Selecciona al menos un almacén.');
      return;
    }
    setExporting(true);
    setError('');
    try {
      // Si ya hay vista previa del mismo filtro, exporta en el navegador (evita 504).
      if (result && resultQueryKey === queryKey) {
        downloadKardexXlsx(result.movements, from, to);
        toast.success('Kardex exportado (XLSX)');
        return;
      }
      await api.exportBsaleKardex({ ...queryBody, format: 'xlsx' });
      toast.success('Kardex exportado (XLSX)');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al exportar';
      setError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const pageCount = result
    ? Math.max(1, Math.ceil(result.movements.length / PREVIEW_PAGE_SIZE))
    : 1;
  const pageRows = result
    ? result.movements.slice(
        page * PREVIEW_PAGE_SIZE,
        (page + 1) * PREVIEW_PAGE_SIZE,
      )
    : [];

  return (
    <div>
      <PageHeader
        title="Kardex Bsale"
        description="Consolida entradas y salidas de stock por almacén. Vista previa usa caché (~10 min); usa «Actualizar desde Bsale» si corregiste datos allá y quieres verlos aquí."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadOffices()}
            disabled={loadingOffices}
          >
            <RefreshCw className="size-4" />
            Recargar almacenes
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <AlertBanner variant="error">{error}</AlertBanner>
        </div>
      )}

      <div className="mb-6 space-y-4 rounded-lg border border-border p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="kardex-from">Desde</Label>
            <Input
              id="kardex-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kardex-to">Hasta</Label>
            <Input
              id="kardex-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label>Almacenes</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleAllOffices}
              disabled={loadingOffices || offices.length === 0}
            >
              {selectedOfficeIds.length === offices.length
                ? 'Deseleccionar todos'
                : 'Seleccionar todos'}
            </Button>
          </div>
          {loadingOffices ? (
            <p className="text-sm text-muted">Cargando almacenes desde Bsale…</p>
          ) : offices.length === 0 ? (
            <p className="text-sm text-muted">No hay almacenes activos.</p>
          ) : (
            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {offices.map((office) => (
                <label
                  key={office.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selectedOfficeIds.includes(office.id)}
                    onCheckedChange={() => toggleOffice(office.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{office.name}</span>
                    <span className="block text-xs text-muted">
                      ID {office.id}
                      {office.isVirtual ? ' · virtual' : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label className="mb-2 block">Incluir en el kardex</Label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox
                checked={includeOpening}
                onCheckedChange={(v) => setIncludeOpening(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Saldo inicial</span>
                <span className="block text-xs text-muted">opening</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox
                checked={includeEnding}
                onCheckedChange={(v) => setIncludeEnding(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Saldo final</span>
                <span className="block text-xs text-muted">ending</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox
                checked={includeTransfer}
                onCheckedChange={(v) => setIncludeTransfer(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Traslados</span>
                <span className="block text-xs text-muted">
                  etiquetar despachos internos
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox
                checked={forceOmission}
                onCheckedChange={(v) => setForceOmission(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Forzar por omisión</span>
                <span className="block text-xs text-muted">
                  salidas sin recepción pareja
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void runPreview(false)}
            disabled={loadingKardex || exporting}
          >
            {loadingKardex ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PackageSearch className="size-4" />
            )}
            Vista previa
          </Button>
          <Button
            variant="outline"
            onClick={() => void runPreview(true)}
            disabled={loadingKardex || exporting}
            title="Ignora la caché y vuelve a consultar Bsale"
          >
            {loadingKardex ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Actualizar desde Bsale
          </Button>
          <Button
            variant="outline"
            onClick={() => void runExport()}
            disabled={loadingKardex || exporting}
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Exportar Excel
          </Button>
        </div>
      </div>

      {loadingKardex ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Generando kardex desde Bsale
            {elapsedSec > 0 ? ` · ${elapsedSec}s` : ''}
            … Esto puede tardar varios minutos la primera vez.
          </p>
          <TableSkeleton rows={8} cols={8} />
        </div>
      ) : !result ? (
        <EmptyState
          title="Sin consulta aún"
          description="Elige rango y almacenes, luego genera la vista previa o exporta."
        />
      ) : result.movements.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          description="No se encontraron entradas ni salidas en el rango seleccionado."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {result.totalMovements} movimientos · {result.from} → {result.to} ·{' '}
            {result.officeIds.length} almacén(es)
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Salida</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, idx) => (
                  <TableRow
                    key={`${row.movementType}-${row.documentId}-${row.variantId}-${row.date}-${idx}`}
                  >
                    <TableCell className="whitespace-nowrap">
                      {row.dateIso}
                    </TableCell>
                    <TableCell>{row.officeName}</TableCell>
                    <TableCell>
                      {MOVEMENT_LABELS[row.movementType]}
                    </TableCell>
                    <TableCell>
                      <span className="block">{row.documentLabel}</span>
                      <span className="text-xs text-muted">
                        {row.documentNumber}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.sku || '—'}
                    </TableCell>
                    <TableCell>{row.productName || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.entryQty || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.exitQty || '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {row.balanceQty}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted">
                Página {page + 1} de {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
