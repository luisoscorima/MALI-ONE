import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { Mail, RefreshCw, Save, Send } from 'lucide-react';
import type { EmailCampaignDto, PamRegistrationDto } from '@mali-one/shared';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { IconActionButton } from '@/components/icon-action-button';
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

const MP_STATUSES = [
  { value: '', label: '— Sin estado —' },
  { value: 'pending', label: 'pending' },
  { value: 'in_process', label: 'in_process' },
  { value: 'approved', label: 'approved' },
  { value: 'authorized', label: 'authorized' },
  { value: 'rejected', label: 'rejected' },
  { value: 'cancelled', label: 'cancelled' },
  { value: 'refunded', label: 'refunded' },
  { value: 'charged_back', label: 'charged_back' },
];

const CONFIRMED_MP = ['approved', 'authorized'];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE');
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-PE');
}

function toDateInput(iso: string | null) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function CrmPamPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('contacts');
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [payments, setPayments] = useState<PamRegistrationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');

  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null,
  );
  const [draftMp, setDraftMp] = useState<Record<string, string>>({});
  const [draftExpiry, setDraftExpiry] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newsletters, setNewsletters] = useState<PublishedNewsletter[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaignDto[]>([]);
  const [newsletterId, setNewsletterId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [filterAttrKey, setFilterAttrKey] = useState('plan');
  const [filterAttrValue, setFilterAttrValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [audienceInfo, setAudienceInfo] = useState('');

  const paymentsById = useMemo(() => {
    const map = new Map<string, PamRegistrationDto>();
    for (const p of payments) map.set(p.id, p);
    return map;
  }, [payments]);

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

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const rows = await api.listPamRegistrations();
      setPayments(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar pagos');
    } finally {
      setPaymentsLoading(false);
    }
  }, [toast]);

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
    void loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    if (tab === 'send') void loadCampaigns();
  }, [tab, loadCampaigns]);

  function updatePaymentInState(updated: PamRegistrationDto) {
    setPayments((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    );
  }

  async function savePayment(id: string) {
    setSavingId(id);
    try {
      const mpStatus = draftMp[id];
      const expiryDate = draftExpiry[id];
      const updated = await api.updatePamRegistration(id, {
        ...(mpStatus !== undefined ? { mpStatus } : {}),
        ...(expiryDate !== undefined ? { expiryDate } : {}),
      });
      updatePaymentInState(updated);
      toast.success('Pago actualizado (sync a CRM WhatsApp)');
      void loadContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar pago');
    } finally {
      setSavingId(null);
    }
  }

  async function resendWelcome(id: string) {
    try {
      const updated = await api.resendPamWelcome(id);
      updatePaymentInState(updated);
      toast.success('Correo de bienvenida reenviado (SMTP)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al reenviar correo');
    }
  }

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
      'dni',
      'plan',
      'frecuencia',
      'mp_status_crm',
      'mp_status_ledger',
      'expiry_ledger',
      'welcome',
      'ciudad',
      'distrito',
      'genero',
      'fecha_nacimiento',
      'como_te_enteraste',
      'opt_in_email',
      'segmentos',
      'payment_id',
    ];
    const rows = contacts.map((c) => {
      const ledger = c.attributes.payment_id
        ? paymentsById.get(c.attributes.payment_id)
        : undefined;
      return [
        c.contact_id,
        c.name,
        c.last_name,
        c.phone,
        c.email ?? '',
        c.attributes.dni ?? '',
        c.attributes.plan ?? '',
        c.attributes.frecuencia ?? '',
        c.attributes.mp_status ?? '',
        ledger?.mpStatus ?? '',
        ledger?.expiryDate ?? '',
        ledger?.welcomeEmail ?? '',
        c.attributes.ciudad ?? '',
        c.attributes.distrito ?? '',
        c.attributes.genero ?? '',
        c.attributes.fecha_nacimiento ?? '',
        c.attributes.como_te_enteraste ?? '',
        c.opt_in_email ? '1' : '0',
        c.segment_slugs.join(';'),
        c.attributes.payment_id ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });
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

  function renderPaymentEditor(p: PamRegistrationDto) {
    const mpValue =
      draftMp[p.id] !== undefined ? draftMp[p.id] : (p.mpStatus ?? '');
    const expiryValue =
      draftExpiry[p.id] !== undefined
        ? draftExpiry[p.id]
        : toDateInput(p.expiryDate);

    return (
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm sm:col-span-2 lg:col-span-3">
          <span className="text-xs text-muted-foreground">Checkout URL</span>
          <p className="break-all font-mono text-xs">{p.checkoutUrl || '—'}</p>
        </div>
        <div className="text-sm">
          <span className="text-xs text-muted-foreground">Acepta privacidad</span>
          <p>{p.aceptaPrivacidad ? 'Sí' : 'No'}</p>
        </div>
        <div className="text-sm">
          <span className="text-xs text-muted-foreground">Aviso caducidad</span>
          <p>{p.expiryNotice}</p>
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Estado Mercado Pago</span>
          <Select
            value={mpValue || '__none__'}
            onValueChange={(value) =>
              setDraftMp((prev) => ({
                ...prev,
                [p.id]: value === '__none__' ? '' : value,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="— Sin estado —" />
            </SelectTrigger>
            <SelectContent>
              {MP_STATUSES.map((s) => (
                <SelectItem
                  key={s.value || 'empty'}
                  value={s.value || '__none__'}
                >
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fecha caducidad</span>
          <Input
            type="date"
            value={expiryValue}
            onChange={(e) =>
              setDraftExpiry((prev) => ({
                ...prev,
                [p.id]: e.target.value,
              }))
            }
          />
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
          <IconActionButton
            label="Guardar pago"
            variant="default"
            disabled={savingId === p.id}
            onClick={() => void savePayment(p.id)}
          >
            <Save className="size-4" />
          </IconActionButton>
          <IconActionButton
            label="Reenviar bienvenida SMTP"
            disabled={!p.mpStatus || !CONFIRMED_MP.includes(p.mpStatus)}
            onClick={() => void resendWelcome(p.id)}
          >
            <Mail className="size-4" />
          </IconActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM PAM"
        description="Cruce de contactos WhatsApp con el ledger de pagos MP. Aquí marcas pagos y disparas welcome SMTP."
      />

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
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
            <TableSkeleton rows={8} cols={8} />
          ) : contacts.length === 0 ? (
            <EmptyState
              title="Sin contactos"
              description="Configura WHATSAPP_CRM_* o espera altas del widget PAM (sync al CRM)."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Plan (CRM)</TableHead>
                    <TableHead>MP ledger</TableHead>
                    <TableHead>Caducidad</TableHead>
                    <TableHead>Welcome</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Opt-in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => {
                    const ledger = c.attributes.payment_id
                      ? paymentsById.get(c.attributes.payment_id)
                      : undefined;
                    const mp =
                      ledger?.mpStatus ?? c.attributes.mp_status ?? '—';
                    const pending =
                      !ledger?.mpStatus ||
                      !CONFIRMED_MP.includes(ledger.mpStatus);

                    return (
                      <TableRow key={c.contact_id}>
                        <TableCell>
                          {c.name} {c.last_name}
                          {ledger && pending ? (
                            <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                              pago pend.
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {c.phone}
                        </TableCell>
                        <TableCell>{c.email ?? '—'}</TableCell>
                        <TableCell>{c.attributes.dni ?? '—'}</TableCell>
                        <TableCell>
                          {c.attributes.plan ?? '—'}
                          {c.attributes.frecuencia
                            ? ` / ${c.attributes.frecuencia}`
                            : ''}
                        </TableCell>
                        <TableCell>{mp}</TableCell>
                        <TableCell>
                          {ledger ? formatDate(ledger.expiryDate) : '—'}
                        </TableCell>
                        <TableCell>{ledger?.welcomeEmail ?? '—'}</TableCell>
                        <TableCell>{c.attributes.ciudad ?? '—'}</TableCell>
                        <TableCell>{c.opt_in_email ? 'Sí' : 'No'}</TableCell>
                      </TableRow>
                    );
                  })}
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

        <TabsContent value="payments" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Ledger local (`PamRegistration`). Marca MP approved/authorized para
              caducidad + welcome SMTP; se re-sincroniza al CRM WhatsApp.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPayments()}
            >
              <RefreshCw className="mr-1 size-4" />
              Actualizar
            </Button>
          </div>

          {paymentsLoading ? (
            <TableSkeleton rows={8} cols={6} />
          ) : payments.length === 0 ? (
            <EmptyState
              title="Sin pagos"
              description="Los registros del widget PAM aparecerán aquí."
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Registrado</TableHead>
                    <TableHead>Persona</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>MP</TableHead>
                    <TableHead>Caducidad</TableHead>
                    <TableHead>Welcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const pending =
                      !p.mpStatus || !CONFIRMED_MP.includes(p.mpStatus);
                    const expanded = expandedPaymentId === p.id;

                    return (
                      <Fragment key={p.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => {
                            setExpandedPaymentId((prev) =>
                              prev === p.id ? null : p.id,
                            );
                            setDraftMp((prev) => ({
                              ...prev,
                              [p.id]: p.mpStatus ?? '',
                            }));
                            setDraftExpiry((prev) => ({
                              ...prev,
                              [p.id]: toDateInput(p.expiryDate),
                            }));
                          }}
                        >
                          <TableCell>
                            <span className="mr-1 text-muted-foreground">
                              {expanded ? '▾' : '▸'}
                            </span>
                            {formatDateTime(p.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div>
                              {p.nombres} {p.apellidos}
                              {pending ? (
                                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                                  pendiente
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.correo} · {p.celular}
                            </div>
                          </TableCell>
                          <TableCell>
                            {p.plan} / {p.frecuencia}
                          </TableCell>
                          <TableCell>{p.mpStatus ?? '—'}</TableCell>
                          <TableCell>{formatDate(p.expiryDate)}</TableCell>
                          <TableCell>{p.welcomeEmail}</TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={6} className="p-4">
                              {renderPaymentEditor(p)}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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
