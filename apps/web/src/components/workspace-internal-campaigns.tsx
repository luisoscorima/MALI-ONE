import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  EmailSenderDto,
  InternalAudienceDto,
  InternalAudienceMemberDto,
  InternalCampaignDetailDto,
  InternalCampaignDto,
  NewsletterDto,
} from '@mali-one/shared';
import { AlertBanner, Spinner, TableShellSkeleton } from '@/components/feedback';
import { IconActionButton } from '@/components/icon-action-button';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
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
  TableShell,
} from '@/components/ui';

const MalichimpCampaignStatsPanel = lazy(() =>
  import('@/components/malichimp-campaign-stats-panel').then((m) => ({
    default: m.MalichimpCampaignStatsPanel,
  })),
);

const nf = new Intl.NumberFormat('es-PE');
const pf = new Intl.NumberFormat('es-PE', {
  style: 'percent',
  maximumFractionDigits: 1,
});
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
  { id: 'send', label: 'Envío', hint: 'Programar o enviar' },
] as const;

type CampaignStepId = (typeof CAMPAIGN_STEPS)[number]['id'];

const statusLabel: Record<InternalCampaignDto['status'], string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  queued: 'En cola',
  sending: 'Enviando',
  completed: 'Completada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

function limaDateTimeToIso(value: string): string {
  return new Date(`${value}:00-05:00`).toISOString();
}

function minimumLimaDateTime(): string {
  const lima = new Date(Date.now() - 5 * 60 * 60 * 1_000);
  return lima.toISOString().slice(0, 16);
}

