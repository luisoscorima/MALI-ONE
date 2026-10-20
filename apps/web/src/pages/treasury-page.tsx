import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Landmark, Pencil, Plus } from 'lucide-react';
import type {
  TreasuryCurrency, TreasuryOverviewDto, TreasuryProvider, TreasurySourceDto,
  TreasurySourceInput, TreasuryTargetDto, TreasuryTargetInput,
} from '@mali-one/shared';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { EmptyState, Spinner } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';

const blankSource: TreasurySourceInput = { provider: 'niubiz_sales', name: '', legalEntity: '', active: true };
const blankTarget: TreasuryTargetInput = { name: '', reference: '', currency: 'PEN', active: true };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación';

export function TreasuryPage() {
  const toast = useToast();
  const [data, setData] = useState<TreasuryOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [sourceEdit, setSourceEdit] = useState<{ id?: string; input: TreasurySourceInput } | null>(null);
  const [targetEdit, setTargetEdit] = useState<{ id?: string; sourceId: string; input: TreasuryTargetInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const overview = await api.treasuryOverview();
      setData(overview);
      setSelectedId((current) => overview.sources.some((source) => source.id === current)
        ? current : overview.sources[0]?.id ?? '');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = data?.sources.find((source) => source.id === selectedId);
  const provider = data?.providers.find((item) => item.id === selected?.provider);
  const targetLabel = provider?.targetKind === 'bank_account' ? 'cuenta bancaria' : 'comercio';

  function openSource(source?: TreasurySourceDto) {
    setFormError('');
    setSourceEdit(source ? { id: source.id, input: {
      provider: source.provider, name: source.name, legalEntity: source.legalEntity, active: source.active,
    } } : { input: { ...blankSource } });
  }

  function openTarget(target?: TreasuryTargetDto) {
    if (!selected) return;
    setFormError('');
    setTargetEdit({ sourceId: selected.id, id: target?.id, input: target ? {
      name: target.name, reference: target.reference, currency: target.currency, active: target.active,
    } : { ...blankTarget } });
  }

  async function saveSource(event: FormEvent) {
    event.preventDefault();
    if (!sourceEdit || saving) return;
    setSaving(true);
    setFormError('');
    try {
      const result = await api.saveTreasurySource(sourceEdit.input, sourceEdit.id);
      setSourceEdit(null);
      setSelectedId(result.id);
      toast.success('Fuente guardada');
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally { setSaving(false); }
  }

  async function saveTarget(event: FormEvent) {
    event.preventDefault();
    if (!targetEdit || saving) return;
    setSaving(true);
    setFormError('');
    try {
      await api.saveTreasuryTarget(targetEdit.sourceId, targetEdit.input, targetEdit.id);
      setTargetEdit(null);
      toast.success('Registro guardado');
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tesorería y conciliación" description="Entidades, cuentas y comercios para seguir los cobros hasta su abono bancario." />
      <Card className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium"><Landmark className="size-5" /> Preparación de fuentes</div>
          <Badge variant="secondary">Conexiones pendientes</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Registra las fuentes que revisa contabilidad y sus cuentas o comercios. La actualización prevista es cada hora, con horario de Lima.
          La descarga automática y la conciliación todavía no están habilitadas.
        </p>
        <div className="grid gap-3 border-t pt-3 text-sm md:grid-cols-3">
          <div><strong>Cobros</strong><p className="text-muted-foreground">Ventas y pagos del cliente.</p></div>
          <div><strong>Liquidaciones</strong><p className="text-muted-foreground">Agrupaciones, comisiones y neto.</p></div>
          <div><strong>Abonos bancarios</strong><p className="text-muted-foreground">Ingreso confirmado en la cuenta.</p></div>
        </div>
      </Card>

      {loading ? <div role="status" className="flex items-center gap-2"><Spinner /> Cargando fuentes…</div> : error ? (
        <Card><p role="alert">No se pudieron cargar las fuentes: {error}</p><Button variant="outline" onClick={() => void load()}>Reintentar</Button></Card>
      ) : data && (
        <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="flex flex-col gap-3" aria-label="Fuentes registradas">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Fuentes ({data.sources.length})</h2>
              <Button size="sm" onClick={() => openSource()}><Plus className="size-4" /> Añadir fuente</Button>
            </div>
            {data.sources.length === 0 ? (
              <Card><p className="text-sm text-muted-foreground">Empieza registrando una fuente, por ejemplo Niubiz · Comercio, y luego sus códigos de comercio.</p></Card>
            ) : data.sources.map((source) => (
              <button key={source.id} type="button" aria-pressed={source.id === selectedId} onClick={() => setSelectedId(source.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${source.id === selectedId ? 'border-primary bg-accent' : 'border-border hover:bg-muted/50'}`}>
                <span className="block break-words font-medium">{source.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{data.providers.find((item) => item.id === source.provider)?.label}</span>
                <span className="mt-2 block text-xs text-muted-foreground">{source.targets.length} registros · {source.active ? 'En preparación' : 'Archivada'}</span>
              </button>
            ))}
          </section>
          {selected && (
            <Card className="min-w-0 gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold">{selected.name}</h2>
                  <p className="break-words text-sm text-muted-foreground">{selected.legalEntity}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{provider?.scope} · Frecuencia prevista: {selected.syncIntervalMinutes} min</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openSource(selected)}><Pencil className="size-4" /> Editar fuente</Button>
              </div>
              {!selected.active && <p className="text-sm text-muted-foreground">Fuente archivada. Sus registros se conservan y quedarán excluidos de futuras sincronizaciones.</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <h3 className="font-medium">{provider?.targetKind === 'bank_account' ? 'Cuentas bancarias' : 'Comercios'}</h3>
                <Button variant="outline" size="sm" disabled={!selected.active} onClick={() => openTarget()}><Plus className="size-4" /> Añadir {targetLabel}</Button>
              </div>
              {selected.targets.length === 0 ? (
                <EmptyState title={`Sin ${provider?.targetKind === 'bank_account' ? 'cuentas' : 'comercios'} registrados`} description="Añade los registros que se consultarán en esta fuente. Puedes registrar una referencia por cada moneda." />
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nombre / referencia</TableHead><TableHead>Moneda</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader>
                  <TableBody>{selected.targets.map((target) => (
                    <TableRow key={target.id}>
                      <TableCell><span className="block font-medium">{target.name}</span><span className="font-mono text-xs text-muted-foreground">{target.reference}</span></TableCell>
                      <TableCell>{target.currency}</TableCell>
                      <TableCell>{!selected.active ? 'Fuente archivada' : target.active ? 'En preparación' : 'Archivado'}</TableCell>
                      <TableCell><Button variant="ghost" size="sm" onClick={() => openTarget(target)} aria-label={`Editar ${target.name}`}><Pencil className="size-4" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </Card>
          )}
        </div>
      )}

      <Dialog open={sourceEdit !== null} onOpenChange={(open) => { if (!open && !saving) setSourceEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{sourceEdit?.id ? 'Editar fuente' : 'Añadir fuente'}</DialogTitle><DialogDescription>Una fuente identifica un acceso a un portal. Las credenciales se configurarán al conectar la entidad.</DialogDescription></DialogHeader>
          {sourceEdit && <form onSubmit={saveSource}><fieldset disabled={saving} className="grid gap-4">
            <div className="grid gap-2"><label htmlFor="treasury-provider" className="text-sm font-medium">Entidad y portal</label>
              <Select value={sourceEdit.input.provider} disabled={!!sourceEdit.id || saving} onValueChange={(provider) => setSourceEdit({ ...sourceEdit, input: { ...sourceEdit.input, provider: provider as TreasuryProvider } })}>
                <SelectTrigger id="treasury-provider"><SelectValue /></SelectTrigger><SelectContent>{data?.providers.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="grid gap-2 text-sm font-medium">Nombre del acceso<Input required maxLength={120} placeholder="Ej. Niubiz principal" value={sourceEdit.input.name} onChange={(e) => setSourceEdit({ ...sourceEdit, input: { ...sourceEdit.input, name: e.target.value } })} /></label>
            <label className="grid gap-2 text-sm font-medium">Titular / razón social<Input required maxLength={160} value={sourceEdit.input.legalEntity} onChange={(e) => setSourceEdit({ ...sourceEdit, input: { ...sourceEdit.input, legalEntity: e.target.value } })} /></label>
            <div className="flex items-center justify-between"><label htmlFor="treasury-source-active" className="text-sm">Incluir en la preparación</label><Switch id="treasury-source-active" checked={sourceEdit.input.active} onCheckedChange={(active) => setSourceEdit({ ...sourceEdit, input: { ...sourceEdit.input, active } })} /></div>
            <p className="text-xs text-muted-foreground">Frecuencia prevista: cada hora. Guardar esta fuente no inicia conexiones.</p>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit">{saving ? 'Guardando…' : 'Guardar fuente'}</Button>
          </fieldset></form>}
        </DialogContent>
      </Dialog>

      <Dialog open={targetEdit !== null} onOpenChange={(open) => { if (!open && !saving) setTargetEdit(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{targetEdit?.id ? 'Editar' : 'Añadir'} {targetLabel}</DialogTitle><DialogDescription>Registra el identificador que utiliza la entidad y su moneda.</DialogDescription></DialogHeader>
          {targetEdit && <form onSubmit={saveTarget}><fieldset disabled={saving} className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium">Nombre<Input required maxLength={120} placeholder="Ej. Tienda del museo" value={targetEdit.input.name} onChange={(e) => setTargetEdit({ ...targetEdit, input: { ...targetEdit.input, name: e.target.value } })} /></label>
            <label className="grid gap-2 text-sm font-medium">{provider?.targetKind === 'bank_account' ? 'Referencia de cuenta' : 'Código o identificador del comercio'}<Input required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,63}" autoComplete="off" value={targetEdit.input.reference} onChange={(e) => setTargetEdit({ ...targetEdit, input: { ...targetEdit.input, reference: e.target.value } })} /></label>
            <p className="text-xs text-muted-foreground">Sin espacios. Se conservan los ceros iniciales.</p>
            <div className="grid gap-2"><label htmlFor="treasury-currency" className="text-sm font-medium">Moneda</label><Select value={targetEdit.input.currency} disabled={saving} onValueChange={(currency) => setTargetEdit({ ...targetEdit, input: { ...targetEdit.input, currency: currency as TreasuryCurrency } })}><SelectTrigger id="treasury-currency"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PEN">PEN · Soles</SelectItem><SelectItem value="USD">USD · Dólares</SelectItem></SelectContent></Select></div>
            <div className="flex items-center justify-between"><label htmlFor="treasury-target-active" className="text-sm">Incluir en la preparación</label><Switch id="treasury-target-active" checked={targetEdit.input.active} onCheckedChange={(active) => setTargetEdit({ ...targetEdit, input: { ...targetEdit.input, active } })} /></div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit">{saving ? 'Guardando…' : 'Guardar registro'}</Button>
          </fieldset></form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
