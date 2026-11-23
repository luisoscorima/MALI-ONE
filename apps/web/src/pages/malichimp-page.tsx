import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileSpreadsheet,
  Loader2,
  Search,
  Send,
  Upload,
  Users,
} from 'lucide-react';
import type {
  EmailSenderDto,
  MalichimpContactDto,
  MalichimpContactStatus,
  MalichimpGroupDto,
  MalichimpImportJobDto,
  MalichimpImportPreviewDto,
  MalichimpStatsDto,
  MalichimpTagDto,
  MalichimpXlsxImportPreviewDto,
  MalichimpXlsxImportResultDto,
} from '@mali-one/shared';
import { AlertBanner, PageLoading } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
import { MalichimpCampaigns } from '@/components/malichimp-campaigns';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

const nf = new Intl.NumberFormat('es-PE');
const dateTimeFormat = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const importJobStorageKey = 'malichimp-import-job-id';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormat.format(date);
}

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

function ContactField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm">{value || '—'}</dd>
    </div>
  );
}

export function MalichimpPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('tab') === 'campaigns' ? 'campaigns' : 'audience';
  const [stats, setStats] = useState<MalichimpStatsDto | null>(null);
  const [groups, setGroups] = useState<MalichimpGroupDto[]>([]);
  const [tags, setTags] = useState<MalichimpTagDto[]>([]);
  const [senders, setSenders] = useState<EmailSenderDto[]>([]);
  const [contacts, setContacts] = useState<MalichimpContactDto[]>([]);
  const [selectedContact, setSelectedContact] = useState<MalichimpContactDto | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<'all' | MalichimpContactStatus>('all');
  const [groupOptionId, setGroupOptionId] = useState('all');
  const [tagId, setTagId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<'xlsx' | 'zip'>('xlsx');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] =
    useState<MalichimpImportPreviewDto | null>(null);
  const [importJob, setImportJob] = useState<MalichimpImportJobDto | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [xlsxGroupOptionIds, setXlsxGroupOptionIds] = useState<string[]>([]);
  const [xlsxPreview, setXlsxPreview] =
    useState<MalichimpXlsxImportPreviewDto | null>(null);
  const [xlsxResult, setXlsxResult] =
    useState<MalichimpXlsxImportResultDto | null>(null);
  const [xlsxConsent, setXlsxConsent] = useState(false);
  const [contactDraft, setContactDraft] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
    institutionName: string;
    jobTitle: string;
    city: string;
    country: string;
    classification: string;
    groupOptionIds: string[];
  } | null>(null);
  const [contactSaving, setContactSaving] = useState(false);

  useEffect(() => {
    const jobId = window.sessionStorage.getItem(importJobStorageKey);
    if (!jobId) return;
    void api.getMalichimpImportJob(jobId)
      .then((job) => {
        setImportJob(job);
        if (job.status === 'queued' || job.status === 'running' || job.status === 'failed') {
          setImportMode('zip');
          setImportOpen(true);
        }
      })
      .catch(() => window.sessionStorage.removeItem(importJobStorageKey));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => setPage(1), [debouncedQuery, status, groupOptionId, tagId]);

  const loadContacts = useCallback(async () => {
    const result = await api.listMalichimpContacts({
      q: debouncedQuery || undefined,
      status: status === 'all' ? undefined : status,
      groupOptionId: groupOptionId === 'all' ? undefined : groupOptionId,
      tagId: tagId === 'all' ? undefined : tagId,
      page,
      pageSize: 50,
    });
    setContacts(result.items);
    setTotal(result.total);
    setPages(result.pages);
  }, [debouncedQuery, groupOptionId, page, status, tagId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      api.getMalichimpStats(),
      api.listMalichimpGroups(),
      api.listMalichimpTags(),
      api.listEmailSenders().catch(() => [] as EmailSenderDto[]),
      loadContacts(),
    ])
      .then(([nextStats, nextGroups, nextTags, nextSenders]) => {
        if (!active) return;
        setStats(nextStats);
        setGroups(nextGroups);
        setTags(nextTags);
        setSenders(nextSenders);
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
  }, [isAdmin, loadContacts, refreshKey]);

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

  function openContact(contact: MalichimpContactDto) {
    setSelectedContact(contact);
    setContactDraft({
      firstName: contact.firstName ?? '',
      lastName: contact.lastName ?? '',
      phone: contact.phone ?? '',
      institutionName: contact.institutionName ?? '',
      jobTitle: contact.jobTitle ?? '',
      city: contact.city ?? '',
      country: contact.country ?? '',
      classification: contact.classification ?? '',
      groupOptionIds: contact.groupOptions.map((option) => option.id),
    });
  }

  function openImport() {
    if (importJob && ['queued', 'running'].includes(importJob.status)) {
      setImportMode(isAdmin ? 'zip' : 'xlsx');
      setImportOpen(true);
      return;
    }
    setImportMode('xlsx');
    setXlsxConsent(false);
    setZipFile(null);
    setImportPreview(null);
    setImportJob(null);
    setXlsxFile(null);
    setXlsxGroupOptionIds([]);
    setXlsxPreview(null);
    setXlsxResult(null);
    setImportError('');
    setImportOpen(true);
  }

  function selectImportMode(value: string) {
    if (value === 'zip' && !isAdmin) return;
    setImportMode(value as 'xlsx' | 'zip');
    setImportError('');
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
      const job = await api.applyMalichimpImport(importPreview.previewId);
      window.sessionStorage.setItem(importJobStorageKey, job.id);
      setImportJob(job);
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : 'No se pudo iniciar la importación');
    } finally {
      setImportBusy(false);
    }
  }

  function selectXlsx(file: File | null) {
    setXlsxPreview(null);
    setXlsxResult(null);
    setImportError('');
    if (!file) {
      setXlsxFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setXlsxFile(null);
      setImportError('Selecciona un archivo XLSX.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setXlsxFile(null);
      setImportError('El XLSX supera el límite de 10 MB.');
      return;
    }
    setXlsxFile(file);
  }

  function toggleXlsxGroupOption(optionId: string, checked: boolean) {
    setXlsxPreview(null);
    setXlsxResult(null);
    setXlsxGroupOptionIds((current) => checked
      ? [...new Set([...current, optionId])]
      : current.filter((id) => id !== optionId));
  }

  async function previewXlsxImport() {
    if (!xlsxFile || !xlsxGroupOptionIds.length || !xlsxConsent) return;
    setImportBusy(true);
    setImportError('');
    try {
      setXlsxPreview(await api.previewMalichimpXlsxImport(
        xlsxFile,
        xlsxGroupOptionIds,
        true,
      ));
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : 'No se pudo validar el XLSX');
    } finally {
      setImportBusy(false);
    }
  }

  async function applyXlsxImport() {
    if (!xlsxPreview) return;
    setImportBusy(true);
    setImportError('');
    try {
      const result = await api.applyMalichimpXlsxImport(xlsxPreview.previewId);
      setXlsxResult(result);
      setXlsxPreview(null);
      toast.success(`Importación completada: ${nf.format(result.imported)} contactos`);
      setRefreshKey((value) => value + 1);
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : 'No se pudo importar el XLSX');
    } finally {
      setImportBusy(false);
    }
  }

  if (loading && !stats) return <PageLoading variant="table" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="MALICHIMP"
        description="Audiencia de correo organizada por grupos de Mailchimp."
        actions={(
          <Button type="button" onClick={openImport}>
            <Upload className="mr-1 size-4" aria-hidden />
            Importar contactos
          </Button>
        )}
      />

      {error ? <AlertBanner>{error}</AlertBanner> : null}

      {stats && !stats.delivery.configured ? (
        <AlertBanner variant="info">
          La audiencia está lista, pero los envíos no están disponibles en este entorno.
        </AlertBanner>
      ) : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Elegibles" value={stats.eligible} hint="Suscritos con consentimiento" />
          <StatCard label="Total importado" value={stats.total} hint="Todos los estados de Mailchimp" />
          <StatCard label="Suprimidos" value={stats.suppressions} hint="Bajas y correos limpiados" />
          <StatCard
            label="Opciones de grupo"
            value={stats.groupOptions}
            hint={`${nf.format(stats.groups)} grupos`}
          />
        </div>
      ) : null}

      <Tabs
        value={section}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value === 'campaigns') next.set('tab', 'campaigns');
          else next.delete('tab');
          setSearchParams(next, { replace: true });
        }}
        className="gap-4"
      >
        <TabsList aria-label="Secciones de MALICHIMP">
          <TabsTrigger value="audience"><Users aria-hidden="true" /> Audiencia</TabsTrigger>
          <TabsTrigger value="campaigns"><Send aria-hidden="true" /> Campañas</TabsTrigger>
        </TabsList>

        <TabsContent value="audience">
          <Card className="gap-0 py-0">
        <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_220px_220px]">
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
          <Select value={groupOptionId} onValueChange={setGroupOptionId}>
            <SelectTrigger aria-label="Filtrar por opción de grupo"><SelectValue placeholder="Todos los grupos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              {groups.filter((group) => group.options.length).map((group) => (
                <SelectGroup key={group.id}>
                  <SelectLabel>{group.name}</SelectLabel>
                  {group.options.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagId} onValueChange={setTagId}>
            <SelectTrigger aria-label="Filtrar por etiqueta"><SelectValue placeholder="Todas las etiquetas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las etiquetas</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}{typeof tag.contacts === 'number' ? ` (${nf.format(tag.contacts)})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TableShell>
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead>Institución</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Grupos</TableHead>
                <TableHead>Etiquetas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length ? contacts.map((contact) => {
                const meta = statusMeta[contact.status];
                const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
                return (
                  <TableRow
                    key={contact.id}
                    tabIndex={0}
                    className="cursor-pointer"
                    aria-label={`Ver detalle de ${name || contact.email}`}
                    onClick={() => openContact(contact)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openContact(contact);
                      }
                    }}
                  >
                    <TableCell className="min-w-60">
                      <span className="block font-medium">{name || 'Sin nombre'}</span>
                      <span className="block text-xs text-muted-foreground">{contact.email}</span>
                    </TableCell>
                    <TableCell className="max-w-64 truncate">{contact.institutionName || '—'}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    <TableCell className="min-w-56">
                      <div className="flex max-w-md flex-wrap gap-1">
                        {contact.groupOptions.slice(0, 3).map((option) => (
                          <Badge key={option.id} variant="outline" title={option.group.name}>
                            {option.group.name}: {option.name}
                          </Badge>
                        ))}
                        {contact.groupOptions.length > 3 ? <Badge variant="secondary">+{contact.groupOptions.length - 3}</Badge> : null}
                        {!contact.groupOptions.length ? <span className="text-muted-foreground">Sin grupo</span> : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-48">
                      <div className="flex max-w-sm flex-wrap gap-1">
                        {contact.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
                        ))}
                        {contact.tags.length > 3 ? <Badge variant="outline">+{contact.tags.length - 3}</Badge> : null}
                        {!contact.tags.length ? <span className="text-muted-foreground">Sin etiquetas</span> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No hay contactos con estos filtros.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableShell>

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
        </TabsContent>

        <TabsContent value="campaigns">
          <MalichimpCampaigns
            groups={groups}
            delivery={stats?.delivery ?? null}
            senders={senders}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(selectedContact)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedContact(null);
            setContactDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {selectedContact && contactDraft ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <DialogTitle>
                    {[contactDraft.firstName, contactDraft.lastName].filter(Boolean).join(' ') || 'Editar contacto'}
                  </DialogTitle>
                  <Badge variant={statusMeta[selectedContact.status].variant}>
                    {statusMeta[selectedContact.status].label}
                  </Badge>
                </div>
                <DialogDescription>
                  {selectedContact.email} · el correo y el estado no se editan aquí
                </DialogDescription>
              </DialogHeader>

              <section aria-labelledby="contact-profile-title" className="space-y-3">
                <h3 id="contact-profile-title" className="text-sm font-semibold">Datos del contacto</h3>
                <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-first-name">Nombre</Label>
                    <Input
                      id="contact-first-name"
                      value={contactDraft.firstName}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-last-name">Apellido</Label>
                    <Input
                      id="contact-last-name"
                      value={contactDraft.lastName}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone">Teléfono</Label>
                    <Input
                      id="contact-phone"
                      value={contactDraft.phone}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-institution">Institución</Label>
                    <Input
                      id="contact-institution"
                      value={contactDraft.institutionName}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, institutionName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-job">Cargo</Label>
                    <Input
                      id="contact-job"
                      value={contactDraft.jobTitle}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, jobTitle: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-classification">Clasificación</Label>
                    <Input
                      id="contact-classification"
                      value={contactDraft.classification}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, classification: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-city">Ciudad</Label>
                    <Input
                      id="contact-city"
                      value={contactDraft.city}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-country">País</Label>
                    <Input
                      id="contact-country"
                      value={contactDraft.country}
                      onChange={(e) => setContactDraft((d) => d && ({ ...d, country: e.target.value }))}
                    />
                  </div>
                </div>
              </section>

              <section aria-labelledby="contact-segmentation-title" className="space-y-3">
                <h3 id="contact-segmentation-title" className="text-sm font-semibold">Grupos</h3>
                <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border p-4">
                  {groups.filter((g) => g.options.length).map((group) => (
                    <fieldset key={group.id} className="space-y-2">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.name}
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.options.map((option) => {
                          const inputId = `edit-group-${option.id}`;
                          return (
                            <label key={option.id} htmlFor={inputId} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm">
                              <Checkbox
                                id={inputId}
                                checked={contactDraft.groupOptionIds.includes(option.id)}
                                onCheckedChange={(checked) => {
                                  setContactDraft((draft) => {
                                    if (!draft) return draft;
                                    const next = checked === true
                                      ? [...new Set([...draft.groupOptionIds, option.id])]
                                      : draft.groupOptionIds.filter((id) => id !== option.id);
                                    return { ...draft, groupOptionIds: next };
                                  });
                                }}
                              />
                              <span>{option.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
                {selectedContact.tags.length ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Etiquetas (solo lectura)</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedContact.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section aria-labelledby="contact-dates-title" className="space-y-3">
                <h3 id="contact-dates-title" className="text-sm font-semibold">Fechas</h3>
                <dl className="grid gap-x-6 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
                  <ContactField label="Alta" value={formatDateTime(selectedContact.optInAt)} />
                  <ContactField label="Última actualización" value={formatDateTime(selectedContact.updatedAt)} />
                </dl>
              </section>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedContact(null);
                    setContactDraft(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={contactSaving}
                  onClick={() => {
                    void (async () => {
                      if (!selectedContact || !contactDraft) return;
                      setContactSaving(true);
                      try {
                        const updated = await api.updateMalichimpContact(selectedContact.id, {
                          firstName: contactDraft.firstName || null,
                          lastName: contactDraft.lastName || null,
                          phone: contactDraft.phone || null,
                          institutionName: contactDraft.institutionName || null,
                          jobTitle: contactDraft.jobTitle || null,
                          city: contactDraft.city || null,
                          country: contactDraft.country || null,
                          classification: contactDraft.classification || null,
                          groupOptionIds: contactDraft.groupOptionIds,
                        });
                        setSelectedContact(updated);
                        setContactDraft({
                          firstName: updated.firstName ?? '',
                          lastName: updated.lastName ?? '',
                          phone: updated.phone ?? '',
                          institutionName: updated.institutionName ?? '',
                          jobTitle: updated.jobTitle ?? '',
                          city: updated.city ?? '',
                          country: updated.country ?? '',
                          classification: updated.classification ?? '',
                          groupOptionIds: updated.groupOptions.map((o) => o.id),
                        });
                        setContacts((current) =>
                          current.map((row) => (row.id === updated.id ? updated : row)),
                        );
                        toast.success('Contacto actualizado');
                      } catch (reason) {
                        toast.error(reason instanceof Error ? reason.message : 'No se pudo guardar');
                      } finally {
                        setContactSaving(false);
                      }
                    })();
                  }}
                >
                  {contactSaving ? <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" /> : null}
                  Guardar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={setImportOpen}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar contactos</DialogTitle>
            <DialogDescription>
              Validaremos el archivo y mostraremos un resumen antes de modificar la audiencia.
            </DialogDescription>
          </DialogHeader>

          {importError ? <AlertBanner>{importError}</AlertBanner> : null}

          {!importJob ? (
            <Tabs value={importMode} onValueChange={selectImportMode} className="gap-4">
              <TabsList aria-label="Tipo de importación">
                <TabsTrigger value="xlsx">
                  <FileSpreadsheet aria-hidden="true" /> XLSX de contactos
                </TabsTrigger>
                {isAdmin ? (
                  <TabsTrigger value="zip">
                    <FileArchive aria-hidden="true" /> ZIP de Mailchimp
                  </TabsTrigger>
                ) : null}
              </TabsList>

              <TabsContent value="xlsx" className="space-y-4">
                {!xlsxPreview && !xlsxResult ? (
                  <>
                    <div className="rounded-lg border border-dashed p-5">
                      <div className="flex items-start gap-3">
                        <FileSpreadsheet className="mt-0.5 size-6 text-muted-foreground" aria-hidden />
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <Label htmlFor="malichimp-xlsx">Nuevos contactos</Label>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Plantilla simple: encabezados + fila de ejemplo (reemplázala). También vale cualquier XLSX con columna Correo. Máx. 10 MB / 10 000 contactos.
                              </p>
                            </div>
                            <Button asChild type="button" variant="outline" size="sm">
                              <a href="/plantillas/plantilla-contactos-malichimp.xlsx" download>
                                <Download aria-hidden="true" /> Descargar plantilla
                              </a>
                            </Button>
                          </div>
                          <Input
                            id="malichimp-xlsx"
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={(event) => selectXlsx(event.target.files?.[0] ?? null)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border p-4">
                      <div>
                        <p className="text-sm font-medium">Grupos para este lote</p>
                        <p className="text-xs text-muted-foreground">
                          Se agregarán a cada contacto importable sin quitar sus grupos actuales.
                        </p>
                      </div>
                      <div className="max-h-60 space-y-4 overflow-y-auto pr-2">
                        {groups.filter((group) => group.options.length).map((group) => (
                          <fieldset key={group.id} className="space-y-2">
                            <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {group.name}
                            </legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {group.options.map((option) => {
                                const inputId = `xlsx-group-${option.id}`;
                                return (
                                  <label key={option.id} htmlFor={inputId} className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/50">
                                    <Checkbox
                                      id={inputId}
                                      checked={xlsxGroupOptionIds.includes(option.id)}
                                      onCheckedChange={(checked) => toggleXlsxGroupOption(option.id, checked === true)}
                                    />
                                    <span>{option.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {xlsxGroupOptionIds.length
                          ? `${nf.format(xlsxGroupOptionIds.length)} opción${xlsxGroupOptionIds.length === 1 ? '' : 'es'} seleccionada${xlsxGroupOptionIds.length === 1 ? '' : 's'}`
                          : 'Selecciona al menos una opción de grupo.'}
                      </p>
                    </div>

                    <label htmlFor="xlsx-consent" className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
                      <Checkbox
                        id="xlsx-consent"
                        checked={xlsxConsent}
                        onCheckedChange={(checked) => setXlsxConsent(checked === true)}
                      />
                      <span>
                        Confirmo que estos contactos autorizaron recibir correos de MALI y que no
                        reactivaré bajas ni correos limpiados/suprimidos.
                      </span>
                    </label>
                  </>
                ) : null}

                {xlsxPreview ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCard label="Importables" value={xlsxPreview.report.importableContacts} hint={`${nf.format(xlsxPreview.report.validRows)} correos válidos`} />
                      <StatCard label="Nuevos" value={xlsxPreview.report.newContacts} hint="Se crearán" />
                      <StatCard label="Existentes" value={xlsxPreview.report.existingContacts} hint="Se completarán" />
                      <StatCard label="Bloqueados" value={xlsxPreview.report.blockedContacts} hint="Bajas, cleaned, nonsubscribed o suprimidos" />
                    </div>
                    {xlsxPreview.report.invalidRows || xlsxPreview.report.duplicateRows ? (
                      <AlertBanner variant="info">
                        <p>
                          Se omitirán {nf.format(xlsxPreview.report.invalidRows)} fila(s) inválida(s) y {nf.format(xlsxPreview.report.duplicateRows)} duplicada(s).
                        </p>
                        {xlsxPreview.report.errors.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                            {xlsxPreview.report.errors.slice(0, 5).map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        ) : null}
                      </AlertBanner>
                    ) : null}
                    <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                      <p className="font-medium">Grupos que se agregarán</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {xlsxPreview.groupOptions.map((option) => (
                          <Badge key={option.id} variant="outline">
                            {option.groupName}: {option.name}
                          </Badge>
                        ))}
                      </div>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                        <li>La importación agregará información, pero no borrará datos ni grupos existentes.</li>
                        <li>Las bajas, direcciones limpiadas y supresiones permanecerán bloqueadas.</li>
                      </ul>
                    </div>
                    {xlsxPreview.report.sample.length ? (
                      <TableShell>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Vista previa</TableHead>
                              <TableHead>Correo</TableHead>
                              <TableHead>Acción</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {xlsxPreview.report.sample.slice(0, 8).map((row) => (
                              <TableRow key={`${row.rowNumber}-${row.email}`}>
                                <TableCell>{row.name || `Fila ${row.rowNumber}`}</TableCell>
                                <TableCell>{row.email}</TableCell>
                                <TableCell>
                                  <Badge variant={row.action === 'blocked' ? 'destructive' : row.action === 'create' ? 'default' : 'secondary'}>
                                    {row.action === 'blocked' ? 'Bloqueado' : row.action === 'create' ? 'Crear' : 'Actualizar'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableShell>
                    ) : null}
                  </div>
                ) : null}

                {xlsxResult ? (
                  <div className="space-y-3" aria-live="polite">
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
                      <div>
                        <p className="font-medium">Importación completada</p>
                        <p className="text-sm text-muted-foreground">
                          {nf.format(xlsxResult.created)} nuevos, {nf.format(xlsxResult.updated)} actualizados y {nf.format(xlsxResult.skipped)} bloqueados.
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Se agregaron {nf.format(xlsxResult.membershipsAdded)} membresías de grupo nuevas.
                    </p>
                  </div>
                ) : null}

                <DialogFooter>
                  {!xlsxPreview && !xlsxResult ? (
                    <Button
                      type="button"
                      onClick={() => void previewXlsxImport()}
                      disabled={!xlsxFile || !xlsxGroupOptionIds.length || !xlsxConsent || importBusy}
                    >
                      {importBusy ? <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" /> : null}
                      {importBusy ? 'Validando…' : 'Validar XLSX'}
                    </Button>
                  ) : null}
                  {xlsxPreview ? (
                    <>
                      <Button type="button" variant="outline" onClick={() => { setXlsxPreview(null); setXlsxFile(null); }} disabled={importBusy}>
                        Elegir otro XLSX
                      </Button>
                      <Button type="button" onClick={() => void applyXlsxImport()} disabled={importBusy}>
                        {importBusy ? <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" /> : null}
                        Importar {nf.format(xlsxPreview.report.importableContacts)} contactos
                      </Button>
                    </>
                  ) : null}
                  {xlsxResult ? (
                    <Button type="button" onClick={() => setImportOpen(false)}>Cerrar</Button>
                  ) : null}
                </DialogFooter>
              </TabsContent>

              {isAdmin ? (
              <TabsContent value="zip" className="space-y-4">
                {!importPreview ? (
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
                            Sincroniza estados, grupos y supresiones del export completo. Máximo 100 MB.
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

                {importPreview ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCard label="Total" value={importPreview.report.totalUnique} hint="Contactos únicos" />
                      <StatCard label="Elegibles" value={importPreview.report.eligibleContacts} hint="Suscritos" />
                      <StatCard label="Suprimidos" value={importPreview.report.suppressions} hint="Bajas y limpiados" />
                      <StatCard label="Opciones de grupo" value={importPreview.report.groupOptions} hint={`${nf.format(importPreview.report.groups)} grupos`} />
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
                        <li>Se reconstruirán sus opciones de grupo para segmentar boletines.</li>
                        <li>Las bajas y direcciones limpiadas permanecerán suprimidas.</li>
                        <li>El ZIP temporal será eliminado al terminar.</li>
                      </ul>
                    </div>
                  </div>
                ) : null}

                <DialogFooter>
                  {!importPreview ? (
                    <Button type="button" onClick={() => void previewImport()} disabled={!zipFile || importBusy}>
                      {importBusy ? <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" /> : null}
                      {importBusy ? 'Validando…' : 'Validar ZIP'}
                    </Button>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => { setImportPreview(null); setZipFile(null); }} disabled={importBusy}>
                        Elegir otro ZIP
                      </Button>
                      <Button type="button" onClick={() => void applyImport()} disabled={importBusy}>
                        {importBusy ? <Loader2 className="mr-1 size-4 animate-spin motion-reduce:animate-none" /> : null}
                        Importar {nf.format(importPreview.report.totalUnique)} contactos
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </TabsContent>
              ) : null}
            </Tabs>
          ) : (
            <div className="space-y-4" aria-live="polite">
              {importJob.status === 'completed' ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <CheckCircle2 className="size-6 text-emerald-600" aria-hidden />
                  <div>
                    <p className="font-medium">Importación completada</p>
                    <p className="text-sm text-muted-foreground">{nf.format(importJob.processed)} contactos procesados.</p>
                  </div>
                </div>
              ) : importJob.status === 'failed' ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm" role="status">
                  La importación falló. Revisa el error antes de volver a subir el ZIP.
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
              <DialogFooter>
                {importJob.status === 'completed' || importJob.status === 'failed' ? (
                  <Button type="button" onClick={() => setImportOpen(false)}>Cerrar</Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
                    Seguir en segundo plano
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