function NewsletterSearchSelect({
  id,
  label,
  newsletters,
  value,
  onChange,
  placeholder = 'Seleccionar',
}: {
  id: string;
  label: string;
  newsletters: NewsletterDto[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = newsletters.find((newsletter) => newsletter.id === value) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return newsletters;
    return newsletters.filter((newsletter) => {
      const haystack = `${newsletter.title} ${newsletter.subject} ${newsletter.slug}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [newsletters, query]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="h-auto min-h-10 w-full justify-between px-3 py-2 font-normal"
            aria-expanded={open}
            aria-label={label}
          >
            <span className="truncate text-left">
              {selected ? selected.title : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] max-h-80 flex-col gap-2 overflow-hidden p-2"
        >
          <div className="relative shrink-0">
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título o asunto"
              className="pl-8"
              aria-label={`Buscar ${label}`}
            />
          </div>
          <div
            className="min-h-0 max-h-64 flex-1 space-y-1 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y"
            onWheel={(event) => event.stopPropagation()}
          >
            {filtered.length ? (
              filtered.map((newsletter) => {
                const active = newsletter.id === value;
                return (
                  <button
                    key={newsletter.id}
                    type="button"
                    className={`flex w-full min-w-0 flex-col items-stretch gap-0.5 overflow-hidden rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60 ${
                      active ? 'bg-muted' : ''
                    }`}
                    onClick={() => {
                      onChange(newsletter.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="block w-full truncate font-medium">
                      {newsletter.title}
                    </span>
                    {newsletter.subject ? (
                      <span className="block w-full truncate text-xs text-muted-foreground">
                        {newsletter.subject}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Sin coincidencias
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

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
  const confirm = useConfirm();
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
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('');
  const [draftNewsletterId, setDraftNewsletterId] = useState<string | null>(null);
  const [attachedNewsletter, setAttachedNewsletter] = useState<NewsletterDto | null>(null);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [creatingNewsletter, setCreatingNewsletter] = useState(false);
  const [refreshingContent, setRefreshingContent] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingDraftId, setOpeningDraftId] = useState<string | null>(null);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [campaignPreview, setCampaignPreview] =
    useState<InternalCampaignDetailDto | null>(null);
  const [statsCampaign, setStatsCampaign] = useState<InternalCampaignDto | null>(
    null,
  );

  const loadInternalStats = useCallback(
    (id: string, days: number) => api.getInternalCampaignStats(id, days),
    [],
  );

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [nextAudience, nextNewsletters, nextCampaigns, nextSenders] =
        await Promise.all([
          api.getInternalAudience(30),
          api.listInternalNewsletters(),
          api.listInternalCampaigns(),
          api.listEmailSenders('internal_communications').catch(() => [] as EmailSenderDto[]),
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
  const selectableNewsletters = useMemo(() => newsletters, [newsletters]);
  const selectedNewsletter =
    (attachedNewsletter && attachedNewsletter.id === newsletterId
      ? attachedNewsletter
      : null)
    || newsletters.find((item) => item.id === newsletterId)
    || null;

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
  const scheduleReady = scheduleMode === 'now' || Boolean(
    scheduledAt && new Date(limaDateTimeToIso(scheduledAt)).getTime() > Date.now(),
  );

  const stepReady: Record<CampaignStepId, boolean> = {
    to: includePaths.length > 0 && Boolean(preview && preview.members.length > 0),
    from:
      maliPeEmailPattern.test(fromEmail) &&
      maliPeEmailPattern.test(replyTo.trim()) &&
      Boolean(fromName.trim()),
    content: Boolean(newsletterId) && Boolean(subject.trim()),
    send: scheduleReady,
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
      ? 'Agrega remitentes del catálogo de comunicaciones internas (Boletines → Remitentes, scope IC)'
      : !maliPeEmailPattern.test(fromEmail)
        ? 'Elige un remitente @mali.pe'
        : !maliPeEmailPattern.test(replyTo.trim())
          ? 'La respuesta debe ser @mali.pe'
          : !fromName.trim()
            ? 'Indica el nombre visible'
            : undefined,
    content: !newsletterId
      ? 'Selecciona un boletín o crea uno nuevo'
      : !subject.trim()
        ? 'Indica el asunto del correo'
        : undefined,
    send: scheduleMode === 'scheduled' && !scheduleReady
      ? 'Elige una fecha y hora futuras en Lima'
      : undefined,
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
    setSubject('');
    setName('');
    setDraftNewsletterId(null);
    setAttachedNewsletter(null);
    setDraftCampaignId(null);
    setScheduleMode('now');
    setScheduledAt('');
    setBusy(false);
  }

  function openCampaign() {
    resetForm();
    setOpen(true);
  }

  function selectNewsletter(id: string) {
    setNewsletterId(id);
    setDraftNewsletterId(null);
    setAttachedNewsletter(null);
    const next = newsletters.find((item) => item.id === id);
    if (next) {
      setSubject((current) => current.trim() || next.subject);
      setName((current) => current.trim() || next.title);
    }
  }

  async function createNewNewsletterDraft() {
    const title = (name.trim() || `Boletín ${new Date().toLocaleString('es-PE')}`).trim();
    if (title.length < 3) {
      toast.error('Indica un nombre de al menos 3 caracteres');
      return;
    }
    setCreatingNewsletter(true);
    try {
      const created = await api.createInternalNewsletterDraft({
        title,
        subject: subject.trim() || title,
      });
      setAttachedNewsletter(created);
      setDraftNewsletterId(created.id);
      setNewsletterId(created.id);
      setSubject((current) => current.trim() || created.subject);
      setName((current) => current.trim() || created.title);
      toast.success('Borrador creado en el catálogo de boletines');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo crear el boletín');
    } finally {
      setCreatingNewsletter(false);
    }
  }

  async function refreshAttachedNewsletter() {
    const newsletterToRefresh = draftNewsletterId || attachedNewsletter?.id || newsletterId;
    if (!newsletterToRefresh) return;
    setRefreshingContent(true);
    try {
      if (draftCampaignId) {
        const detail = await api.getInternalCampaign(draftCampaignId);
        setAttachedNewsletter(detail.newsletter);
        setSubject((current) => current.trim() || detail.subject);
      } else {
        setAttachedNewsletter(await api.getInternalNewsletter(newsletterToRefresh));
      }
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo actualizar el contenido');
    } finally {
      setRefreshingContent(false);
    }
  }

  async function hydrateDraftCampaign(detail: InternalCampaignDetailDto) {
    setDraftCampaignId(detail.id);
    setAttachedNewsletter(detail.newsletter);
    setDraftNewsletterId(detail.newsletter.status === 'draft' ? detail.newsletterId : null);
    setName(detail.name);
    setNewsletterId(detail.newsletterId);
    setSubject(detail.subject);
    setFromName(detail.fromName);
    setFromEmail(detail.fromEmail);
    setReplyTo(detail.replyTo);
    setIncludePaths(detail.orgUnitPaths);
    setExcludePaths(detail.excludeOrgUnitPaths);
    setScheduleMode('now');
    setScheduledAt('');
    setShowAdvancedSender(detail.replyTo !== detail.fromEmail);
    setFormStep('to');
    setOpen(true);
    setPreviewBusy(true);
    try {
      setPreview(await api.previewInternalAudience({
        activeDays,
        orgUnitPaths: detail.orgUnitPaths,
        excludeOrgUnitPaths: detail.excludeOrgUnitPaths,
      }));
    } catch (reason) {
      setPreview(null);
      toast.error(reason instanceof Error ? reason.message : 'No se pudo recalcular la audiencia');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function continueDraft(campaignId: string) {
    setOpeningDraftId(campaignId);
    try {
      await hydrateDraftCampaign(await api.getInternalCampaign(campaignId));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo abrir el borrador');
    } finally {
      setOpeningDraftId(null);
    }
  }

  async function duplicateCampaign(campaignId: string) {
    setDuplicatingId(campaignId);
    try {
      const draft = await api.duplicateInternalCampaign(campaignId);
      await load(true);
      toast.success('Campaña duplicada como borrador');
      await hydrateDraftCampaign(draft);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo duplicar la campaña');
    } finally {
      setDuplicatingId(null);
    }
  }

  async function deleteDraftCampaign(campaign: InternalCampaignDto) {
    const ok = await confirm({
      title: `¿Eliminar el borrador “${campaign.name}”?`,
      description:
        'Si el boletín solo lo usaba esta campaña y sigue en borrador, también se eliminará.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    setDeletingId(campaign.id);
    try {
      await api.deleteInternalCampaign(campaign.id);
      if (draftCampaignId === campaign.id) {
        setOpen(false);
        resetForm();
      }
      await load(true);
      toast.success('Borrador eliminado');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  async function openCampaignPreview(id: string) {
    try {
      setCampaignPreview(await api.getInternalCampaign(id));
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : 'No se pudo cargar la vista previa',
      );
    }
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
    if (!campaignReady || !preview?.members.length) return;
    const when = scheduleMode === 'scheduled' && scheduledAt
      ? `programada para ${df.format(new Date(limaDateTimeToIso(scheduledAt)))}`
      : 'envío inmediato';
    const ok = await confirm({
      title: scheduleMode === 'scheduled' ? 'Programar campaña' : 'Enviar campaña',
      description: `Se creará la campaña (${when}) hacia ${nf.format(preview.members.length)} destinatarios.`,
      confirmLabel: scheduleMode === 'scheduled' ? 'Programar' : 'Enviar',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const campaignName =
        name.trim() ||
        selectedNewsletter?.title ||
        `Campaña interna ${df.format(new Date())}`;
      const payload = {
        name: campaignName.slice(0, 160),
        newsletterId,
        ...(draftNewsletterId && draftNewsletterId === newsletterId
          ? { draftNewsletterId }
          : {}),
        subject: subject.trim(),
        replyTo: replyTo.trim().toLowerCase(),
        fromEmail: fromEmail.trim().toLowerCase(),
        fromName: fromName.trim(),
        orgUnitPaths: includePaths,
        excludeOrgUnitPaths: excludePaths,
        activeDays,
        ...(scheduleMode === 'scheduled' && scheduledAt
          ? { scheduledAt: limaDateTimeToIso(scheduledAt) }
          : {}),
      };
      const result = draftCampaignId
        ? await api.sendInternalDraftCampaign(draftCampaignId, payload)
        : await api.createInternalCampaign(payload);
      toast.success(
        result.status === 'scheduled'
          ? `Campaña programada para ${nf.format(result.totalRecipients)} personas`
          : `Campaña encolada para ${nf.format(result.totalRecipients)} personas`,
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

  if (loading) return <TableShellSkeleton rows={5} cols={7} />;

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
          No hay boletines en el catálogo de comunicaciones internas. Créalo en la pestaña Boletines.
        </AlertBanner>
      ) : null}

      {!senders.length ? (
        <AlertBanner variant="info">
          Agrega al menos un remitente @mali.pe en el catálogo de comunicaciones internas (Boletines →
          Remitentes).
        </AlertBanner>
      ) : null}

      {!orgUnits.length ? (
        <AlertBanner variant="info">
          No hay unidades organizativas con usuarios activos recientes.
        </AlertBanner>
      ) : null}

      <TableShell>
        <Table className="min-w-[840px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[7.5rem]">Vista</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviados</TableHead>
                <TableHead>% entrega</TableHead>
                <TableHead>% apertura</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="align-middle">
                    <button
                      type="button"
                      className="relative block h-16 w-[5.5rem] overflow-hidden rounded-md border bg-white shadow-sm transition-opacity hover:opacity-90"
                      onClick={() => void openCampaignPreview(campaign.id)}
                      aria-label={`Vista previa de ${campaign.name}`}
                      title="Abrir vista previa"
                    >
                      <iframe
                        title={`Miniatura de ${campaign.name}`}
                        src={`/api/internal-communications/campaigns/${encodeURIComponent(campaign.id)}/view`}
                        sandbox=""
                        referrerPolicy="no-referrer"
                        tabIndex={-1}
                        loading="lazy"
                        className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
                        style={{
                          width: 640,
                          height: 900,
                          transform: 'scale(0.1375)',
                        }}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="min-w-64">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.newsletterTitle} ·{' '}
                      {df.format(new Date(campaign.createdAt))}
                    </p>
                    {campaign.scheduledAt ? (
                      <p className="text-xs text-muted-foreground">
                        Programada: {df.format(new Date(campaign.scheduledAt))}
                      </p>
                    ) : null}
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
                  <TableCell className="tabular-nums">
                    {pf.format(
                      campaign.sent > 0
                        ? campaign.delivered / campaign.sent
                        : 0,
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {pf.format(
                      campaign.delivered > 0
                        ? campaign.opened / campaign.delivered
                        : 0,
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <IconActionButton
                        label="Estadísticas"
                        onClick={() => setStatsCampaign(campaign)}
                      >
                        <BarChart3 className="size-4" />
                      </IconActionButton>
                      {campaign.status === 'draft' ? (
                        <IconActionButton
                          label="Continuar"
                          onClick={() => void continueDraft(campaign.id)}
                          disabled={openingDraftId === campaign.id}
                        >
                          {openingDraftId === campaign.id ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                          ) : (
                            <Pencil className="size-4" aria-hidden />
                          )}
                        </IconActionButton>
                      ) : null}
                      <IconActionButton
                        label="Ver"
                        href={`/api/internal-communications/campaigns/${encodeURIComponent(campaign.id)}/view`}
                      >
                        <ExternalLink className="size-4" aria-hidden />
                      </IconActionButton>
                      <IconActionButton
                        label="Duplicar"
                        onClick={() => void duplicateCampaign(campaign.id)}
                        disabled={duplicatingId === campaign.id}
                      >
                        {duplicatingId === campaign.id ? (
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        ) : (
                          <Copy className="size-4" aria-hidden />
                        )}
                      </IconActionButton>
                      {campaign.status === 'draft' ? (
                        <IconActionButton
                          label="Eliminar"
                          onClick={() => void deleteDraftCampaign(campaign)}
                          disabled={deletingId === campaign.id}
                        >
                          {deletingId === campaign.id ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                          ) : (
                            <Trash2 className="size-4" aria-hidden />
                          )}
                        </IconActionButton>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!campaigns.length ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <BarChart3 className="mx-auto mb-2 size-6" aria-hidden />
                    Aún no hay campañas internas.
                  </TableCell>
                </TableRow>
              ) : null}
          </TableBody>
        </Table>
      </TableShell>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 sm:px-6">
            <DialogTitle>
              {draftCampaignId ? 'Continuar campaña' : 'Nueva campaña interna'}
            </DialogTitle>
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
                    Elige un boletín del catálogo de comunicaciones internas o crea un borrador
                    nuevo.
                  </p>
                </div>
                {draftNewsletterId && selectedNewsletter?.id === draftNewsletterId ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                    <Badge variant="secondary">Borrador en el catálogo</Badge>
                    <span className="font-medium">{selectedNewsletter.title}</span>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a
                        href={`/admin/users?tab=contenido&edit=${encodeURIComponent(selectedNewsletter.id)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Pencil className="size-4" aria-hidden />
                        Editar
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void refreshAttachedNewsletter()}
                      disabled={refreshingContent}
                    >
                      {refreshingContent ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden />
                      )}
                      Actualizar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <NewsletterSearchSelect
                      id="internal-newsletter"
                      label="Boletín del catálogo"
                      newsletters={selectableNewsletters}
                      value={newsletterId}
                      onChange={selectNewsletter}
                      placeholder="Seleccionar"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void createNewNewsletterDraft()}
                      disabled={creatingNewsletter}
                    >
                      {creatingNewsletter ? (
                        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      ) : (
                        <Plus className="size-4" aria-hidden />
                      )}
                      {creatingNewsletter ? 'Creando…' : 'Crear boletín nuevo'}
                    </Button>
                  </div>
                )}
                <div className="space-y-2 border-t border-border/60 pt-5">
                  <Label htmlFor="internal-subject">Asunto del correo</Label>
                  <Input
                    id="internal-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Asunto que verán los destinatarios"
                    maxLength={300}
                  />
                </div>
                <div className="space-y-2">
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
                    Revisa el resumen y envía ahora o programa para más tarde.
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
                      {subject.trim() || '—'}
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
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="internal-schedule-mode"
                      checked={scheduleMode === 'now'}
                      onChange={() => setScheduleMode('now')}
                    />
                    Enviar ahora
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="internal-schedule-mode"
                      checked={scheduleMode === 'scheduled'}
                      onChange={() => setScheduleMode('scheduled')}
                    />
                    Programar envío
                  </label>
                </div>
                {scheduleMode === 'scheduled' ? (
                  <div className="max-w-xs space-y-2">
                    <Label htmlFor="internal-scheduled-at">Fecha y hora en Lima</Label>
                    <Input
                      id="internal-scheduled-at"
                      type="datetime-local"
                      value={scheduledAt}
                      min={minimumLimaDateTime()}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                  </div>
                ) : null}
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
                    {stepBlockReason.send
                      || Object.values(stepBlockReason).find(Boolean)
                      || 'Completa los pasos anteriores'}
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
                  {busy
                    ? 'Preparando…'
                    : scheduleMode === 'scheduled'
                      ? 'Programar'
                      : 'Enviar'}
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

      <Dialog
        open={Boolean(campaignPreview)}
        onOpenChange={(value) => {
          if (!value) setCampaignPreview(null);
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto p-0">
          {campaignPreview ? (
            <>
              <DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 sm:px-6">
                <DialogTitle>Vista previa: {campaignPreview.name}</DialogTitle>
                <DialogDescription>
                  Muestra el HTML congelado para esta campaña, aunque el boletín
                  original haya cambiado.
                </DialogDescription>
                <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">Asunto:</strong>{' '}
                    {campaignPreview.subject}
                  </span>
                  <span>
                    <strong className="text-foreground">De:</strong>{' '}
                    {campaignPreview.fromName} &lt;{campaignPreview.fromEmail}
                    &gt;
                  </span>
                </div>
              </DialogHeader>
              <iframe
                title={`Vista previa de ${campaignPreview.name}`}
                srcDoc={campaignPreview.previewHtml}
                sandbox=""
                referrerPolicy="no-referrer"
                className="h-[min(70vh,720px)] w-full bg-white"
              />
              <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
                <Button type="button" variant="outline" asChild>
                  <a
                    href={`/api/internal-communications/campaigns/${encodeURIComponent(campaignPreview.id)}/view`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Ver en navegador
                  </a>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statsCampaign)}
        onOpenChange={(openDialog) => {
          if (!openDialog) setStatsCampaign(null);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,900px)] w-[min(calc(100vw-2rem),48rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 border-b px-4 py-4">
            <DialogTitle>Estadísticas de la campaña</DialogTitle>
            <DialogDescription>
              Totales de envío y actividad de aperturas/clics por día
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
            {statsCampaign ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
                    <Spinner /> Cargando estadísticas...
                  </div>
                }
              >
                <MalichimpCampaignStatsPanel
                  campaignId={statsCampaign.id}
                  campaignName={statsCampaign.name}
                  loadStats={loadInternalStats}
                />
              </Suspense>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
