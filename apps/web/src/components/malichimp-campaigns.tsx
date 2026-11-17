import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  ExternalLink,
  FileText,
  Layers3,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  UserRound,
  Users,
} from 'lucide-react';
import type {
  EmailSenderDto,
  MalichimpAudiencePreviewDto,
  MalichimpCampaignDetailDto,
  MalichimpCampaignDto,
  MalichimpGroupDto,
  MalichimpStatsDto,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

type ContentMode = 'existing' | 'new';

const nf = new Intl.NumberFormat('es-PE');
const df = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const maliPeEmailPattern = /^[^@\s]+@mali\.pe$/i;

const statusLabel: Record<MalichimpCampaignDto['status'], string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  queued: 'En cola',
  sending: 'Enviando',
  completed: 'Completada',
  failed: 'Fallida',
};

type Props = {
  groups: MalichimpGroupDto[];
  delivery: MalichimpStatsDto['delivery'] | null;
  senders: EmailSenderDto[];
  isAdmin: boolean;
};

type CampaignSectionProps = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  icon: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
};

function CampaignSection({
  id,
  title,
  description,
  complete,
  icon,
  summary,
  children,
}: CampaignSectionProps) {
  return (
    <section aria-labelledby={`${id}-title`} className="overflow-hidden rounded-xl border bg-background">
      <div className="flex flex-wrap items-start gap-3 border-b bg-muted/20 p-4 sm:flex-nowrap">
        <span className="mt-0.5 text-muted-foreground" aria-hidden>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`${id}-title`} className="font-semibold">{title}</h3>
            {complete ? (
              <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" aria-hidden /> Listo
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Circle className="size-3.5" aria-hidden /> Pendiente
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {summary ? <div className="text-sm text-muted-foreground sm:text-right">{summary}</div> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function limaDateTimeToIso(value: string): string {
  return new Date(`${value}:00-05:00`).toISOString();
}

function minimumLimaDateTime(): string {
  const lima = new Date(Date.now() - 5 * 60 * 60 * 1_000);
  return lima.toISOString().slice(0, 16);
}

export function MalichimpCampaigns({ groups, delivery, senders, isAdmin }: Props) {
  const toast = useToast();
  const senderEmails = senders.map((sender) => sender.email);
  const defaultSenderEmail = delivery?.defaultFromEmail
    && senderEmails.includes(delivery.defaultFromEmail)
    ? delivery.defaultFromEmail
    : senderEmails[0] ?? '';
  const [campaigns, setCampaigns] = useState<MalichimpCampaignDto[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [attachedNewsletter, setAttachedNewsletter] = useState<NewsletterDto | null>(null);
  const [draftNewsletterId, setDraftNewsletterId] = useState<string | null>(null);
  const [contentMode, setContentMode] = useState<ContentMode>('existing');
  const [newNewsletterTitle, setNewNewsletterTitle] = useState('');
  const [creatingNewsletter, setCreatingNewsletter] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [openingDraftId, setOpeningDraftId] = useState<string | null>(null);
  const [campaignPreview, setCampaignPreview] = useState<MalichimpCampaignDetailDto | null>(null);
  const [previewCampaignId, setPreviewCampaignId] = useState<string | null>(null);
  const [refreshingContent, setRefreshingContent] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<MalichimpAudiencePreviewDto | null>(null);
  const [name, setName] = useState('');
  const [newsletterId, setNewsletterId] = useState('');
  const [subject, setSubject] = useState('');
  const [fromName, setFromName] = useState(delivery?.defaultFromName ?? 'MALI');
  const [fromEmail, setFromEmail] = useState(defaultSenderEmail);
  const [replyTo, setReplyTo] = useState(defaultSenderEmail);
  const [groupOptionIds, setGroupOptionIds] = useState<string[]>([]);
  const [excludeGroupOptionIds, setExcludeGroupOptionIds] = useState<string[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const selectableNewsletters = attachedNewsletter
    && !newsletters.some((newsletter) => newsletter.id === attachedNewsletter.id)
    ? [attachedNewsletter, ...newsletters]
    : newsletters;
  const selectedNewsletter = (
    contentMode === 'new' && attachedNewsletter && attachedNewsletter.id === newsletterId
      ? attachedNewsletter
      : selectableNewsletters.find((newsletter) => newsletter.id === newsletterId)
  ) ?? null;
  const usingDraftContent = Boolean(
    selectedNewsletter
      && (
        draftCampaignId
        || (draftNewsletterId && selectedNewsletter.id === draftNewsletterId)
      ),
  );
  const availableGroups = groups.filter((group) => group.options.length > 0);
  const hasGroupOptions = availableGroups.length > 0;
  const filters = { groupOptionIds, excludeGroupOptionIds };

  const audienceReady = Boolean(preview?.eligible);
  const senderReady = Boolean(
    fromName.trim()
      && senderEmails.includes(fromEmail)
      && maliPeEmailPattern.test(replyTo.trim()),
  );
  const subjectReady = name.trim().length >= 3 && Boolean(subject.trim());
  const scheduleReady = !scheduleEnabled || Boolean(
    scheduledAt && new Date(limaDateTimeToIso(scheduledAt)).getTime() > Date.now(),
  );
  const contentReady = Boolean(selectedNewsletter);
  const readiness = [audienceReady, senderReady, subjectReady, scheduleReady, contentReady];
  const readyCount = readiness.filter(Boolean).length;
  const campaignReady = readyCount === readiness.length;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [nextCampaigns, nextNewsletters] = await Promise.all([
        api.listMalichimpCampaigns(),
        api.listMalichimpNewsletters(),
      ]);
      setCampaigns(nextCampaigns);
      setNewsletters(nextNewsletters);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las campañas');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  function resetForm() {
    setDraftCampaignId(null);
    setAttachedNewsletter(null);
    setDraftNewsletterId(null);
    setContentMode('existing');
    setNewNewsletterTitle('');
    setCreatingNewsletter(false);
    setName('');
    setNewsletterId('');
    setSubject('');
    setFromName(delivery?.defaultFromName ?? 'MALI');
    setFromEmail(defaultSenderEmail);
    setReplyTo(defaultSenderEmail);
    setGroupOptionIds([]);
    setExcludeGroupOptionIds([]);
    setScheduleEnabled(false);
    setScheduledAt('');
    setPreview(null);
  }

  function openCampaign() {
    resetForm();
    setOpen(true);
  }

  function selectContentMode(mode: string) {
    const next = mode === 'new' ? 'new' : 'existing';
    if (next === contentMode) return;
    setContentMode(next);
    setNewsletterId('');
    setAttachedNewsletter(null);
    setDraftNewsletterId(null);
    if (next === 'new') {
      setNewNewsletterTitle((current) => current.trim() || name.trim());
    }
  }

  function selectNewsletter(value: string) {
    const newsletter = selectableNewsletters.find((item) => item.id === value);
    setNewsletterId(value);
    setDraftNewsletterId(null);
    setSubject((current) => !current.trim() || current === selectedNewsletter?.subject
      ? newsletter?.subject ?? ''
      : current);
    setName((current) => !current.trim() || current === selectedNewsletter?.title
      ? newsletter?.title ?? ''
      : current);
  }

  async function createNewNewsletterDraft() {
    const title = newNewsletterTitle.trim() || name.trim();
    if (title.length < 3) {
      toast.error('Indica un título de al menos 3 caracteres para el boletín');
      return;
    }
    setCreatingNewsletter(true);
    try {
      const created = await api.createMalichimpNewsletterDraft({
        title,
        subject: subject.trim() || title,
      });
      setAttachedNewsletter(created);
      setDraftNewsletterId(created.id);
      setNewsletterId(created.id);
      setNewNewsletterTitle(created.title);
      setSubject((current) => current.trim() || created.subject);
      setName((current) => current.trim() || created.title);
      toast.success('Borrador creado en Boletines');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo crear el boletín');
    } finally {
      setCreatingNewsletter(false);
    }
  }

  function selectFromEmail(value: string) {
    setReplyTo((current) => !current || current === fromEmail ? value : current);
    setFromEmail(value);
  }

  function toggleAudienceOption(
    optionId: string,
    mode: 'include' | 'exclude',
    checked: boolean,
  ) {
    if (mode === 'include') {
      setGroupOptionIds((current) => checked
        ? [...new Set([...current, optionId])]
        : current.filter((id) => id !== optionId));
      if (checked) setExcludeGroupOptionIds((current) => current.filter((id) => id !== optionId));
    } else {
      setExcludeGroupOptionIds((current) => checked
        ? [...new Set([...current, optionId])]
        : current.filter((id) => id !== optionId));
      if (checked) setGroupOptionIds((current) => current.filter((id) => id !== optionId));
    }
    setPreview(null);
  }

  async function hydrateDraftCampaign(detail: MalichimpCampaignDetailDto) {
    setDraftCampaignId(detail.id);
    setAttachedNewsletter(detail.newsletter);
    setDraftNewsletterId(detail.newsletter.status === 'draft' ? detail.newsletterId : null);
    setContentMode('new');
    setNewNewsletterTitle(detail.newsletter.title);
    setName(detail.name);
    setNewsletterId(detail.newsletterId);
    setSubject(detail.subject);
    setFromName(detail.fromName);
    setFromEmail(detail.fromEmail);
    setReplyTo(detail.replyTo);
    setGroupOptionIds(detail.groupOptionIds);
    setExcludeGroupOptionIds(detail.excludeGroupOptionIds);
    setScheduleEnabled(false);
    setScheduledAt('');
    setOpen(true);
    setPreviewBusy(true);
    try {
      setPreview(await api.previewMalichimpAudience({
        groupOptionIds: detail.groupOptionIds,
        excludeGroupOptionIds: detail.excludeGroupOptionIds,
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
      await hydrateDraftCampaign(await api.getMalichimpCampaign(campaignId));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo abrir el borrador');
    } finally {
      setOpeningDraftId(null);
    }
  }

  async function duplicateCampaign(campaignId: string) {
    setDuplicatingId(campaignId);
    try {
      const draft = await api.duplicateMalichimpCampaign(campaignId);
      await load(true);
      toast.success('Campaña duplicada como borrador');
      await hydrateDraftCampaign(draft);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo duplicar la campaña');
    } finally {
      setDuplicatingId(null);
    }
  }

  async function openCampaignPreview(campaignId: string) {
    setPreviewCampaignId(campaignId);
    try {
      setCampaignPreview(await api.getMalichimpCampaign(campaignId));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo cargar la vista previa');
    } finally {
      setPreviewCampaignId(null);
    }
  }

  async function refreshAttachedNewsletter() {
    const newsletterToRefresh = draftNewsletterId || attachedNewsletter?.id || newsletterId;
    if (!newsletterToRefresh) return;
    setRefreshingContent(true);
    try {
      if (draftCampaignId) {
        const detail = await api.getMalichimpCampaign(draftCampaignId);
        setAttachedNewsletter(detail.newsletter);
      } else {
        setAttachedNewsletter(await api.getMalichimpNewsletter(newsletterToRefresh));
      }
      toast.success('Vista previa actualizada desde Boletines');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo actualizar el contenido');
    } finally {
      setRefreshingContent(false);
    }
  }

  async function calculateAudience() {
    if (!groupOptionIds.length) return;
    setPreviewBusy(true);
    try {
      setPreview(await api.previewMalichimpAudience(filters));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo calcular la audiencia');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function submitCampaign() {
    if (!campaignReady || !preview) return;
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        newsletterId,
        ...(draftNewsletterId && draftNewsletterId === newsletterId
          ? { draftNewsletterId }
          : {}),
        subject: subject.trim(),
        fromName: fromName.trim(),
        fromEmail,
        replyTo: replyTo.trim(),
        ...filters,
        ...(scheduleEnabled && scheduledAt
          ? { scheduledAt: limaDateTimeToIso(scheduledAt) }
          : {}),
      };
      const result = draftCampaignId
        ? await api.sendMalichimpDraftCampaign(draftCampaignId, payload)
        : await api.createMalichimpCampaign(payload);
      toast.success(
        result.status === 'scheduled'
          ? `Campaña programada para ${nf.format(result.totalRecipients)} destinatarios`
          : `Campaña encolada para ${nf.format(result.totalRecipients)} destinatarios`,
      );
      setOpen(false);
      resetForm();
      await load(true);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo crear la campaña');
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
          <h2 className="text-base font-semibold">Campañas de correo</h2>
          <p className="text-sm text-muted-foreground">
            Cada envío congela el boletín y su audiencia; nunca consulta los CRM de WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} aria-label="Actualizar campañas">
            <RefreshCw className="size-4" aria-hidden /> Actualizar
          </Button>
          <Button
            onClick={openCampaign}
            disabled={!isAdmin || !delivery?.configured || !hasGroupOptions || !senders.length}
          >
            <Plus className="size-4" aria-hidden /> Nueva campaña
          </Button>
        </div>
      </div>

      {!newsletters.length ? (
        <AlertBanner variant="info">
          No hay boletines publicados. En Nueva campaña puedes usar <strong>Crear nuevo</strong> para abrir un borrador en Boletines.
        </AlertBanner>
      ) : null}

      {!hasGroupOptions ? (
        <AlertBanner variant="info">
          Importa la audiencia de Mailchimp para recuperar las opciones de grupo antes de crear campañas.
        </AlertBanner>
      ) : null}

      {isAdmin && !senders.length ? (
        <AlertBanner variant="info">
          Agrega al menos un remitente @mali.pe en la pestaña Remitentes antes de crear campañas.
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
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="min-w-64">
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.newsletterTitle} · {df.format(new Date(campaign.createdAt))}
                    </p>
                    {campaign.scheduledAt ? (
                      <p className="text-xs text-muted-foreground">
                        Programada: {df.format(new Date(campaign.scheduledAt))}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={campaign.status === 'failed' ? 'destructive' : campaign.status === 'completed' ? 'default' : 'secondary'}>
                      {statusLabel[campaign.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{nf.format(campaign.sent)} / {nf.format(campaign.totalRecipients)}</TableCell>
                  <TableCell>{nf.format(campaign.delivered)}</TableCell>
                  <TableCell>{nf.format(campaign.bounced)}</TableCell>
                  <TableCell>{nf.format(campaign.suppressed)}</TableCell>
                  <TableCell>{nf.format(campaign.opened)}</TableCell>
                  <TableCell>{nf.format(campaign.clicked)}</TableCell>
                  <TableCell className="min-w-[32rem]">
                    <div className="flex flex-wrap justify-end gap-2">
                      {campaign.status === 'draft' && isAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void continueDraft(campaign.id)}
                          disabled={openingDraftId === campaign.id}
                        >
                          {openingDraftId === campaign.id ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                          ) : (
                            <Pencil className="size-4" aria-hidden />
                          )}
                          Continuar
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void openCampaignPreview(campaign.id)}
                        disabled={previewCampaignId === campaign.id}
                      >
                        {previewCampaignId === campaign.id ? (
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        ) : (
                          <Eye className="size-4" aria-hidden />
                        )}
                        Vista previa
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a
                          href={`/api/malichimp/campaigns/${encodeURIComponent(campaign.id)}/view`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          Ver en navegador
                        </a>
                      </Button>
                      {isAdmin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void duplicateCampaign(campaign.id)}
                          disabled={duplicatingId === campaign.id}
                        >
                          {duplicatingId === campaign.id ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                          ) : (
                            <Copy className="size-4" aria-hidden />
                          )}
                          Duplicar
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!campaigns.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    <BarChart3 className="mx-auto mb-2 size-6" aria-hidden />
                    Aún no hay campañas MALICHIMP.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto p-0">
          <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6">
            <DialogTitle>
              {draftCampaignId ? 'Continuar campaña duplicada' : 'Nueva campaña MALICHIMP'}
            </DialogTitle>
            <DialogDescription>
              {draftCampaignId
                ? 'Revisa la copia del boletín y la configuración heredada antes de programar o enviar.'
                : 'Completa la audiencia, el remitente, el asunto, la hora y el contenido antes de enviar.'}
            </DialogDescription>
            <div className="pt-3" aria-label={`${readyCount} de 5 elementos listos`}>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">{readyCount}/5 elementos listos</span>
                <span className="text-muted-foreground">La audiencia y el contenido se congelan al confirmar</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5" aria-hidden>
                {readiness.map((ready, index) => (
                  <span
                    key={index}
                    className={`h-1.5 rounded-full ${ready ? 'bg-emerald-600' : 'bg-muted'}`}
                  />
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 bg-muted/10 p-4 sm:p-6">
            <CampaignSection
              id="campaign-to"
              title="Para"
              description="Incluye contactos por grupos y, si lo necesitas, descarta grupos completos. Excluir siempre prevalece."
              complete={audienceReady}
              icon={<Users className="size-5" />}
              summary={preview ? `${nf.format(preview.eligible)} destinatarios` : undefined}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={groupOptionIds.length ? 'default' : 'secondary'}>
                    {groupOptionIds.length} para incluir
                  </Badge>
                  <Badge variant={excludeGroupOptionIds.length ? 'destructive' : 'outline'}>
                    {excludeGroupOptionIds.length} para excluir
                  </Badge>
                </div>

                <div className="space-y-4 rounded-lg border bg-background p-3">
                  {availableGroups.map((group) => (
                    <fieldset key={group.id} className="space-y-2">
                      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
                        <Layers3 className="size-4 text-muted-foreground" aria-hidden />
                        {group.name}
                      </legend>
                      <div className="overflow-hidden rounded-md border">
                        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center bg-muted/40 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                          <span className="text-left">Opción</span>
                          <span>Incluir</span>
                          <span>Excluir</span>
                        </div>
                        {group.options.map((option) => (
                          <div
                            key={option.id}
                            className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-stretch border-t"
                          >
                            <div className="min-w-0 px-3 py-2.5">
                              <p className="break-words text-sm font-medium">{option.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {nf.format(option.contacts)} elegible{option.contacts === 1 ? '' : 's'}
                              </p>
                            </div>
                            <label className="flex min-h-11 cursor-pointer items-center justify-center border-l hover:bg-muted/40">
                              <Checkbox
                                checked={groupOptionIds.includes(option.id)}
                                onCheckedChange={(value) => toggleAudienceOption(option.id, 'include', value === true)}
                              />
                              <span className="sr-only">Incluir {group.name}: {option.name}</span>
                            </label>
                            <label className="flex min-h-11 cursor-pointer items-center justify-center border-l hover:bg-muted/40">
                              <Checkbox
                                checked={excludeGroupOptionIds.includes(option.id)}
                                onCheckedChange={(value) => toggleAudienceOption(option.id, 'exclude', value === true)}
                              />
                              <span className="sr-only">Excluir {group.name}: {option.name}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>

                {preview ? (
                  <div className="space-y-3 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4" aria-live="polite">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Coinciden con PARA</p>
                        <p className="text-xl font-semibold">{nf.format(preview.included)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Excluidos por regla</p>
                        <p className="text-xl font-semibold">{nf.format(preview.excluded)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Destinatarios finales</p>
                        <p className="text-xl font-semibold text-primary">{nf.format(preview.eligible)}</p>
                      </div>
                    </div>
                    {preview.sample.length ? (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Muestra</p>
                        <p className="break-words text-xs text-muted-foreground">
                          {preview.sample.slice(0, 5).map((item) => item.email).join(' · ')}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Cada correo aparece una sola vez aunque coincida con varias inclusiones.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void calculateAudience()}
                    disabled={previewBusy || !groupOptionIds.length}
                  >
                    {previewBusy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Users className="size-4" aria-hidden />}
                    {previewBusy ? 'Calculando…' : preview ? 'Recalcular audiencia' : 'Calcular audiencia'}
                  </Button>
                </div>
              </div>
            </CampaignSection>

            <CampaignSection
              id="campaign-from"
              title="De"
              description="Define el nombre visible y el correo autorizado que aparecerán como remitente."
              complete={senderReady}
              icon={<UserRound className="size-5" />}
              summary={senderReady ? `${fromName} <${fromEmail}>` : undefined}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="malichimp-from-name">Nombre del remitente</Label>
                  <Input
                    id="malichimp-from-name"
                    value={fromName}
                    onChange={(event) => setFromName(event.target.value)}
                    placeholder="Museo de Arte de Lima - MALI"
                    maxLength={160}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="malichimp-from-email">Correo del remitente</Label>
                  <Select value={fromEmail} onValueChange={selectFromEmail}>
                    <SelectTrigger id="malichimp-from-email" aria-label="Correo del remitente">
                      <SelectValue placeholder="Selecciona un remitente" />
                    </SelectTrigger>
                    <SelectContent>
                      {senders.map((sender) => (
                        <SelectItem key={sender.id} value={sender.email}>{sender.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fromEmail ? (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Remitente habilitado en MALI ONE
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="malichimp-reply-to">Las respuestas llegarán a</Label>
                  <Input
                    id="malichimp-reply-to"
                    type="email"
                    value={replyTo}
                    onChange={(event) => setReplyTo(event.target.value)}
                    placeholder="correo@mali.pe"
                  />
                  <p className="text-xs text-muted-foreground">
                    Puede ser distinto del remitente, pero debe ser un correo @mali.pe.
                  </p>
                </div>
              </div>
            </CampaignSection>

            <CampaignSection
              id="campaign-subject"
              title="Asunto"
              description="El asunto se propone desde el boletín, pero puedes ajustarlo sólo para esta campaña."
              complete={subjectReady}
              icon={<Mail className="size-5" />}
              summary={subject.trim() || undefined}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="malichimp-subject">Asunto del correo</Label>
                  <Input
                    id="malichimp-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Escribe el asunto que verán los destinatarios"
                    maxLength={300}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="malichimp-campaign-name">Nombre interno de la campaña</Label>
                  <Input
                    id="malichimp-campaign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Boletín mensual – noviembre"
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">Sólo lo verá el equipo dentro de MALI ONE.</p>
                </div>
              </div>
            </CampaignSection>

            <CampaignSection
              id="campaign-send-time"
              title="Hora de envío"
              description="Envía al confirmar o deja la campaña programada para una fecha futura."
              complete={scheduleReady}
              icon={<CalendarClock className="size-5" />}
              summary={scheduleEnabled && scheduledAt ? df.format(new Date(limaDateTimeToIso(scheduledAt))) : 'Enviar ahora'}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <Label htmlFor="malichimp-schedule-enabled">Programar para más adelante</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Desactivado significa que se enviará apenas confirmes.
                    </p>
                  </div>
                  <Switch
                    id="malichimp-schedule-enabled"
                    checked={scheduleEnabled}
                    onCheckedChange={setScheduleEnabled}
                  />
                </div>
                {scheduleEnabled ? (
                  <div className="space-y-2">
                    <Label htmlFor="malichimp-scheduled-at">Fecha y hora en Lima</Label>
                    <Input
                      id="malichimp-scheduled-at"
                      type="datetime-local"
                      value={scheduledAt}
                      min={minimumLimaDateTime()}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Zona horaria: America/Lima (UTC-5).</p>
                  </div>
                ) : null}
              </div>
            </CampaignSection>

            <CampaignSection
              id="campaign-content"
              title="Contenido y vista previa"
              description={usingDraftContent
                ? 'El contenido vive en Boletines para editarlo; al confirmar se congelará su versión actual.'
                : 'Usa un boletín publicado o crea uno nuevo en la biblioteca de Boletines.'}
              complete={contentReady}
              icon={<FileText className="size-5" />}
              summary={selectedNewsletter?.title}
            >
              <div className="space-y-4">
                {!draftCampaignId ? (
                  <Tabs value={contentMode} onValueChange={selectContentMode}>
                    <TabsList aria-label="Origen del contenido">
                      <TabsTrigger value="existing">Usar existente</TabsTrigger>
                      <TabsTrigger value="new">Crear nuevo</TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}

                {contentMode === 'existing' && !draftCampaignId ? (
                  <div className="space-y-2">
                    <Label htmlFor="malichimp-newsletter">Boletín publicado</Label>
                    <Select value={newsletterId} onValueChange={selectNewsletter}>
                      <SelectTrigger id="malichimp-newsletter" aria-label="Boletín publicado">
                        <SelectValue placeholder="Selecciona un boletín" />
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
                ) : null}

                {contentMode === 'new' || draftCampaignId ? (
                  <div className="space-y-3 rounded-lg border p-4">
                    {!selectedNewsletter || selectedNewsletter.id !== draftNewsletterId ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="malichimp-new-newsletter-title">Título del boletín</Label>
                          <Input
                            id="malichimp-new-newsletter-title"
                            value={newNewsletterTitle}
                            onChange={(event) => setNewNewsletterTitle(event.target.value)}
                            placeholder="Ej. Boletín marzo"
                            maxLength={200}
                            disabled={Boolean(draftCampaignId)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Se creará un borrador en Boletines. Ahí editas el diseño; MALICHIMP solo lo envía.
                          </p>
                        </div>
                        {!draftCampaignId ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void createNewNewsletterDraft()}
                            disabled={creatingNewsletter || (newNewsletterTitle.trim() || name.trim()).length < 3}
                          >
                            {creatingNewsletter ? (
                              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                            ) : (
                              <Plus className="size-4" aria-hidden />
                            )}
                            {creatingNewsletter ? 'Creando…' : 'Crear borrador en Boletines'}
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">Borrador en Boletines</Badge>
                        <span className="font-medium">{selectedNewsletter.title}</span>
                      </div>
                    )}
                  </div>
                ) : null}

                {selectedNewsletter ? (
                  <div className="overflow-hidden rounded-lg border bg-background">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Eye className="size-4 text-muted-foreground" aria-hidden /> Vista previa del boletín
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedNewsletter.title}</Badge>
                        {selectedNewsletter.status === 'draft' ? (
                          <Badge variant="secondary">Borrador editable</Badge>
                        ) : null}
                        {usingDraftContent ? (
                          <>
                            <Button type="button" size="sm" variant="outline" asChild>
                              <a
                                href={`/admin/newsletters?edit=${encodeURIComponent(selectedNewsletter.id)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Pencil className="size-4" aria-hidden />
                                Editar en Boletines
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
                              {refreshingContent ? 'Actualizando…' : 'Actualizar contenido'}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <iframe
                      title={`Vista previa de ${selectedNewsletter.title}`}
                      srcDoc={selectedNewsletter.htmlBody}
                      sandbox=""
                      referrerPolicy="no-referrer"
                      className="h-[520px] w-full bg-white"
                    />
                  </div>
                ) : null}
              </div>
            </CampaignSection>
          </div>

          <DialogFooter className="border-t bg-background px-5 py-4 sm:px-6">
            <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              {campaignReady ? (
                <><CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> Campaña lista para confirmar</>
              ) : (
                <><Circle className="size-4" aria-hidden /> Faltan {5 - readyCount} elemento{5 - readyCount === 1 ? '' : 's'}</>
              )}
            </div>
            <Button
              type="button"
              onClick={() => void submitCampaign()}
              disabled={busy || !campaignReady}
            >
              {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {busy ? 'Preparando…' : scheduleEnabled ? 'Programar campaña' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(campaignPreview)}
        onOpenChange={(value) => { if (!value) setCampaignPreview(null); }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto p-0">
          {campaignPreview ? (
            <>
              <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6">
                <DialogTitle>Vista previa: {campaignPreview.name}</DialogTitle>
                <DialogDescription>
                  {campaignPreview.status === 'draft'
                    ? 'Muestra la versión actual del boletín editable asociado al borrador.'
                    : 'Muestra el HTML congelado para esta campaña, aunque el boletín original haya cambiado.'}
                </DialogDescription>
                <div className="flex flex-wrap gap-x-5 gap-y-1 pt-2 text-sm text-muted-foreground">
                  <span><strong className="text-foreground">Asunto:</strong> {campaignPreview.subject}</span>
                  <span>
                    <strong className="text-foreground">De:</strong>{' '}
                    {campaignPreview.fromName} &lt;{campaignPreview.fromEmail}&gt;
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
                    href={`/api/malichimp/campaigns/${encodeURIComponent(campaignPreview.id)}/view`}
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
    </div>
  );
}
