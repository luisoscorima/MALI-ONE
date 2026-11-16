import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Layers3, Loader2, Plus, RefreshCw, Send, Users } from 'lucide-react';
import type {
  MalichimpAudiencePreviewDto,
  MalichimpCampaignDto,
  MalichimpGroupDto,
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
  deliveryConfigured: boolean;
  isAdmin: boolean;
};

export function MalichimpCampaigns({ groups, deliveryConfigured, isAdmin }: Props) {
  const toast = useToast();
  const [campaigns, setCampaigns] = useState<MalichimpCampaignDto[]>([]);
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<MalichimpAudiencePreviewDto | null>(null);
  const [name, setName] = useState('');
  const [newsletterId, setNewsletterId] = useState('');
  const [replyTo, setReplyTo] = useState('tecnologia@mali.pe');
  const [groupOptionIds, setGroupOptionIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');

  const availableGroups = groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.contacts > 0),
    }))
    .filter((group) => group.options.length > 0);
  const hasGroupOptions = availableGroups.length > 0;

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

  const filters = { groupOptionIds };

  function resetForm() {
    setName('');
    setNewsletterId('');
    setReplyTo('tecnologia@mali.pe');
    setGroupOptionIds([]);
    setScheduledAt('');
    setPreview(null);
  }

  function toggleGroupOption(optionId: string, checked: boolean) {
    setGroupOptionIds((current) => checked
      ? [...new Set([...current, optionId])]
      : current.filter((id) => id !== optionId));
    setPreview(null);
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

  async function createCampaign() {
    if (!preview || !groupOptionIds.length || !name.trim() || !newsletterId || !replyTo.trim()) return;
    setBusy(true);
    try {
      const result = await api.createMalichimpCampaign({
        name: name.trim(),
        newsletterId,
        replyTo: replyTo.trim(),
        ...filters,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      });
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
            onClick={() => setOpen(true)}
            disabled={!isAdmin || !deliveryConfigured || !newsletters.length || !hasGroupOptions}
          >
            <Plus className="size-4" aria-hidden /> Nueva campaña
          </Button>
        </div>
      </div>

      {!newsletters.length ? (
        <AlertBanner variant="info">
          Publica al menos un boletín antes de crear una campaña.
        </AlertBanner>
      ) : null}

      {!hasGroupOptions ? (
        <AlertBanner variant="info">
          Importa la audiencia de Mailchimp para recuperar las opciones de grupo antes de crear campañas.
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
                </TableRow>
              ))}
              {!campaigns.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
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
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva campaña MALICHIMP</DialogTitle>
            <DialogDescription>
              Selecciona el boletín y una o más opciones de grupo. La audiencia se calcula y congela al confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="malichimp-campaign-name">Nombre interno</Label>
              <Input
                id="malichimp-campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Boletín mensual – noviembre"
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label>Boletín publicado</Label>
              <Select value={newsletterId} onValueChange={setNewsletterId}>
                <SelectTrigger aria-label="Boletín publicado"><SelectValue placeholder="Selecciona un boletín" /></SelectTrigger>
                <SelectContent>
                  {newsletters.map((newsletter) => (
                    <SelectItem key={newsletter.id} value={newsletter.id}>{newsletter.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="malichimp-reply-to">Las respuestas llegarán a</Label>
              <Input
                id="malichimp-reply-to"
                type="email"
                value={replyTo}
                onChange={(event) => setReplyTo(event.target.value)}
              />
            </div>
            <fieldset className="space-y-3 sm:col-span-2">
              <legend className="font-medium">Grupos destinatarios</legend>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    El contacto recibirá el boletín si pertenece a cualquiera de las opciones seleccionadas.
                  </p>
                </div>
                <Badge
                  variant={groupOptionIds.length ? 'default' : 'secondary'}
                  aria-live="polite"
                >
                  {groupOptionIds.length} seleccionada{groupOptionIds.length === 1 ? '' : 's'}
                </Badge>
              </div>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border bg-muted/10 p-3">
                {availableGroups.map((group) => (
                  <section key={group.id} aria-labelledby={`malichimp-group-${group.id}`}>
                    <h3
                      id={`malichimp-group-${group.id}`}
                      className="mb-2 flex items-center gap-2 text-sm font-semibold"
                    >
                      <Layers3 className="size-4 text-muted-foreground" aria-hidden />
                      {group.name}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.options.map((option) => {
                        const checked = groupOptionIds.includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-background px-3 py-2 transition-colors hover:bg-muted/50 has-data-checked:border-primary/50 has-data-checked:bg-primary/5"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => toggleGroupOption(option.id, value === true)}
                              aria-label={`${group.name}: ${option.name}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-sm font-medium">{option.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {nf.format(option.contacts)} destinatario{option.contacts === 1 ? '' : 's'} elegible{option.contacts === 1 ? '' : 's'}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Cada correo se incluirá una sola vez, aunque pertenezca a varias opciones.
              </p>
            </fieldset>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="malichimp-scheduled-at">Programar envío (opcional)</Label>
              <Input
                id="malichimp-scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            {preview ? (
              <div className="space-y-3" aria-live="polite">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><p className="text-xs text-muted-foreground">Suscritos</p><p className="text-xl font-semibold">{nf.format(preview.subscribed)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Elegibles</p><p className="text-xl font-semibold text-primary">{nf.format(preview.eligible)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Excluidos</p><p className="text-xl font-semibold">{nf.format(preview.excluded)}</p></div>
                </div>
                {preview.sample.length ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Muestra de destinatarios</p>
                    <p className="text-xs text-muted-foreground">
                      {preview.sample.slice(0, 5).map((item) => item.email).join(' · ')}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" aria-hidden /> Calcula la audiencia antes de enviar.
                </div>
                <Button
                  variant="outline"
                  onClick={() => void calculateAudience()}
                  disabled={previewBusy || !groupOptionIds.length}
                >
                  {previewBusy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Users className="size-4" aria-hidden />}
                  {previewBusy ? 'Calculando…' : 'Calcular audiencia'}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            {preview ? (
              <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>
                Cambiar segmentación
              </Button>
            ) : null}
            <Button
              onClick={() => void createCampaign()}
              disabled={busy || !preview?.eligible || !groupOptionIds.length || !name.trim() || !newsletterId || !replyTo.trim()}
            >
              {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
              {busy ? 'Encolando…' : scheduledAt ? 'Programar campaña' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
