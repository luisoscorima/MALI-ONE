import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { Columns3, Link2, Mail, Plus, RefreshCw, Save, Send } from 'lucide-react';
import type { EmailCampaignDto, PamRegistrationDto } from '@mali-one/shared';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { IconActionButton } from '@/components/icon-action-button';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  dni: string | null;
  opt_in: boolean;
  opt_in_email: boolean;
  segment_slugs: string[];
  attributes: Record<string, string>;
};

type AttrDef = {
  id: number;
  segment_slug: string | null;
  slug: string;
  label: string;
  field_type: string;
  sort_order: number;
  required: boolean;
  active: boolean;
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
const HIDDEN_ATTR_SLUGS = new Set(['dni', 'email', 'correo']);
const COLS_STORAGE_KEY = 'crm-pam-contact-cols-v1';

type FixedColId =
  | 'name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'dni'
  | 'segments'
  | 'mp_ledger'
  | 'expiry'
  | 'welcome';

const FIXED_COLUMNS: Array<{ id: FixedColId; label: string; locked?: boolean }> =
  [
    { id: 'name', label: 'Nombre', locked: true },
    { id: 'last_name', label: 'Apellido' },
    { id: 'phone', label: 'Teléfono' },
    { id: 'email', label: 'Email' },
    { id: 'dni', label: 'DNI' },
    { id: 'segments', label: 'Segmentos' },
    { id: 'mp_ledger', label: 'MP ledger' },
    { id: 'expiry', label: 'Caducidad' },
    { id: 'welcome', label: 'Welcome' },
  ];

const DEFAULT_VISIBLE_COLS: FixedColId[] = [
  'name',
  'last_name',
  'phone',
  'email',
  'dni',
  'segments',
  'mp_ledger',
  'expiry',
  'welcome',
];

function attrColId(slug: string) {
  return `attr:${slug}`;
}

function loadStoredVisibleCols(): Set<string> | null {
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return null;
  }
}

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

