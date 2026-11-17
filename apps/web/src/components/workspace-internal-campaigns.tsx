import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import type {
  EmailSenderDto,
  InternalAudienceDto,
  InternalAudienceMemberDto,
  InternalCampaignDto,
  NewsletterDto,
} from '@mali-one/shared';
import { AlertBanner, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
const df = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const maliPeEmailPattern = /^[^@\s]+@mali\.pe$/i;
const DEFAULT_FROM_NAME = 'MALI - Campañas internas';
const DEFAULT_REPLY_TO = 'tecnologia@mali.pe';

const CAMPAIGN_STEPS = [
  { id: 'to', label: 'Para', hint: 'Unidades organizativas' },
  { id: 'from', label: 'De', hint: 'Remitente' },
  { id: 'content', label: 'Contenido', hint: 'Boletín' },
  { id: 'send', label: 'Envío', hint: 'Revisar y enviar' },
] as const;

type CampaignStepId = (typeof CAMPAIGN_STEPS)[number]['id'];

const statusLabel: Record<InternalCampaignDto['status'], string> = {
  queued: 'En cola',
  sending: 'Enviando',
  completed: 'Completada',
  failed: 'Fallida',
};

function OrgUnitMultiSelect({
  id,
  label,
  hint,
  options,
  selectedPaths,
  disabledPaths = [],
  onChange,
  placeholder = 'Seleccionar unidades',
}: {
  id: string;
  label: string;
  hint?: string;
  options: string[];
  selectedPaths: string[];
  disabledPaths?: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((path) =>
    path.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function toggle(path: string, checked: boolean) {
    if (disabledPaths.includes(path)) return;
    onChange(
      checked
        ? [...new Set([...selectedPaths, path])]
        : selectedPaths.filter((item) => item !== path),
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-auto min-h-10 w-full justify-between px-3 py-2 font-normal"
            aria-expanded={open}
          >
            <span className="truncate text-left">
              {selectedPaths.length
                ? `${selectedPaths.length} unidad${selectedPaths.length === 1 ? '' : 'es'}`
                : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex w-[min(28rem,calc(100vw-2rem))] max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden p-2"
        >
          <div className="relative mb-2 shrink-0">
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar unidad…"
              className="pl-8"
            />
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {filtered.map((path) => {
              const disabled = disabledPaths.includes(path);
              const checked = selectedPaths.includes(path);
              const inputId = `${id}-${path}`;
              return (
                <label
                  key={path}
                  htmlFor={inputId}
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${
                    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/60'
                  }`}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={disabled}
                    className="mt-0.5"
                    onCheckedChange={(value) => toggle(path, value === true)}
                  />
                  <span className="min-w-0 flex-1 break-all">{path}</span>
                </label>
              );
            })}
            {!filtered.length ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Sin coincidencias
              </p>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      {selectedPaths.length ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {selectedPaths.map((path) => (
            <li key={path} className="break-all">
              {path}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function WorkspaceInternalCampaigns() {
  const toast = useToast();
  const [audience, setAudience] = useState<InternalAudienceDto | null>(null);
  const [preview, setPreview] = useState<InternalAudienceDto | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [campaigns, setCampaigns] = useState<InternalCampaignDto[]>([]);
  const [senders, setSenders] = useState<EmailSenderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [formStep, setFormStep] = useState<CampaignStepId>('to');
  const [busy, setBusy] = useState(false);

  const [includePaths, setIncludePaths] = useState<string[]>([]);
  const [excludePaths, setExcludePaths] = useState<string[]>([]);
  const [activeDays, setActiveDays] = useState(30);
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState(DEFAULT_FROM_NAME);
  const [replyTo, setReplyTo] = useState(DEFAULT_REPLY_TO);
  const [showAdvancedSender, setShowAdvancedSender] = useState(false);
  const [newsletterId, setNewsletterId] = useState('');
  const [name, setName] = useState('');
  const [recipientQuery, setRecipientQuery] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [nextAudience, nextNewsletters, nextCampaigns, nextSenders] =
        await Promise.all([
          api.getInternalAudience(30),
          api.listInternalNewsletters(),
          api.listInternalCampaigns(),
          api.listEmailSenders().catch(() => [] as EmailSenderDto[]),
        ]);
      setAudience(nextAudience);
      setNewsletters(nextNewsletters);
      setCampaigns(nextCampaigns);
      setSenders(nextSenders);
      setFromEmail((current) => current || nextSenders[0]?.email || '');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudieron cargar las campañas internas',
      );
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void api.listInternalCampaigns().then(setCampaigns).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const orgUnits = audience?.orgUnits ?? [];
  const selectedNewsletter = newsletters.find((item) => item.id === newsletterId) ?? null;

  const filteredRecipients = useMemo(() => {
    const members = preview?.members ?? [];
    const term = recipientQuery.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) =>
      `${member.name} ${member.email} ${member.orgUnitPath}`
        .toLowerCase()
        .includes(term),
    );
  }, [preview, recipientQuery]);

  const stepIndex = CAMPAIGN_STEPS.findIndex((step) => step.id === formStep);

  const stepReady: Record<CampaignStepId, boolean> = {
    to: includePaths.length > 0 && Boolean(preview && preview.members.length > 0),
    from:
      maliPeEmailPattern.test(fromEmail) &&
      maliPeEmailPattern.test(replyTo.trim()) &&
      Boolean(fromName.trim()),
    content: Boolean(newsletterId),
    send: true,
  };

  const stepBlockReason: Partial<Record<CampaignStepId, string>> = {
    to: !includePaths.length
      ? 'Selecciona al menos una unidad organizativa y calcula la audiencia'
      : !preview
        ? 'Calcula la vista previa de destinatarios'
        : preview.members.length
          ? undefined
          : 'No hay destinatarios con estos filtros',
    from: !senders.length
      ? 'Agrega remitentes en Boletines → Remitentes'
      : !maliPeEmailPattern.test(fromEmail)
        ? 'Elige un remitente @mali.pe'
        : !maliPeEmailPattern.test(replyTo.trim())
          ? 'La respuesta debe ser @mali.pe'
          : !fromName.trim()
            ? 'Indica el nombre visible'
            : undefined,
    content: !newsletterId ? 'Selecciona un boletín publicado' : undefined,
  };

  const campaignReady =
    stepReady.to && stepReady.from && stepReady.content && stepReady.send;

  function resetForm() {
    setFormStep('to');
    setIncludePaths([]);
    setExcludePaths([]);
    setActiveDays(30);
    setPreview(null);
    setRecipientQuery('');
    setFromEmail(senders[0]?.email || '');
    setFromName(DEFAULT_FROM_NAME);
    setReplyTo(DEFAULT_REPLY_TO);
    setShowAdvancedSender(false);
    setNewsletterId('');
    setName('');
    setBusy(false);
  }

  function openCampaign() {
    resetForm();
    setOpen(true);
  }

  async function calculateAudience() {
    if (!includePaths.length) return;
    setPreviewBusy(true);
    try {
      const next = await api.previewInternalAudience({
        activeDays,
        orgUnitPaths: includePaths,
        excludeOrgUnitPaths: excludePaths,
      });
      setPreview(next);
      if (!next.members.length) {
        toast.error('No hay destinatarios con estos filtros');
      }
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : 'No se pudo calcular la audiencia',
      );
    } finally {
      setPreviewBusy(false);
    }
  }

  function goNext() {
    const current = CAMPAIGN_STEPS[stepIndex];
    if (!current) return;
    if (!stepReady[current.id]) {
      const reason = stepBlockReason[current.id];
      if (reason) toast.error(reason);
      return;
    }
    const next = CAMPAIGN_STEPS[stepIndex + 1];
    if (next) setFormStep(next.id);
  }

  function goBack() {
    const prev = CAMPAIGN_STEPS[stepIndex - 1];
    if (prev) setFormStep(prev.id);
  }

  async function submitCampaign() {
    if (!campaignReady) return;
    setBusy(true);
    try {
      const campaignName =
        name.trim() ||
        selectedNewsletter?.title ||
        `Campaña interna ${df.format(new Date())}`;
      const result = await api.createInternalCampaign({
        name: campaignName.slice(0, 160),
        newsletterId,
        replyTo: replyTo.trim().toLowerCase(),
        fromEmail: fromEmail.trim().toLowerCase(),
        fromName: fromName.trim(),
        orgUnitPaths: includePaths,
        excludeOrgUnitPaths: excludePaths,
        activeDays,
      });
      toast.success(
        `Campaña encolada para ${nf.format(result.totalRecipients)} personas`,
      );
      setOpen(false);
      resetForm();
      await load(true);
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : 'No se pudo crear la campaña',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <TableSkeleton rows={5} />;

  return (
    <div className="space-y-4">
      {error ? <AlertBanner>{error}</AlertBanner> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Campañas internas</h2>
          <p className="text-sm text-muted-foreground">
            Cada envío congela el boletín y la audiencia de Workspace por OU.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            aria-label="Actualizar campañas"
          >
            <RefreshCw className="size-4" aria-hidden /> Actualizar
          </Button>
          <Button
            type="button"
            onClick={openCampaign}
            disabled={!senders.length || !orgUnits.length}
          >
            <Plus className="size-4" aria-hidden /> Nueva campaña interna
          </Button>
        </div>
      </div>

      {!newsletters.length ? (
        <AlertBanner variant="info">
          No hay boletines publicados. Publícalos en Boletines antes de enviar.
        </AlertBanner>
      ) : null}

      {!senders.length ? (
        <AlertBanner variant="info">
          Agrega al menos un remitente @mali.pe en Boletines → Remitentes.
        </AlertBanner>
      ) : null}

      {!orgUnits.length ? (
        <AlertBanner variant="info">
          No hay unidades organizativas con usuarios activos recientes.
        </AlertBanner>
      ) : null}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviados</TableHead>
                <TableHead>Entregados</TableHead>
                <TableHead>Rebotes</TableHead>
                <TableHead>Omitidos</TableHead>
                <TableHead>Aperturas</TableHead>
                <TableHead>Clics</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="min-w-64">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.newsletterTitle} ·{' '}
                      {df.format(new Date(campaign.createdAt))}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        campaign.status === 'failed'
                          ? 'destructive'
                          : campaign.status === 'completed'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {statusLabel[campaign.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {nf.format(campaign.sent)} /{' '}
                    {nf.format(campaign.totalRecipients)}
                  </TableCell>
                  <TableCell>{nf.format(campaign.delivered)}</TableCell>
                  <TableCell>{nf.format(campaign.bounced)}</TableCell>
                  <TableCell>{nf.format(campaign.suppressed)}</TableCell>
                  <TableCell className="tabular-nums">
                    {nf.format(campaign.opened)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {nf.format(campaign.clicked)}
                  </TableCell>
                </TableRow>
              ))}
              {!campaigns.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <BarChart3 className="mx-auto mb-2 size-6" aria-hidden />
                    Aún no hay campañas internas.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 sm:px-6">
            <DialogTitle>Nueva campaña interna</DialogTitle>
            <DialogDescription>
              Paso {stepIndex + 1} de {CAMPAIGN_STEPS.length}:{' '}
              {CAMPAIGN_STEPS[stepIndex]?.hint}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-auto overflow-y-auto p-5 sm:p-6">
            {formStep === 'to' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">Para</h3>
                  <p className="text-sm text-muted-foreground">
                    Elige unidades organizativas. Se incluyen sub-OUs. Solo
                    cuentas @mali.pe activas en la ventana de días indicada.
                  </p>
                </div>
                <div className="max-w-xs space-y-2">
                  <Label htmlFor="internal-active-days">
                    Activos últimos (días)
                  </Label>
                  <Input
                    id="internal-active-days"
                    type="number"
                    min={1}
                    max={90}
                    value={activeDays}
                    onChange={(event) => {
                      const next = Number(event.target.value) || 30;
                      setActiveDays(Math.min(90, Math.max(1, next)));
                      setPreview(null);
                    }}
                  />
                </div>
                <OrgUnitMultiSelect
                  id="internal-include"
                  label="Unidades a incluir"
                  options={orgUnits}
                  selectedPaths={includePaths}
                  onChange={(next) => {
                    setIncludePaths(next);
                    setPreview(null);
                  }}
                  placeholder="Seleccionar unidades a incluir"
                />
                <OrgUnitMultiSelect
                  id="internal-exclude"
                  label="Unidades a excluir"
                  options={orgUnits}
                  selectedPaths={excludePaths}
                  disabledPaths={includePaths}
                  onChange={(next) => {
                    setExcludePaths(next);
                    setPreview(null);
                  }}
                  placeholder="Ninguna exclusión"
                />
                <div className="space-y-3 border-t border-border/60 pt-5">
                  <p className="text-sm font-medium">Vista previa de destinatarios</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={previewBusy || !includePaths.length}
                      onClick={() => void calculateAudience()}
                    >
                      {previewBusy ? (
                        <Loader2
                          className="size-4 animate-spin motion-reduce:animate-none"
                          aria-hidden
                        />
                      ) : (
                        <Eye className="size-4" aria-hidden />
                      )}
                      {previewBusy
                        ? 'Calculando…'
                        : preview
                          ? 'Recalcular'
                          : 'Mostrar destinatarios'}
                    </Button>
                    {preview ? (
                      <span className="text-sm text-muted-foreground">
                        {nf.format(preview.members.length)} destinatarios
                      </span>
                    ) : null}
                  </div>
                  {preview && preview.members.length > 0 ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search
                          className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          value={recipientQuery}
                          onChange={(event) =>
                            setRecipientQuery(event.target.value)
                          }
                          placeholder="Buscar en la vista previa"
                          className="pl-8"
                        />
                      </div>
                      <ul className="max-h-72 divide-y overflow-y-auto rounded-md border text-sm">
                        {filteredRecipients.map((member: InternalAudienceMemberDto) => (
                          <li
                            key={member.id || member.email}
                            className="px-3 py-2"
                          >
                            <span className="block font-medium">
                              {member.name || '—'}
                            </span>
                            <span className="block font-mono text-xs text-muted-foreground">
                              {member.email}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {member.orgUnitPath}
                            </span>
                          </li>
                        ))}
                        {!filteredRecipients.length ? (
                          <li className="px-3 py-6 text-center text-muted-foreground">
                            Sin coincidencias
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : preview ? (
                    <p className="text-sm text-muted-foreground">
                      No hay destinatarios con los filtros actuales.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {formStep === 'from' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">De</h3>
                  <p className="text-sm text-muted-foreground">
                    Define quién envía el correo y a dónde llegan las respuestas.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="internal-from-email">Remitente</Label>
                    <Select value={fromEmail} onValueChange={setFromEmail}>
                      <SelectTrigger
                        id="internal-from-email"
                        aria-label="Correo del remitente"
                      >
                        <SelectValue placeholder="Selecciona un remitente" />
                      </SelectTrigger>
                      <SelectContent>
                        {senders.map((sender) => (
                          <SelectItem key={sender.id} value={sender.email}>
                            {sender.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="internal-from-name">Nombre visible</Label>
                    <Input
                      id="internal-from-name"
                      value={fromName}
                      onChange={(event) => setFromName(event.target.value)}
                      placeholder={DEFAULT_FROM_NAME}
                      maxLength={160}
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => setShowAdvancedSender((value) => !value)}
                  >
                    {showAdvancedSender
                      ? 'Ocultar opciones de respuesta'
                      : 'Opciones de respuesta'}
                  </button>
                  {showAdvancedSender ? (
                    <div className="mt-2 space-y-2">
                      <Label htmlFor="internal-reply-to">
                        Las respuestas llegarán a
                      </Label>
                      <Input
                        id="internal-reply-to"
                        type="email"
                        value={replyTo}
                        onChange={(event) => setReplyTo(event.target.value)}
                        placeholder="correo@mali.pe"
                      />
                      <p className="text-xs text-muted-foreground">
                        Debe ser un correo @mali.pe.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {formStep === 'content' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">Contenido</h3>
                  <p className="text-sm text-muted-foreground">
                    Elige el boletín publicado. El asunto se toma del boletín.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Boletín publicado</Label>
                  <Select value={newsletterId} onValueChange={setNewsletterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {newsletters.map((newsletter) => (
                        <SelectItem key={newsletter.id} value={newsletter.id}>
                          {newsletter.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedNewsletter ? (
                  <p className="text-sm text-muted-foreground">
                    Asunto:{' '}
                    <span className="text-foreground">
                      {selectedNewsletter.subject}
                    </span>
                  </p>
                ) : null}
                <div className="space-y-2 border-t border-border/60 pt-5">
                  <Label htmlFor="internal-campaign-name">
                    Nombre del envío (opcional)
                  </Label>
                  <Input
                    id="internal-campaign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Si lo dejas vacío, usamos el título del boletín"
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo se usa internamente para identificar la campaña.
                  </p>
                </div>
              </div>
            ) : null}

            {formStep === 'send' ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">Envío</h3>
                  <p className="text-sm text-muted-foreground">
                    Revisa el resumen y confirma el envío inmediato.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11.5rem]">
                  <div className="space-y-2 rounded-md border px-3 py-3 text-sm">
                    <p>
                      <span className="text-muted-foreground">Para:</span>{' '}
                      {preview
                        ? `${nf.format(preview.members.length)} destinatarios · ${includePaths.length} OU`
                        : '—'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">De:</span>{' '}
                      {fromName.trim() || '—'} &lt;{fromEmail || '—'}&gt;
                    </p>
                    <p>
                      <span className="text-muted-foreground">Asunto:</span>{' '}
                      {selectedNewsletter?.subject || '—'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Contenido:</span>{' '}
                      {selectedNewsletter?.title || '—'}
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-md border bg-white">
                    <p className="border-b px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                      Vista previa
                    </p>
                    <div className="relative h-48 overflow-hidden bg-white">
                      {selectedNewsletter?.htmlBody ? (
                        <iframe
                          title={`Vista previa de ${selectedNewsletter.title}`}
                          srcDoc={selectedNewsletter.htmlBody}
                          sandbox=""
                          referrerPolicy="no-referrer"
                          tabIndex={-1}
                          className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
                          style={{
                            width: 640,
                            height: 900,
                            transform: 'scale(0.275)',
                          }}
                        />
                      ) : (
                        <p className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                          Sin contenido para previsualizar
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {campaignReady ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2
                      className="size-3.5 text-emerald-600"
                      aria-hidden
                    />
                    Lista para confirmar
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {Object.values(stepBlockReason).find(Boolean) ||
                      'Completa los pasos anteriores'}
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 border-t bg-background px-5 py-4 sm:px-6">
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={goBack}
                disabled={stepIndex === 0 || busy}
              >
                <ChevronLeft className="size-4" aria-hidden />
                Atrás
              </Button>
              {formStep === 'send' ? (
                <Button
                  type="button"
                  onClick={() => void submitCampaign()}
                  disabled={busy || !campaignReady}
                >
                  {busy ? (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {busy ? 'Preparando…' : 'Enviar'}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={goNext}
                  disabled={busy || !stepReady[formStep]}
                >
                  Siguiente
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
