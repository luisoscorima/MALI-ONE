import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Loader2, RefreshCw, Search, Send, Users } from 'lucide-react';
import type { InternalAudienceDto, InternalCampaignDto, NewsletterDto } from '@mali-one/shared';
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
  CardDescription,
  CardHeader,
  CardTitle,
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
const df = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

function Metric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{nf.format(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function InternalCommunicationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [audience, setAudience] = useState<InternalAudienceDto | null>(null);
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [campaigns, setCampaigns] = useState<InternalCampaignDto[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newsletterId, setNewsletterId] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [nextAudience, nextNewsletters, nextCampaigns] = await Promise.all([
        api.getInternalAudience(30),
        api.listInternalNewsletters(),
        api.listInternalCampaigns(),
      ]);
      setAudience(nextAudience);
      setNewsletters(nextNewsletters);
      setCampaigns(nextCampaigns);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar Comunicación Interna');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void api.listInternalCampaigns().then(setCampaigns).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return audience?.members ?? [];
    return (audience?.members ?? []).filter((member) =>
      `${member.name} ${member.email} ${member.orgUnitPath}`.toLowerCase().includes(term),
    );
  }, [audience, query]);

  const choose = (limit: number) => {
    const ordered = [...(audience?.members ?? [])]
      .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt))
      .slice(0, limit)
      .map((member) => member.email);
    setSelected(new Set(ordered));
  };

  const toggle = (email: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else if (next.size < 200) next.add(email);
      else toast.error('El máximo por envío es 200 destinatarios');
      return next;
    });
  };

  const submit = async () => {
    if (!newsletterId || !name.trim() || selected.size === 0) return;
    setSending(true);
    try {
      await api.createInternalCampaign({ name: name.trim(), newsletterId, recipients: [...selected] });
      toast.success(`Envío encolado para ${selected.size} personas`);
      setSelected(new Set());
      setName('');
      setConfirmOpen(false);
      await load(true);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo crear el envío');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <PageLoading variant="table" />;

  const latest = campaigns[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Comunicación Interna"
        description="Envía boletines a cuentas activas de Google Workspace y revisa su entrega e interacción."
        actions={<Button variant="outline" onClick={() => void load()}><RefreshCw className="size-4" />Actualizar</Button>}
      />

      {error && <AlertBanner>{error}</AlertBanner>}
      {audience && <AlertBanner variant="info">{audience.note} La selección se vuelve a validar antes de encolar el envío.</AlertBanner>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Audiencia disponible" value={audience?.members.length ?? 0} hint="Acceso a Workspace en los últimos 30 días" />
        <Metric label="Seleccionados" value={selected.size} hint="Máximo 200 por envío" />
        <Metric label="Entregados" value={latest?.delivered ?? 0} hint={latest ? `Última campaña: ${latest.name}` : 'Sin envíos todavía'} />
        <Metric label="Aperturas" value={latest?.opened ?? 0} hint={latest ? `${latest.clicked} clics en la última campaña` : 'Se medirán aperturas y clics'} />
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2"><Send className="size-4" />Preparar comunicación</CardTitle>
          <CardDescription>Usa un boletín publicado y selecciona hasta 200 destinatarios internos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Nombre interno de la campaña</Label>
              <Input id="campaign-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Comunicado interno – noviembre" maxLength={160} />
            </div>
            <div className="space-y-2">
              <Label>Boletín publicado</Label>
              <Select value={newsletterId} onValueChange={setNewsletterId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un boletín" /></SelectTrigger>
                <SelectContent>{newsletters.map((newsletter) => <SelectItem key={newsletter.id} value={newsletter.id}>{newsletter.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => choose(100)} disabled={!audience?.members.length}><Users className="size-4" />Seleccionar 100</Button>
            <Button variant="outline" onClick={() => choose(200)} disabled={!audience?.members.length}><Users className="size-4" />Seleccionar 200</Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())} disabled={!selected.size}>Limpiar selección</Button>
            <div className="relative ml-auto w-full sm:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar persona o correo" /></div>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead className="w-12"><span className="sr-only">Seleccionar</span></TableHead><TableHead>Persona</TableHead><TableHead>Unidad</TableHead><TableHead>Último acceso</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((member) => (
                  <TableRow key={member.id} data-state={selected.has(member.email) ? 'selected' : undefined}>
                    <TableCell><Checkbox checked={selected.has(member.email)} onCheckedChange={() => toggle(member.email)} aria-label={`Seleccionar ${member.email}`} /></TableCell>
                    <TableCell><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.email}</p></TableCell>
                    <TableCell>{member.orgUnitPath}</TableCell>
                    <TableCell className="whitespace-nowrap">{df.format(new Date(member.lastActivityAt))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3">
            <p className="text-sm"><strong>{selected.size}</strong> destinatarios seleccionados</p>
            <Button onClick={() => setConfirmOpen(true)} disabled={!newsletterId || !name.trim() || selected.size === 0 || user?.role !== 'admin'}><Send className="size-4" />Revisar y enviar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><BarChart3 className="size-4" />Historial y estadísticas</CardTitle><CardDescription>Resultados recibidos desde SES y el seguimiento del boletín.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Campaña</TableHead><TableHead>Estado</TableHead><TableHead>Enviados</TableHead><TableHead>Entregados</TableHead><TableHead>Rebotes</TableHead><TableHead>Aperturas</TableHead><TableHead>Clics</TableHead></TableRow></TableHeader>
            <TableBody>{campaigns.map((campaign) => <TableRow key={campaign.id}><TableCell><p className="font-medium">{campaign.name}</p><p className="text-xs text-muted-foreground">{campaign.newsletterTitle} · {df.format(new Date(campaign.createdAt))}</p></TableCell><TableCell><Badge variant={campaign.status === 'completed' ? 'default' : 'secondary'}>{campaign.status === 'completed' ? 'Completado' : campaign.status === 'sending' ? 'Enviando' : campaign.status === 'queued' ? 'En cola' : 'Fallido'}</Badge></TableCell><TableCell>{campaign.sent}/{campaign.totalRecipients}</TableCell><TableCell>{campaign.delivered}</TableCell><TableCell>{campaign.bounced}</TableCell><TableCell>{campaign.opened}</TableCell><TableCell>{campaign.clicked}</TableCell></TableRow>)}</TableBody>
          </Table>
          {!campaigns.length && <div className="py-10 text-center text-sm text-muted-foreground">Aún no hay comunicaciones internas.</div>}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar envío interno</DialogTitle><DialogDescription>Se encolará “{name}” para {selected.size} cuentas @mali.pe. Esta acción iniciará el envío real mediante Amazon SES.</DialogDescription></DialogHeader>
          <div className="rounded-lg border p-4 text-sm"><p className="flex items-center gap-2 font-medium"><CheckCircle2 className="size-4 text-primary" />Boletín: {newsletters.find((item) => item.id === newsletterId)?.title}</p><p className="mt-2 text-muted-foreground">Destinatarios: {selected.size} · Regla: acceso a Workspace en los últimos 30 días</p></div>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => void submit()} disabled={sending}>{sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{sending ? 'Encolando…' : 'Confirmar envío'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