function dash(v: string | null | undefined) {
  const s = String(v ?? '').trim();
  return s || '—';
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
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');

  const [expandedContactId, setExpandedContactId] = useState<number | null>(
    null,
  );
  const [draftContact, setDraftContact] = useState<{
    name: string;
    last_name: string;
    email: string;
    dni: string;
    opt_in_email: boolean;
    attributes: Record<string, string>;
  } | null>(null);
  const [savingContactId, setSavingContactId] = useState<number | null>(null);

  const [newAttrSlug, setNewAttrSlug] = useState('');
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [creatingAttr, setCreatingAttr] = useState(false);

  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null,
  );
  const [draftMp, setDraftMp] = useState<Record<string, string>>({});
  const [draftExpiry, setDraftExpiry] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const [newsletters, setNewsletters] = useState<PublishedNewsletter[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaignDto[]>([]);
  const [newsletterId, setNewsletterId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [filterAttrKey, setFilterAttrKey] = useState('plan');
  const [filterAttrValue, setFilterAttrValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [audienceInfo, setAudienceInfo] = useState('');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    () => loadStoredVisibleCols() ?? new Set(DEFAULT_VISIBLE_COLS),
  );

  const areaAttrDefs = useMemo(
    () =>
      attrDefs
        .filter(
          (d) =>
            d.active &&
            !d.segment_slug &&
            !HIDDEN_ATTR_SLUGS.has(d.slug),
        )
        .sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)),
    [attrDefs],
  );

  useEffect(() => {
    localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const isColVisible = useCallback(
    (id: string) => visibleCols.has(id),
    [visibleCols],
  );

  const visibleAttrDefs = useMemo(
    () => areaAttrDefs.filter((d) => isColVisible(attrColId(d.slug))),
    [areaAttrDefs, isColVisible],
  );

  const visibleColCount = useMemo(() => {
    let n = 0;
    for (const col of FIXED_COLUMNS) {
      if (isColVisible(col.id)) n += 1;
    }
    n += visibleAttrDefs.length;
    return Math.max(n, 1);
  }, [isColVisible, visibleAttrDefs.length]);

  function toggleCol(id: string, locked?: boolean) {
    if (locked) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      next.add('name');
      return next;
    });
  }

  function showAllCols() {
    setVisibleCols(
      new Set([
        ...FIXED_COLUMNS.map((c) => c.id),
        ...areaAttrDefs.map((d) => attrColId(d.slug)),
      ]),
    );
  }

  function showDefaultCols() {
    setVisibleCols(new Set(DEFAULT_VISIBLE_COLS));
  }

  const paymentsById = useMemo(() => {
    const map = new Map<string, PamRegistrationDto>();
    for (const p of payments) map.set(p.id, p);
    return map;
  }, [payments]);

  const [linkedPaymentIds, setLinkedPaymentIds] = useState<Set<string>>(
    new Set(),
  );
  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, linkedPage] = await Promise.all([
        api.listCrmPamContacts({
          q: q || undefined,
          attr_key: attrKey || undefined,
          attr_value: attrValue || undefined,
          page,
          limit: 100,
        }),
        api.listCrmPamContacts({
          attr_key: 'payment_id',
          limit: 500,
          page: 1,
        }),
      ]);
      setContacts(data.items);
      setTotal(data.total);
      const linked = new Set<string>();
      for (const c of linkedPage.items) {
        const pid = c.attributes.payment_id?.trim();
        if (pid) linked.add(pid);
      }
      setLinkedPaymentIds(linked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar contactos');
    } finally {
      setLoading(false);
    }
  }, [q, attrKey, attrValue, page]);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const rows = await api.listCrmPamPayments().catch(() =>
        api.listPamRegistrations(),
      );
      setPayments(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar pagos');
    } finally {
      setPaymentsLoading(false);
    }
  }, [toast]);

  const loadAttrDefs = useCallback(async () => {
    try {
      const defs = await api.listCrmPamAttributeDefinitions();
      setAttrDefs(defs);
    } catch {
      setAttrDefs([]);
    }
  }, []);

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
    void loadAttrDefs();
  }, [loadPayments, loadAttrDefs]);

  useEffect(() => {
    if (tab === 'send') void loadCampaigns();
  }, [tab, loadCampaigns]);

  function openContactEditor(c: CrmContact) {
    setExpandedContactId((prev) =>
      prev === c.contact_id ? null : c.contact_id,
    );
    setDraftContact({
      name: c.name,
      last_name: c.last_name,
      email: c.email ?? '',
      dni: c.dni ?? c.attributes.dni ?? '',
      opt_in_email: c.opt_in_email,
      attributes: { ...c.attributes },
    });
  }

  async function saveContact(contactId: number) {
    if (!draftContact) return;
    setSavingContactId(contactId);
    try {
      await api.patchCrmPamContact(contactId, {
        name: draftContact.name,
        last_name: draftContact.last_name,
        email: draftContact.email || null,
        dni: draftContact.dni || null,
        opt_in_email: draftContact.opt_in_email,
        attributes: draftContact.attributes,
      });
      toast.success('Contacto actualizado en WhatsApp CRM');
      await loadContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSavingContactId(null);
    }
  }

  async function createAttrDef() {
    if (!newAttrSlug.trim() || !newAttrLabel.trim()) {
      toast.error('Slug y etiqueta son obligatorios');
      return;
    }
    setCreatingAttr(true);
    try {
      await api.createCrmPamAttributeDefinition({
        scope: 'area',
        slug: newAttrSlug.trim().toLowerCase(),
        label: newAttrLabel.trim(),
        field_type: 'text',
      });
      toast.success('Atributo creado en WhatsApp');
      setNewAttrSlug('');
      setNewAttrLabel('');
      await loadAttrDefs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear atributo');
    } finally {
      setCreatingAttr(false);
    }
  }

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

  async function linkPayment(id: string) {
    try {
      await api.linkCrmPamPayment(id);
      toast.success('Pago vinculado (payment_id en contacto)');
      await Promise.all([loadContacts(), loadPayments()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al vincular');
    }
  }

  async function linkAllByPhone() {
    const ok = await confirm({
      title: 'Vincular por teléfono',
      description:
        'Por cada teléfono, se asignará el pago más reciente como payment_id del contacto WhatsApp. ¿Continuar?',
      confirmLabel: 'Vincular',
    });
    if (!ok) return;
    setLinking(true);
    try {
      const result = await api.linkCrmPamPaymentsByPhone();
      toast.success(
        `Vinculados ${result.linked} teléfonos` +
          (result.errors.length ? ` (${result.errors.length} errores)` : ''),
      );
      await Promise.all([loadContacts(), loadPayments()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al vincular');
    } finally {
      setLinking(false);
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
    const dynamicHeaders = areaAttrDefs.map((d) => d.slug);
    const header = [
      'id',
      'nombre',
      'apellido',
      'telefono',
      'email',
      'dni',
      'segmentos',
      ...dynamicHeaders,
      'payment_id',
      'mp_status_ledger',
      'expiry_ledger',
      'welcome',
      'opt_in_email',
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
        c.dni ?? c.attributes.dni ?? '',
        c.segment_slugs.join(';'),
        ...dynamicHeaders.map((slug) => c.attributes[slug] ?? ''),
        c.attributes.payment_id ?? '',
        ledger?.mpStatus ?? '',
        ledger?.expiryDate ?? '',
        ledger?.welcomeEmail ?? '',
        c.opt_in_email ? '1' : '0',
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM PAM"
        description="Centralizadora: contactos WhatsApp + ledger de pagos (cruce por payment_id)."
      />

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="payments">Pagos</TabsTrigger>
          <TabsTrigger value="attrs">Atributos</TabsTrigger>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Columns3 className="mr-1 size-4" />
                  Columnas ({visibleColCount})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-80 w-64 overflow-y-auto"
              >
                <DropdownMenuLabel>Columnas fijas</DropdownMenuLabel>
                {FIXED_COLUMNS.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={isColVisible(col.id)}
                    disabled={col.locked}
                    onCheckedChange={() => toggleCol(col.id, col.locked)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {col.label}
                    {col.locked ? ' (fija)' : ''}
                  </DropdownMenuCheckboxItem>
                ))}
                {areaAttrDefs.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Atributos WhatsApp</DropdownMenuLabel>
                    {areaAttrDefs.map((d) => (
                      <DropdownMenuCheckboxItem
                        key={d.id}
                        checked={isColVisible(attrColId(d.slug))}
                        onCheckedChange={() =>
                          toggleCol(attrColId(d.slug))
                        }
                        onSelect={(e) => e.preventDefault()}
                      >
                        {d.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <button
                  type="button"
                  className="relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onClick={showAllCols}
                >
                  Mostrar todas
                </button>
                <button
                  type="button"
                  className="relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
                  onClick={showDefaultCols}
                >
                  Restablecer default
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
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
              <Table
                className="w-max min-w-full"
                style={{ minWidth: `${Math.max(visibleColCount * 140, 640)}px` }}
              >
                <TableHeader>
                  <TableRow>
                    {isColVisible('name') ? (
                      <TableHead className="sticky left-0 z-10 bg-background">
                        Nombre
                      </TableHead>
                    ) : null}
                    {isColVisible('last_name') ? (
                      <TableHead>Apellido</TableHead>
                    ) : null}
                    {isColVisible('phone') ? (
                      <TableHead>Teléfono</TableHead>
                    ) : null}
                    {isColVisible('email') ? <TableHead>Email</TableHead> : null}
                    {isColVisible('dni') ? <TableHead>DNI</TableHead> : null}
                    {isColVisible('segments') ? (
                      <TableHead>Segmentos</TableHead>
                    ) : null}
                    {visibleAttrDefs.map((d) => (
                      <TableHead key={d.id}>{d.label}</TableHead>
                    ))}
                    {isColVisible('mp_ledger') ? (
                      <TableHead>MP ledger</TableHead>
                    ) : null}
                    {isColVisible('expiry') ? (
                      <TableHead>Caducidad</TableHead>
                    ) : null}
                    {isColVisible('welcome') ? (
                      <TableHead>Welcome</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => {
                    const ledger = c.attributes.payment_id
                      ? paymentsById.get(c.attributes.payment_id)
                      : undefined;
                    const mp =
                      ledger?.mpStatus ?? c.attributes.mp_status ?? null;
                    const pending =
                      ledger &&
                      (!ledger.mpStatus ||
                        !CONFIRMED_MP.includes(ledger.mpStatus));
                    const expanded = expandedContactId === c.contact_id;

                    return (
                      <Fragment key={c.contact_id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => openContactEditor(c)}
                        >
                          {isColVisible('name') ? (
                            <TableCell className="sticky left-0 z-10 bg-background">
                              <span className="mr-1 text-muted-foreground">
                                {expanded ? '▾' : '▸'}
                              </span>
                              {dash(c.name)}
                              {ledger && pending ? (
                                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                                  pago pend.
                                </span>
                              ) : null}
                            </TableCell>
                          ) : null}
                          {isColVisible('last_name') ? (
                            <TableCell>{dash(c.last_name)}</TableCell>
                          ) : null}
                          {isColVisible('phone') ? (
                            <TableCell className="font-mono text-sm">
                              {c.phone}
                            </TableCell>
                          ) : null}
                          {isColVisible('email') ? (
                            <TableCell>{dash(c.email)}</TableCell>
                          ) : null}
                          {isColVisible('dni') ? (
                            <TableCell>
                              {dash(c.dni ?? c.attributes.dni)}
                            </TableCell>
                          ) : null}
                          {isColVisible('segments') ? (
                            <TableCell className="text-xs">
                              {c.segment_slugs.join(', ') || '—'}
                            </TableCell>
                          ) : null}
                          {visibleAttrDefs.map((d) => (
                            <TableCell key={d.id}>
                              {dash(c.attributes[d.slug])}
                            </TableCell>
                          ))}
                          {isColVisible('mp_ledger') ? (
                            <TableCell>{dash(mp)}</TableCell>
                          ) : null}
                          {isColVisible('expiry') ? (
                            <TableCell>
                              {ledger ? formatDate(ledger.expiryDate) : '—'}
                            </TableCell>
                          ) : null}
                          {isColVisible('welcome') ? (
                            <TableCell>
                              {ledger?.welcomeEmail ?? '—'}
                            </TableCell>
                          ) : null}
                        </TableRow>
                        {expanded && draftContact ? (
                          <TableRow className="bg-muted/20">
                            <TableCell
                              colSpan={visibleColCount}
                              className="p-4"
                            >
                              <div
                                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <label className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">
                                    Nombre
                                  </span>
                                  <Input
                                    value={draftContact.name}
                                    onChange={(e) =>
                                      setDraftContact({
                                        ...draftContact,
                                        name: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">
                                    Apellido
                                  </span>
                                  <Input
                                    value={draftContact.last_name}
                                    onChange={(e) =>
                                      setDraftContact({
                                        ...draftContact,
                                        last_name: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">
                                    Email
                                  </span>
                                  <Input
                                    type="email"
                                    value={draftContact.email}
                                    onChange={(e) =>
                                      setDraftContact({
                                        ...draftContact,
                                        email: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">
                                    DNI
                                  </span>
                                  <Input
                                    value={draftContact.dni}
                                    onChange={(e) =>
                                      setDraftContact({
                                        ...draftContact,
                                        dni: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                {areaAttrDefs.map((d) => (
                                  <label
                                    key={d.id}
                                    className="space-y-1 text-sm"
                                  >
                                    <span className="text-muted-foreground">
                                      {d.label}
                                    </span>
                                    <Input
                                      value={
                                        draftContact.attributes[d.slug] ?? ''
                                      }
                                      onChange={(e) =>
                                        setDraftContact({
                                          ...draftContact,
                                          attributes: {
                                            ...draftContact.attributes,
                                            [d.slug]: e.target.value,
                                          },
                                        })
                                      }
                                    />
                                  </label>
                                ))}
                                <div className="flex items-end sm:col-span-2 lg:col-span-3">
                                  <IconActionButton
                                    label="Guardar en WhatsApp"
                                    variant="default"
                                    disabled={
                                      savingContactId === c.contact_id
                                    }
                                    onClick={() =>
                                      void saveContact(c.contact_id)
                                    }
                                  >
                                    <Save className="size-4" />
                                  </IconActionButton>
                                </div>
                              </div>
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
              Ledger local. Cruce con contactos vía{' '}
              <code className="text-xs">payment_id</code>. Vincula históricos
              por teléfono (más reciente) o fila a fila.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={linking}
                onClick={() => void linkAllByPhone()}
              >
                <Link2 className="mr-1 size-4" />
                Vincular por teléfono
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPayments()}
              >
                <RefreshCw className="mr-1 size-4" />
                Actualizar
              </Button>
            </div>
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
                    <TableHead>Vínculo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const pending =
                      !p.mpStatus || !CONFIRMED_MP.includes(p.mpStatus);
                    const expanded = expandedPaymentId === p.id;
                    const linked = linkedPaymentIds.has(p.id);
                    const mpValue =
                      draftMp[p.id] !== undefined
                        ? draftMp[p.id]
                        : (p.mpStatus ?? '');
                    const expiryValue =
                      draftExpiry[p.id] !== undefined
                        ? draftExpiry[p.id]
                        : toDateInput(p.expiryDate);

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
                          <TableCell>
                            {linked ? (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                vinculado
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700 dark:text-amber-400">
                                sin vínculo
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                        {expanded ? (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={7} className="p-4">
                              <div
                                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="text-sm sm:col-span-2 lg:col-span-3">
                                  <span className="text-xs text-muted-foreground">
                                    Checkout URL
                                  </span>
                                  <p className="break-all font-mono text-xs">
                                    {p.checkoutUrl || '—'}
                                  </p>
                                </div>
                                <label className="space-y-1 text-sm">
                                  <span className="text-muted-foreground">
                                    Estado Mercado Pago
                                  </span>
                                  <Select
                                    value={mpValue || '__none__'}
                                    onValueChange={(value) =>
                                      setDraftMp((prev) => ({
                                        ...prev,
                                        [p.id]:
                                          value === '__none__' ? '' : value,
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
                                  <span className="text-muted-foreground">
                                    Fecha caducidad
                                  </span>
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
                                    disabled={
                                      !p.mpStatus ||
                                      !CONFIRMED_MP.includes(p.mpStatus)
                                    }
                                    onClick={() => void resendWelcome(p.id)}
                                  >
                                    <Mail className="size-4" />
                                  </IconActionButton>
                                  <IconActionButton
                                    label="Vincular a este pago"
                                    onClick={() => void linkPayment(p.id)}
                                  >
                                    <Link2 className="size-4" />
                                  </IconActionButton>
                                </div>
                              </div>
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

        <TabsContent value="attrs" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Catálogo de atributos del área PAM en WhatsApp (
            <a
              className="underline"
              href="https://whatsapp.mali.pe/attributes"
              target="_blank"
              rel="noreferrer"
            >
              /attributes
            </a>
            ). También puedes crear defs desde aquí.
          </p>
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 p-4">
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input
                value={newAttrSlug}
                onChange={(e) => setNewAttrSlug(e.target.value)}
                placeholder="ciudad"
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Etiqueta</Label>
              <Input
                value={newAttrLabel}
                onChange={(e) => setNewAttrLabel(e.target.value)}
                placeholder="Ciudad"
                className="w-48"
              />
            </div>
            <Button
              disabled={creatingAttr}
              onClick={() => void createAttrDef()}
            >
              <Plus className="mr-1 size-4" />
              Crear atributo
            </Button>
          </div>
          {attrDefs.length === 0 ? (
            <EmptyState
              title="Sin definiciones"
              description="Crea atributos aquí o en WhatsApp /attributes."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ámbito</TableHead>
                  <TableHead>Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attrDefs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">{d.slug}</TableCell>
                    <TableCell>{d.label}</TableCell>
                    <TableCell>{d.field_type}</TableCell>
                    <TableCell>
                      {d.segment_slug
                        ? `segmento:${d.segment_slug}`
                        : 'área'}
                    </TableCell>
                    <TableCell>{d.active ? 'Sí' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
