import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileArchive,
  Loader2,
  Search,
  Upload,
} from 'lucide-react';
import type {
  MalichimpContactDto,
  MalichimpContactStatus,
  MalichimpImportJobDto,
  MalichimpImportPreviewDto,
  MalichimpStatsDto,
  MalichimpTagDto,
} from '@mali-one/shared';
import { AlertBanner, PageLoading } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

const nf = new Intl.NumberFormat('es-PE');

const statusMeta: Record<
  MalichimpContactStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  subscribed: { label: 'Suscrito', variant: 'default' },
  unsubscribed: { label: 'Dado de baja', variant: 'secondary' },
  cleaned: { label: 'Limpiado', variant: 'destructive' },
  nonsubscribed: { label: 'Sin suscripción', variant: 'outline' },
};

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{nf.format(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function MalichimpPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<MalichimpStatsDto | null>(null);
  const [tags, setTags] = useState<MalichimpTagDto[]>([]);
  const [contacts, setContacts] = useState<MalichimpContactDto[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<'all' | MalichimpContactStatus>('all');
  const [tag, setTag] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] =
    useState<MalichimpImportPreviewDto | null>(null);
  const [importJob, setImportJob] = useState<MalichimpImportJobDto | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(1), [debouncedQuery, status, tag]);

  const loadContacts = useCallback(async () => {
    const result = await api.listMalichimpContacts({
      q: debouncedQuery || undefined,
      status: status === 'all' ? undefined : status,
      tag: tag === 'all' ? undefined : tag,
      page,
      pageSize: 50,
    });
    setContacts(result.items);
    setTotal(result.total);
    setPages(result.pages);
  }, [debouncedQuery, page, status, tag]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.getMalichimpStats(), api.listMalichimpTags(), loadContacts()])
      .then(([nextStats, nextTags]) => {
        if (!active) return;
        setStats(nextStats);
        setTags(nextTags);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar MALICHIMP');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadContacts, refreshKey]);

  useEffect(() => {
    if (!importJob || !['queued', 'running'].includes(importJob.status)) return;
    const timer = window.setTimeout(() => {
      void api.getMalichimpImportJob(importJob.id)
        .then((next) => {
          setImportJob(next);
          if (next.status === 'completed') {
            toast.success(`Importación completada: ${nf.format(next.processed)} contactos`);
            setRefreshKey((value) => value + 1);
          } else if (next.status === 'failed') {
            setImportError(next.error || 'La importación falló');
          }
        })
        .catch((reason: unknown) => {
          setImportError(reason instanceof Error ? reason.message : 'No se pudo consultar la importación');
        });
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [importJob, toast]);

  function openImport() {
    if (importJob && ['queued', 'running'].includes(importJob.status)) {
      setImportOpen(true);
      return;
    }
    setZipFile(null);
    setImportPreview(null);
    setImportJob(null);
    setImportError('');
    setImportOpen(true);
  }

  function selectZip(file: File | null) {
    setImportPreview(null);
    setImportJob(null);
    setImportError('');
    if (!file) {
      setZipFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setZipFile(null);
      setImportError('Selecciona el ZIP completo exportado por Mailchimp.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setZipFile(null);
      setImportError('El ZIP supera el límite de 100 MB.');
      return;
    }
    setZipFile(file);
  }

  async function previewImport() {
    if (!zipFile) return;
    setImportBusy(true);
    setImportError('');
    try {
      setImportPreview(await api.previewMalichimpImport(zipFile));
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : 'No se pudo validar el ZIP');
    } finally {
      setImportBusy(false);
    }
  }

  async function applyImport() {
    if (!importPreview) return;
    setImportBusy(true);
    setImportError('');
    try {
      setImportJob(await api.applyMalichimpImport(importPreview.previewId));
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : 'No se pudo iniciar la importación');
    } finally {
      setImportBusy(false);
    }
  }

  if (loading && !stats) return <PageLoading variant="table" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="MALICHIMP"
        description="Audiencia de correo separada del CRM de WhatsApp. Solo los contactos suscritos serán elegibles para boletines."
        actions={user?.role === 'admin' ? (
          <Button type="button" onClick={openImport}>
            <Upload className="mr-1 size-4" />
            Importar ZIP de Mailchimp
          </Button>
        ) : undefined}
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      {stats && !stats.delivery.configured ? (
        <AlertBanner variant="info">
          La audiencia está lista, pero el motor SES compartido aún no tiene credenciales en este entorno. No se habilitarán envíos.
        </AlertBanner>
      ) : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Elegibles" value={stats.eligible} hint="Suscritos con consentimiento" />
          <StatCard label="Total importado" value={stats.total} hint="Todos los estados de Mailchimp" />
          <StatCard label="Suprimidos" value={stats.suppressions} hint="Bajas y correos limpiados" />
          <StatCard
            label="Etiquetas"
            value={stats.tags}
            hint={`Segmentación recuperada · SES ${stats.delivery.configured ? 'configurado' : 'pendiente'}`}
          />
        </div>
      ) : null}

      <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 md:grid-cols-[minmax(240px,1fr)_200px_240px]">
          <label className="relative block">
            <span className="sr-only">Buscar contacto</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por correo, nombre o institución"
              className="pl-9"
            />
          </label>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(statusMeta).map(([value, meta]) => (
                <SelectItem key={value} value={value}>{meta.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger aria-label="Filtrar por etiqueta"><SelectValue placeholder="Todas las etiquetas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etiquetas</SelectItem>
              {tags.map((item) => (
                <SelectItem key={item.id} value={item.normalizedName}>
                  {item.name}{item.contacts !== undefined ? ` (${nf.format(item.contacts)})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead>Institución</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Etiquetas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length ? contacts.map((contact) => {
                const meta = statusMeta[contact.status];
                const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="min-w-60">
                      <p className="font-medium">{name || 'Sin nombre'}</p>
                      <p className="text-xs text-muted-foreground">{contact.email}</p>
                    </TableCell>
                    <TableCell className="max-w-64 truncate">{contact.institutionName || '—'}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    <TableCell className="min-w-56">
                      <div className="flex max-w-md flex-wrap gap-1">
                        {contact.tags.slice(0, 3).map((item) => (
                          <Badge key={item.id} variant="outline">{item.name}</Badge>
                        ))}
                        {contact.tags.length > 3 ? <Badge variant="secondary">+{contact.tags.length - 3}</Badge> : null}
                        {!contact.tags.length ? <span className="text-muted-foreground">—</span> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">No hay contactos con estos filtros.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 text-sm">
          <span className="text-muted-foreground">{nf.format(total)} resultado{total === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">Página {page} de {pages}</span>
            <Button size="icon" variant="outline" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Página siguiente" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog
        open={importOpen}
        onOpenChange={setImportOpen}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar ZIP de Mailchimp</DialogTitle>
            <DialogDescription>
              Primero validaremos el archivo. PostgreSQL no se modificará hasta que confirmes el resumen.
            </DialogDescription>
          </DialogHeader>

          {importError ? <AlertBanner>{importError}</AlertBanner> : null}

          {!importPreview && !importJob ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-5">
                <div className="flex items-start gap-3">
                  <FileArchive className="mt-0.5 size-6 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="malichimp-zip">ZIP completo de Mailchimp</Label>
                    <Input
                      id="malichimp-zip"
                      type="file"
                      accept=".zip,application/zip"
                      onChange={(event) => selectZip(event.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Debe contener los CSV subscribed, unsubscribed, cleaned y nonsubscribed. Máximo 100 MB.
                    </p>
                  </div>
                </div>
              </div>
              {zipFile ? (
                <p className="text-sm">
                  Seleccionado: <span className="font-medium">{zipFile.name}</span>{' '}
                  <span className="text-muted-foreground">({(zipFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                </p>
              ) : null}
            </div>
          ) : null}

          {importPreview && !importJob ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total" value={importPreview.report.totalUnique} hint="Contactos únicos" />
                <StatCard label="Elegibles" value={importPreview.report.eligibleContacts} hint="Suscritos" />
                <StatCard label="Suprimidos" value={importPreview.report.suppressions} hint="Bajas y limpiados" />
                <StatCard label="Etiquetas" value={importPreview.report.tags} hint="Segmentos" />
              </div>
              {importPreview.previouslyImported ? (
                <AlertBanner variant="info">
                  Este mismo contenido ya fue importado anteriormente. Puedes repetirlo sin duplicar contactos.
                </AlertBanner>
              ) : null}
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p className="font-medium">Al confirmar:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Se crearán o actualizarán los contactos del ZIP.</li>
                  <li>Las bajas y direcciones limpiadas permanecerán suprimidas.</li>
                  <li>El ZIP temporal será eliminado al terminar.</li>
                </ul>
              </div>
            </div>
          ) : null}

          {importJob ? (
            <div className="space-y-4" aria-live="polite">
              {importJob.status === 'completed' ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
                  <div>
                    <p className="font-medium">Importación completada</p>
                    <p className="text-sm text-muted-foreground">{nf.format(importJob.processed)} contactos procesados.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      Importando contactos…
                    </span>
                    <span className="tabular-nums">{importJob.progress}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={importJob.progress}
                    aria-label="Progreso de importación"
                  >
                    <div
                      className="h-full origin-left bg-primary transition-transform duration-300 motion-reduce:transition-none"
                      style={{ transform: `scaleX(${importJob.progress / 100})` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {nf.format(importJob.processed)} de {nf.format(importJob.total)}. Puedes cerrar esta ventana; el proceso continuará.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            {!importPreview && !importJob ? (
              <Button type="button" onClick={() => void previewImport()} disabled={!zipFile || importBusy}>
                {importBusy ? <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" /> : null}
                {importBusy ? 'Validando…' : 'Validar ZIP'}
              </Button>
            ) : null}
            {importPreview && !importJob ? (
              <>
                <Button type="button" variant="outline" onClick={() => { setImportPreview(null); setZipFile(null); }} disabled={importBusy}>
                  Elegir otro ZIP
                </Button>
                <Button type="button" onClick={() => void applyImport()} disabled={importBusy}>
                  {importBusy ? <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" /> : null}
                  Importar {nf.format(importPreview.report.totalUnique)} contactos
                </Button>
              </>
            ) : null}
            {importJob?.status === 'completed' || importJob?.status === 'failed' ? (
              <Button type="button" onClick={() => setImportOpen(false)}>Cerrar</Button>
            ) : null}
            {importJob && ['queued', 'running'].includes(importJob.status) ? (
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                Seguir en segundo plano
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
