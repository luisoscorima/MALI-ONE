import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import type { EmailCampaignDto } from '@mali-one/shared';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import {
  Button,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

type CrmContact = {
  contact_id: number;
  name: string;
  last_name: string;
  phone: string;
  email: string | null;
  opt_in: boolean;
  opt_in_email: boolean;
  segment_slugs: string[];
  attributes: Record<string, string>;
};

type PublishedNewsletter = {
  id: string;
  slug: string;
  title: string;
  subject: string;
};

export function CrmPamPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('contacts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');

  const [newsletters, setNewsletters] = useState<PublishedNewsletter[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaignDto[]>([]);
  const [newsletterId, setNewsletterId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [filterAttrKey, setFilterAttrKey] = useState('plan');
  const [filterAttrValue, setFilterAttrValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [audienceInfo, setAudienceInfo] = useState('');

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listCrmPamContacts({
        q: q || undefined,
        attr_key: attrKey || undefined,
        attr_value: attrValue || undefined,
        page,
        limit: 100,
      });
      setContacts(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar contactos');
    } finally {
      setLoading(false);
    }
  }, [q, attrKey, attrValue, page]);

  const loadCampaigns = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([
        api.listCrmPamNewsletters(),
        api.listEmailCampaigns(),
      ]);
      setNewsletters(n);
      setCampaigns(c);
      setNewsletterId((prev) => prev || n[0]?.id || '');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar campañas');
    }
  }, [toast]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (tab === 'send') void loadCampaigns();
  }, [tab, loadCampaigns]);

  async function handleCreateAndSend() {
    if (!newsletterId) {
      toast.error('Elige un boletín publicado');
      return;
    }
    const ok = await confirm({
      title: 'Enviar boletín',
      description:
        'Se creará una campaña y se enviará por SES a contactos PAM con email y opt-in. ¿Continuar?',
      confirmLabel: 'Enviar',
    });
    if (!ok) return;

    setSaving(true);
    try {
      const campaign = await api.createEmailCampaign({
        newsletterId,
        name:
          campaignName ||
          `Envío ${new Date().toLocaleString('es-PE')}`,
        audienceArea: 'pam',
        audienceAttrKey: filterAttrKey || undefined,
        audienceAttrValue: filterAttrValue || undefined,
      });
      const preview = await api.previewEmailAudience(campaign.id);
      setAudienceInfo(
        `${preview.total} destinatarios. Muestra: ${preview.sample
          .slice(0, 5)
          .map((s) => s.email)
          .join(', ')}`,
      );
      await api.sendEmailCampaign(campaign.id);
      toast.success('Envío iniciado');
      await loadCampaigns();
      setTab('send');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const header = [
      'id',
      'nombre',
      'apellido',
      'telefono',
      'email',
      'opt_in_email',
      'segmentos',
      'plan',
      'mp_status',
    ];
    const rows = contacts.map((c) =>
      [
        c.contact_id,
        c.name,
        c.last_name,
        c.phone,
        c.email ?? '',
        c.opt_in_email ? '1' : '0',
        c.segment_slugs.join(';'),
        c.attributes.plan ?? '',
        c.attributes.mp_status ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-pam-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM PAM"
        description="Lista de contactos desde WhatsApp (fuente de verdad). Desde aquí envías boletines ya publicados."
      />

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="send">Enviar boletín</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="nombre, email, teléfono"
                className="w-56"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ak">Atributo</Label>
              <Input
                id="ak"
                value={attrKey}
                onChange={(e) => setAttrKey(e.target.value)}
                placeholder="plan"
                className="w-32"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="av">Valor</Label>
              <Input
                id="av"
                value={attrValue}
                onChange={(e) => setAttrValue(e.target.value)}
                placeholder="amigo"
                className="w-32"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setPage(1);
                void loadContacts();
              }}
            >
              <RefreshCw className="mr-1 size-4" />
              Filtrar
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              Exportar CSV
            </Button>
            <span className="text-sm text-muted-foreground">
              {total} contactos
            </span>
          </div>

          {loading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : contacts.length === 0 ? (
            <EmptyState
              title="Sin contactos"
              description="Configura WHATSAPP_CRM_* o sincroniza registros PAM."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Opt-in email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>MP</TableHead>
                    <TableHead>Segmentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow key={c.contact_id}>
                      <TableCell>
                        {c.name} {c.last_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {c.phone}
                      </TableCell>
                      <TableCell>{c.email ?? '—'}</TableCell>
                      <TableCell>{c.opt_in_email ? 'Sí' : 'No'}</TableCell>
                      <TableCell>{c.attributes.plan ?? '—'}</TableCell>
                      <TableCell>{c.attributes.mp_status ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        {c.segment_slugs.join(', ') || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={contacts.length === 0 || page * 100 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="send" className="space-y-4">
          <div className="grid gap-4 rounded-lg border border-border/60 p-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Boletín publicado</Label>
                <Select value={newsletterId} onValueChange={setNewsletterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {newsletters.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cname">Nombre del envío</Label>
                <Input
                  id="cname"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Filtro atributo (opcional)</Label>
                <Input
                  value={filterAttrKey}
                  onChange={(e) => setFilterAttrKey(e.target.value)}
                  placeholder="plan"
                />
              </div>
              <div className="space-y-1">
                <Label>Valor</Label>
                <Input
                  value={filterAttrValue}
                  onChange={(e) => setFilterAttrValue(e.target.value)}
                  placeholder="amigo"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={() => void handleCreateAndSend()}
                disabled={saving || !newsletterId}
              >
                <Send className="mr-1 size-4" />
                Crear y enviar
              </Button>
            </div>
          </div>

          {audienceInfo ? <AlertBanner>{audienceInfo}</AlertBanner> : null}

          {campaigns.length === 0 ? (
            <EmptyState
              title="Sin envíos"
              description="Los envíos aparecerán aquí."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Envío</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Enviados</TableHead>
                  <TableHead>Opens / Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.status}</TableCell>
                    <TableCell>
                      {c.sentCount}/{c.totalRecipients}
                    </TableCell>
                    <TableCell>
                      {c.openCount} / {c.clickCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
