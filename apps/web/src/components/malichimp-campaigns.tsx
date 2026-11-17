import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronsUpDown,
  Copy,
  Eye,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
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
import { useConfirm } from '@/hooks/use-confirm';
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

type FlatOption = {
  id: string;
  label: string;
  groupName: string;
  contacts: number;
};

function limaDateTimeToIso(value: string): string {
  return new Date(`${value}:00-05:00`).toISOString();
}

function minimumLimaDateTime(): string {
  const lima = new Date(Date.now() - 5 * 60 * 60 * 1_000);
  return lima.toISOString().slice(0, 16);
}

function GroupOptionMultiSelect({
  id,
  label,
  hint,
  options,
  selectedIds,
  disabledIds = [],
  onChange,
  placeholder = 'Seleccionar opciones',
}: {
  id: string;
  label: string;
  hint?: string;
  options: FlatOption[];
  selectedIds: string[];
  disabledIds?: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.filter((option) => selectedIds.includes(option.id));
  const filtered = options.filter((option) => {
    const haystack = `${option.groupName} ${option.label}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function toggle(optionId: string, checked: boolean) {
    if (disabledIds.includes(optionId)) return;
    onChange(
      checked
        ? [...new Set([...selectedIds, optionId])]
        : selectedIds.filter((id) => id !== optionId),
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
              {selected.length
                ? `${selected.length} opción${selected.length === 1 ? '' : 'es'} seleccionada${selected.length === 1 ? '' : 's'}`
                : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-2">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar grupo u opción"
              className="pl-8"
              aria-label={`Buscar en ${label}`}
            />
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filtered.length ? filtered.map((option) => {
              const blocked = disabledIds.includes(option.id);
              const checked = selectedIds.includes(option.id);
              const inputId = `${id}-${option.id}`;
              return (
                <label
                  key={option.id}
                  htmlFor={inputId}
                  className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60 ${blocked ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    disabled={blocked}
                    onCheckedChange={(value) => toggle(option.id, value === true)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{option.groupName} › {option.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {nf.format(option.contacts)} elegible{option.contacts === 1 ? '' : 's'}
                      {blocked ? ' · ya incluida' : ''}
                    </span>
                  </span>
                </label>
              );
            }) : (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sin coincidencias</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <Badge key={option.id} variant="secondary" className="gap-1 pr-1">
              <span className="max-w-[14rem] truncate">{option.groupName} › {option.label}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                aria-label={`Quitar ${option.label}`}
                onClick={() => toggle(option.id, false)}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MalichimpCampaigns({ groups, delivery, senders, isAdmin }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
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
  const [creatingNewsletter, setCreatingNewsletter] = useState(false);
  const [showAdvancedSender, setShowAdvancedSender] = useState(false);
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
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const flatOptions = useMemo<FlatOption[]>(
    () => groups.flatMap((group) => group.options.map((option) => ({
      id: option.id,
      label: option.name,
      groupName: group.name,
      contacts: option.contacts,
    }))),
    [groups],
  );

  const selectableNewsletters = attachedNewsletter
    && !newsletters.some((newsletter) => newsletter.id === attachedNewsletter.id)
    ? [attachedNewsletter, ...newsletters]
    : newsletters;
  const selectedNewsletter = selectableNewsletters.find((newsletter) => newsletter.id === newsletterId) ?? null;
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
  const effectiveName = (
    name.trim()
    || selectedNewsletter?.title
    || `Envío ${new Date().toLocaleString('es-PE')}`
  ).trim();

  const audienceReady = Boolean(preview?.eligible);
  const senderReady = Boolean(
    fromName.trim()
      && senderEmails.includes(fromEmail)
      && maliPeEmailPattern.test(replyTo.trim()),
  );
  const contentReady = Boolean(selectedNewsletter) && Boolean(subject.trim()) && effectiveName.length >= 3;
  const scheduleReady = scheduleMode === 'now' || Boolean(
    scheduledAt && new Date(limaDateTimeToIso(scheduledAt)).getTime() > Date.now(),
  );
  const campaignReady = audienceReady && senderReady && contentReady && scheduleReady;

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
    setCreatingNewsletter(false);
    setShowAdvancedSender(false);
    setName('');
    setNewsletterId('');
    setSubject('');
    setFromName(delivery?.defaultFromName ?? 'MALI');
    setFromEmail(defaultSenderEmail);
    setReplyTo(defaultSenderEmail);
    setGroupOptionIds([]);
    setExcludeGroupOptionIds([]);
    setScheduleMode('now');
    setScheduledAt('');
    setPreview(null);
  }

  function openCampaign() {
    resetForm();
    setOpen(true);
  }

  function selectNewsletter(value: string) {
    const newsletter = selectableNewsletters.find((item) => item.id === value);
    setNewsletterId(value);
    if (!draftCampaignId) setDraftNewsletterId(null);
    setSubject((current) => !current.trim() || current === selectedNewsletter?.subject
      ? newsletter?.subject ?? ''
      : current);
    setName((current) => !current.trim() || current === selectedNewsletter?.title
      ? newsletter?.title ?? ''
      : current);
  }

  function setIncludeIds(next: string[]) {
    setGroupOptionIds(next);
    setExcludeGroupOptionIds((current) => current.filter((id) => !next.includes(id)));
    setPreview(null);
  }

  function setExcludeIds(next: string[]) {
    setExcludeGroupOptionIds(next.filter((id) => !groupOptionIds.includes(id)));
    setPreview(null);
  }

  async function createNewNewsletterDraft() {
    const title = (name.trim() || `Boletín ${new Date().toLocaleString('es-PE')}`).trim();
    if (title.length < 3) {
      toast.error('Indica un nombre de al menos 3 caracteres');
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

  async function hydrateDraftCampaign(detail: MalichimpCampaignDetailDto) {
    setDraftCampaignId(detail.id);
    setAttachedNewsletter(detail.newsletter);
    setDraftNewsletterId(detail.newsletter.status === 'draft' ? detail.newsletterId : null);
    setName(detail.name);
    setNewsletterId(detail.newsletterId);
    setSubject(detail.subject);
    setFromName(detail.fromName);
    setFromEmail(detail.fromEmail);
    setReplyTo(detail.replyTo);
    setGroupOptionIds(detail.groupOptionIds);
    setExcludeGroupOptionIds(detail.excludeGroupOptionIds);
    setScheduleMode('now');
    setScheduledAt('');
    setShowAdvancedSender(detail.replyTo !== detail.fromEmail);
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
    if (!groupOptionIds.length) {
      toast.error('Selecciona al menos una opción para incluir');
      return;
    }
    setPreviewBusy(true);
    try {
      const next = await api.previewMalichimpAudience(filters);
      setPreview(next);
      toast.success(`${nf.format(next.eligible)} destinatarios`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo calcular la audiencia');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function submitCampaign() {
    if (!campaignReady || !preview) return;
    const when = scheduleMode === 'scheduled' && scheduledAt
      ? `programada para ${df.format(new Date(limaDateTimeToIso(scheduledAt)))}`
      : 'envío inmediato';
    const ok = await confirm({
      title: scheduleMode === 'scheduled' ? 'Programar campaña' : 'Enviar campaña',
      description: `Se creará la campaña (${when}) hacia ${nf.format(preview.eligible)} destinatarios elegibles.`,
      confirmLabel: scheduleMode === 'scheduled' ? 'Programar' : 'Enviar',
    });
    if (!ok) return;

    setBusy(true);
    try {
      const payload = {
        name: effectiveName,
        newsletterId,
        ...(draftNewsletterId && draftNewsletterId === newsletterId
          ? { draftNewsletterId }
          : {}),
        subject: subject.trim(),
        fromName: fromName.trim(),
        fromEmail,
        replyTo: replyTo.trim(),
        ...filters,
        ...(scheduleMode === 'scheduled' && scheduledAt
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
          No hay boletines publicados. En Nueva campaña puedes crear un borrador en Boletines.
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
                  <TableCell className="min-w-[20rem]">
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
                          Ver
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
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto p-0">
          <DialogHeader className="border-b px-5 pb-4 pt-5 sm:px-6">
            <DialogTitle>
              {draftCampaignId ? 'Continuar campaña' : 'Nueva campaña'}
            </DialogTitle>
            <DialogDescription>
              Incluye audiencia, revisa destinatarios, elige el boletín y envía o programa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">1. Incluir opciones</p>
              <GroupOptionMultiSelect
                id="malichimp-include"
                label="Opciones a incluir"
                hint="Contactos en cualquiera de estas opciones (unión), suscritos y elegibles."
                options={flatOptions}
                selectedIds={groupOptionIds}
                onChange={setIncludeIds}
                placeholder="Seleccionar opciones para incluir"
              />
            </div>

            <div className="space-y-2 border-t border-border/60 pt-5">
              <p className="text-sm font-medium">Excluir opciones (opcional)</p>
              <GroupOptionMultiSelect
                id="malichimp-exclude"
                label="Opciones a excluir"
                hint="Si coinciden con una inclusión, la exclusión prevalece."
                options={flatOptions}
                selectedIds={excludeGroupOptionIds}
                disabledIds={groupOptionIds}
                onChange={setExcludeIds}
                placeholder="Ninguna exclusión"
              />
            </div>

            <div className="space-y-3 border-t border-border/60 pt-5">
              <p className="text-sm font-medium">2. Vista previa de destinatarios</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={previewBusy || !groupOptionIds.length}
                  onClick={() => void calculateAudience()}
                >
                  {previewBusy ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                  {previewBusy ? 'Calculando…' : preview ? 'Recalcular' : 'Mostrar destinatarios'}
                </Button>
                {preview ? (
                  <span className="text-sm text-muted-foreground">
                    {nf.format(preview.eligible)} destinatarios
                    {preview.excluded ? ` · ${nf.format(preview.excluded)} excluidos` : ''}
                  </span>
                ) : null}
              </div>
              {preview ? (
                <div className="max-h-56 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sample.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.name || '—'}</TableCell>
                          <TableCell>{row.email}</TableCell>
                        </TableRow>
                      ))}
                      {!preview.sample.length ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-muted-foreground">
                            Sin muestra disponible
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                  {preview.eligible > preview.sample.length ? (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                      Mostrando {preview.sample.length} de {nf.format(preview.eligible)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-sm font-medium">3. Boletín y asunto</p>
              {usingDraftContent && selectedNewsletter ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm">
                  <Badge variant="secondary">Borrador en Boletines</Badge>
                  <span className="font-medium">{selectedNewsletter.title}</span>
                  <Button type="button" size="sm" variant="outline" asChild>
                    <a
                      href={`/admin/newsletters?edit=${encodeURIComponent(selectedNewsletter.id)}`}
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
                <div className="space-y-2">
                  <Label htmlFor="malichimp-newsletter">Boletín publicado</Label>
                  <Select value={newsletterId} onValueChange={selectNewsletter}>
                    <SelectTrigger id="malichimp-newsletter" aria-label="Boletín publicado">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableNewsletters.map((newsletter) => (
                        <SelectItem key={newsletter.id} value={newsletter.id}>
                          {newsletter.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!newsletters.length ? (
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
                      {creatingNewsletter ? 'Creando…' : 'Crear borrador en Boletines'}
                    </Button>
                  ) : null}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="malichimp-subject">Asunto del correo</Label>
                  <Input
                    id="malichimp-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Asunto que verán los destinatarios"
                    maxLength={300}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="malichimp-campaign-name">Nombre del envío (opcional)</Label>
                  <Input
                    id="malichimp-campaign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Si lo dejas vacío, usamos el título del boletín"
                    maxLength={160}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="malichimp-from-email">Remitente</Label>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="malichimp-from-name">Nombre visible</Label>
                  <Input
                    id="malichimp-from-name"
                    value={fromName}
                    onChange={(event) => setFromName(event.target.value)}
                    placeholder="Museo de Arte de Lima - MALI"
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
                  {showAdvancedSender ? 'Ocultar opciones de respuesta' : 'Opciones de respuesta'}
                </button>
                {showAdvancedSender ? (
                  <div className="mt-2 space-y-2">
                    <Label htmlFor="malichimp-reply-to">Las respuestas llegarán a</Label>
                    <Input
                      id="malichimp-reply-to"
                      type="email"
                      value={replyTo}
                      onChange={(event) => setReplyTo(event.target.value)}
                      placeholder="correo@mali.pe"
                    />
                    <p className="text-xs text-muted-foreground">Debe ser un correo @mali.pe.</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 border-t border-border/60 pt-5">
              <p className="text-sm font-medium">4. Programación y envío</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="malichimp-schedule-mode"
                    checked={scheduleMode === 'now'}
                    onChange={() => setScheduleMode('now')}
                  />
                  Enviar ahora
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="malichimp-schedule-mode"
                    checked={scheduleMode === 'scheduled'}
                    onChange={() => setScheduleMode('scheduled')}
                  />
                  Programar envío
                </label>
              </div>
              {scheduleMode === 'scheduled' ? (
                <div className="max-w-xs space-y-2">
                  <Label htmlFor="malichimp-scheduled-at">Fecha y hora en Lima</Label>
                  <Input
                    id="malichimp-scheduled-at"
                    type="datetime-local"
                    value={scheduledAt}
                    min={minimumLimaDateTime()}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void submitCampaign()}
                  disabled={busy || !campaignReady}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {busy
                    ? 'Preparando…'
                    : scheduleMode === 'scheduled'
                      ? 'Programar'
                      : 'Enviar'}
                </Button>
                {!campaignReady ? (
                  <span className="text-xs text-muted-foreground">
                    {!groupOptionIds.length || !preview
                      ? 'Calcula la audiencia para continuar'
                      : !selectedNewsletter || !subject.trim()
                        ? 'Elige boletín y asunto'
                        : !senderReady
                          ? 'Revisa el remitente'
                          : 'Indica una fecha futura'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
                    Lista para confirmar
                  </span>
                )}
              </div>
            </div>
          </div>
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
