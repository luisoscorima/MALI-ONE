import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Columns3, Link2, Mail, Plus, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type {
  EmailCampaignDto,
  PamPaymentMethodDto,
  PamPlanDto,
  PamRegistrationDto,
} from '@mali-one/shared';
import { PAM_DEFAULT_PAYMENT_METHOD } from '@mali-one/shared';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { IconActionButton } from '@/components/icon-action-button';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import {
  Button,
  Badge,
  DataTable,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

const EMPTY_NEW_PAYMENT = {
  nombres: '',
  apellidos: '',
  dni: '',
  celular: '',
  correo: '',
  plan: 'amigo',
  frecuencia: 'monthly',
  paymentMethod: PAM_DEFAULT_PAYMENT_METHOD,
  mpStatus: '',
  expiryDate: '',
};

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
    { id: 'mp_ledger', label: 'Estado de pago' },
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

/** Caducidad desde frecuencia (+ duración del plan del widget si existe). */
function computeExpiryDateInput(
  frecuencia: string,
  planSlug?: string,
  plans: PamPlanDto[] = [],
  from: Date = new Date(),
) {
  const plan = planSlug
    ? plans.find((p) => p.slug === planSlug)
    : undefined;
  const freq = String(frecuencia ?? '').toLowerCase();
  const isYearly =
    freq === 'yearly' ||
    freq.includes('anual') ||
    freq.includes('año') ||
    freq.includes('year');
  const durationLabel = String(
    (isYearly ? plan?.yearlyDuration : plan?.monthlyDuration) ?? frecuencia,
  ).toLowerCase();

  const date = new Date(from);
  const monthsMatch = durationLabel.match(/(\d+)\s*mes/);
  if (monthsMatch) {
    date.setMonth(date.getMonth() + Number(monthsMatch[1]));
  } else if (
    durationLabel.includes('año') ||
    durationLabel.includes('year') ||
    durationLabel.includes('anual') ||
    isYearly
  ) {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [debouncedAttrValue, setDebouncedAttrValue] = useState('');
  const [segments, setSegments] = useState<
    Array<{ slug: string; label: string; color_key?: string }>
  >([]);

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

  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null,
  );
  const [draftMp, setDraftMp] = useState<Record<string, string>>({});
  const [draftExpiry, setDraftExpiry] = useState<Record<string, string>>({});
  const [draftMethod, setDraftMethod] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PamPaymentMethodDto[]>(
    [],
  );
  const [pamPlans, setPamPlans] = useState<PamPlanDto[]>([]);
  const [showMethodsManager, setShowMethodsManager] = useState(false);
  const [newMethodLabel, setNewMethodLabel] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);
  const [newPayment, setNewPayment] = useState(EMPTY_NEW_PAYMENT);
  const [contactSuggestions, setContactSuggestions] = useState<CrmContact[]>(
    [],
  );
  const [suggestField, setSuggestField] = useState<'nombres' | 'celular' | null>(
    null,
  );
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef<number | null>(null);

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
          q: debouncedQ || undefined,
          segment: segment || undefined,
          attr_key: attrKey || undefined,
          attr_value:
            attrKey && debouncedAttrValue ? debouncedAttrValue : undefined,
          page,
          limit: pageSize,
        }),
        api.listCrmPamContacts({
          attr_key: 'payment_id',
          limit: 500,
          page: 1,
        }),
      ]);
      setContacts(data.items);
      setTotal(data.total);
      setPages(data.pages || (data.total > 0 ? Math.ceil(data.total / pageSize) : 0));
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
  }, [debouncedQ, segment, attrKey, debouncedAttrValue, page, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedAttrValue(attrValue.trim()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [attrValue]);

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

  const loadPaymentMethods = useCallback(async () => {
    try {
      const rows = await api.listCrmPamPaymentMethods();
      setPaymentMethods(rows);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Error al cargar medios de pago',
      );
    }
  }, [toast]);

  const loadPamPlans = useCallback(async () => {
    try {
      const rows = await api.getPamPlans();
      setPamPlans(rows);
    } catch {
      setPamPlans([]);
    }
  }, []);

  const activePaymentMethods = useMemo(
    () => paymentMethods.filter((m) => m.active),
    [paymentMethods],
  );

  const activePamPlans = useMemo(
    () =>
      [...pamPlans]
        .filter((p) => p.activo)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [pamPlans],
  );

  async function createPaymentMethod() {
    const label = newMethodLabel.trim();
    if (!label) {
      toast.error('Escribe el nombre del medio de pago');
      return;
    }
    setSavingMethod(true);
    try {
      await api.createCrmPamPaymentMethod({ label });
      setNewMethodLabel('');
      toast.success('Medio de pago creado');
      await loadPaymentMethods();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setSavingMethod(false);
    }
  }

  async function togglePaymentMethodActive(method: PamPaymentMethodDto) {
    if (method.system && method.active) {
      toast.error('No se puede desactivar Mercado Pago');
      return;
    }
    try {
      await api.updateCrmPamPaymentMethod(method.id, {
        active: !method.active,
      });
      await loadPaymentMethods();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
    }
  }

  async function removePaymentMethod(method: PamPaymentMethodDto) {
    if (method.system) {
      toast.error('No se puede eliminar Mercado Pago');
      return;
    }
    const ok = await confirm({
      title: 'Eliminar medio de pago',
      description: `¿Eliminar “${method.label}”? Solo si no hay pagos usándolo.`,
    });
    if (!ok) return;
    try {
      await api.deleteCrmPamPaymentMethod(method.id);
      toast.success('Medio de pago eliminado');
      await loadPaymentMethods();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  const loadAttrDefs = useCallback(async () => {
    try {
      const [defs, segs] = await Promise.all([
        api.listCrmPamAttributeDefinitions(),
        api.listCrmPamSegments().catch(() => []),
      ]);
      setAttrDefs(defs);
      setSegments(segs);
    } catch {
      setAttrDefs([]);
      setSegments([]);
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
    void loadPaymentMethods();
    void loadPamPlans();
    void loadAttrDefs();
  }, [loadPayments, loadPaymentMethods, loadPamPlans, loadAttrDefs]);

  useEffect(() => {
    if (activePamPlans.length === 0) return;
    setNewPayment((prev) => {
      if (activePamPlans.some((p) => p.slug === prev.plan)) return prev;
      return { ...prev, plan: activePamPlans[0].slug };
    });
  }, [activePamPlans]);

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
      const paymentMethod = draftMethod[id];
      const updated = await api.updatePamRegistration(id, {
        ...(mpStatus !== undefined ? { mpStatus } : {}),
        ...(expiryDate !== undefined ? { expiryDate } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
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

  function fillPaymentFromContact(c: CrmContact) {
    const freq = String(c.attributes.frecuencia ?? '').trim();
    const plan = String(c.attributes.plan ?? '').trim();
    const medioLabel = String(c.attributes.medio_pago ?? '').trim().toLowerCase();
    const matchedMethod = paymentMethods.find(
      (m) =>
        m.active &&
        (m.label.toLowerCase() === medioLabel ||
          m.slug.toLowerCase() === medioLabel),
    );

    setNewPayment((prev) => ({
      ...prev,
      nombres: c.name.trim() || prev.nombres,
      apellidos: c.last_name.trim() || prev.apellidos,
      dni: (c.dni ?? c.attributes.dni ?? '').trim() || prev.dni,
      celular: c.phone.trim() || prev.celular,
      correo: (c.email ?? '').trim() || prev.correo,
      plan: plan || prev.plan,
      frecuencia:
        freq === 'yearly' || freq === 'monthly' ? freq : prev.frecuencia,
      paymentMethod: matchedMethod?.slug ?? prev.paymentMethod,
    }));
  }

  async function openCreatePaymentFromContact(c: CrmContact) {
    const hasPayment = Boolean(c.attributes.payment_id?.trim());
    if (hasPayment) {
      const ok = await confirm({
        title: 'Crear otro pago',
        description:
          'Este contacto ya tiene un payment_id. ¿Crear un pago nuevo y re-vincular?',
        confirmLabel: 'Crear pago',
      });
      if (!ok) return;
    }
    fillPaymentFromContact(c);
    setContactSuggestions([]);
    setSuggestField(null);
    setShowNewPayment(true);
    setTab('payments');
    setExpandedContactId(null);
    toast.success('Formulario de pago precargado desde el contacto');
  }

  async function searchContactSuggestions(
    field: 'nombres' | 'celular',
    raw: string,
  ) {
    const q = raw.trim();
    if (q.length < 2) {
      setContactSuggestions([]);
      setSuggestField(null);
      return;
    }
    setSuggestField(field);
    setSuggestLoading(true);
    try {
      const data = await api.listCrmPamContacts({
        q,
        page: 1,
        limit: 8,
      });
      setContactSuggestions(data.items);
      setSuggestField(field);
    } catch {
      setContactSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  }

  function queueContactSuggestions(
    field: 'nombres' | 'celular',
    raw: string,
  ) {
    if (suggestTimer.current) window.clearTimeout(suggestTimer.current);
    suggestTimer.current = window.setTimeout(() => {
      void searchContactSuggestions(field, raw);
    }, 280);
  }

  function applyContactSuggestion(c: CrmContact) {
    fillPaymentFromContact(c);
    setContactSuggestions([]);
    setSuggestField(null);
  }

  async function createPayment() {
    if (
      !newPayment.nombres.trim() ||
      !newPayment.apellidos.trim() ||
      !newPayment.dni.trim() ||
      !newPayment.celular.trim() ||
      !newPayment.correo.trim() ||
      !newPayment.plan.trim()
    ) {
      toast.error('Completa nombre, apellido, DNI, celular, correo y plan');
      return;
    }
    setCreatingPayment(true);
    try {
      await api.createCrmPamPayment({
        nombres: newPayment.nombres.trim(),
        apellidos: newPayment.apellidos.trim(),
        dni: newPayment.dni.trim(),
        celular: newPayment.celular.trim(),
        correo: newPayment.correo.trim(),
        plan: newPayment.plan.trim(),
        frecuencia: newPayment.frecuencia,
        paymentMethod: newPayment.paymentMethod,
        ...(newPayment.mpStatus ? { mpStatus: newPayment.mpStatus } : {}),
        ...(newPayment.expiryDate
          ? { expiryDate: newPayment.expiryDate }
          : {}),
      });
      toast.success('Pago creado y vinculado al CRM');
      setShowNewPayment(false);
      setNewPayment(EMPTY_NEW_PAYMENT);
      setContactSuggestions([]);
      setSuggestField(null);
      await Promise.all([loadPayments(), loadContacts()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear pago');
    } finally {
      setCreatingPayment(false);
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

  async function exportExcel() {
    try {
      const data = await api.listCrmPamContacts({
        q: debouncedQ || undefined,
        segment: segment || undefined,
        attr_key: attrKey || undefined,
        attr_value:
          attrKey && debouncedAttrValue ? debouncedAttrValue : undefined,
        page: 1,
        limit: 5000,
      });
      if (data.items.length === 0) {
        toast.error('No hay contactos para exportar');
        return;
      }

      const dynamicHeaders = areaAttrDefs.map((d) => ({
        slug: d.slug,
        label: d.label,
      }));
      const rows = data.items.map((c) => {
        const ledger = c.attributes.payment_id
          ? paymentsById.get(c.attributes.payment_id)
          : undefined;
        const row: Record<string, string | number> = {
          ID: c.contact_id,
          Nombre: c.name,
          Apellido: c.last_name,
          Teléfono: c.phone,
          Email: c.email ?? '',
          DNI: c.dni ?? c.attributes.dni ?? '',
          Segmentos: c.segment_slugs.join('; '),
        };
        for (const h of dynamicHeaders) {
          row[h.label] = c.attributes[h.slug] ?? '';
        }
        row['payment_id'] = c.attributes.payment_id ?? '';
        row['MP ledger'] = ledger?.mpStatus ?? '';
        row.Caducidad = ledger?.expiryDate
          ? String(ledger.expiryDate).slice(0, 10)
          : '';
        row.Welcome = ledger?.welcomeEmail ?? '';
        row['Opt-in email'] = c.opt_in_email ? 'sí' : 'no';
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contactos PAM');
      XLSX.writeFile(
        wb,
        `crm-pam-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success(`Exportados ${rows.length} contactos`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al exportar');
    }
  }

  const contactColumns = useMemo<ColumnDef<CrmContact>[]>(() => {
    const cols: ColumnDef<CrmContact>[] = [];

    if (isColVisible('name')) {
      cols.push({
        id: 'name',
        header: 'Nombre',
        meta: { className: 'sticky left-0 z-10 bg-background' },
        cell: ({ row }) => {
          const c = row.original;
          const ledger = c.attributes.payment_id
            ? paymentsById.get(c.attributes.payment_id)
            : undefined;
          const pending =
            ledger &&
            (!ledger.mpStatus || !CONFIRMED_MP.includes(ledger.mpStatus));
          const expanded = expandedContactId === c.contact_id;
          return (
            <>
              <span className="mr-1 text-muted-foreground">
                {expanded ? '▾' : '▸'}
              </span>
              {dash(c.name)}
              {ledger && pending ? (
                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                  pago pend.
                </span>
              ) : null}
            </>
          );
        },
      });
    }
    if (isColVisible('last_name')) {
      cols.push({
        id: 'last_name',
        header: 'Apellido',
        cell: ({ row }) => dash(row.original.last_name),
      });
    }
    if (isColVisible('phone')) {
      cols.push({
        id: 'phone',
        header: 'Teléfono',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.phone}</span>
        ),
      });
    }
    if (isColVisible('email')) {
      cols.push({
        id: 'email',
        header: 'Email',
        cell: ({ row }) => dash(row.original.email),
      });
    }
    if (isColVisible('dni')) {
      cols.push({
        id: 'dni',
        header: 'DNI',
        cell: ({ row }) =>
          dash(row.original.dni ?? row.original.attributes.dni),
      });
    }
    if (isColVisible('segments')) {
      cols.push({
        id: 'segments',
        header: 'Segmentos',
        cell: ({ row }) => {
          const slugs = row.original.segment_slugs;
          if (slugs.length === 0) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {slugs.map((slug) => {
                const meta = segments.find((s) => s.slug === slug);
                return (
                  <Badge key={slug} variant="secondary" className="font-normal">
                    {meta?.label ?? slug}
                  </Badge>
                );
              })}
            </div>
          );
        },
      });
    }
    for (const d of visibleAttrDefs) {
      cols.push({
        id: attrColId(d.slug),
        header: d.label,
        cell: ({ row }) => dash(row.original.attributes[d.slug]),
      });
    }
    if (isColVisible('mp_ledger')) {
      cols.push({
        id: 'mp_ledger',
        header: 'Estado de pago',
        cell: ({ row }) => {
          const c = row.original;
          const ledger = c.attributes.payment_id
            ? paymentsById.get(c.attributes.payment_id)
            : undefined;
          return dash(ledger?.mpStatus ?? c.attributes.mp_status ?? null);
        },
      });
    }
    if (isColVisible('expiry')) {
      cols.push({
        id: 'expiry',
        header: 'Caducidad',
        cell: ({ row }) => {
          const ledger = row.original.attributes.payment_id
            ? paymentsById.get(row.original.attributes.payment_id)
            : undefined;
          return ledger ? formatDate(ledger.expiryDate) : '—';
        },
      });
    }
    if (isColVisible('welcome')) {
      cols.push({
        id: 'welcome',
        header: 'Welcome',
        cell: ({ row }) => {
          const ledger = row.original.attributes.payment_id
            ? paymentsById.get(row.original.attributes.payment_id)
            : undefined;
          return ledger?.welcomeEmail ?? '—';
        },
      });
    }
    return cols;
  }, [
    isColVisible,
    visibleAttrDefs,
    segments,
    paymentsById,
    expandedContactId,
  ]);

  const paymentColumns = useMemo<ColumnDef<PamRegistrationDto>[]>(
    () => [
      {
        id: 'createdAt',
        header: 'Registrado',
        cell: ({ row }) => {
          const p = row.original;
          const expanded = expandedPaymentId === p.id;
          return (
            <>
              <span className="mr-1 text-muted-foreground">
                {expanded ? '▾' : '▸'}
              </span>
              {formatDateTime(p.createdAt)}
            </>
          );
        },
      },
      {
        id: 'persona',
        header: 'Persona',
        cell: ({ row }) => {
          const p = row.original;
          const pending =
            !p.mpStatus || !CONFIRMED_MP.includes(p.mpStatus);
          return (
            <div>
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
              <div className="font-mono text-[10px] text-muted-foreground">
                id: {p.id}
              </div>
            </div>
          );
        },
      },
      {
        id: 'plan',
        header: 'Plan',
        cell: ({ row }) =>
          `${row.original.plan} / ${row.original.frecuencia}`,
      },
      {
        id: 'paymentMethod',
        header: 'Medio de pago',
        cell: ({ row }) => {
          const p = row.original;
          const methodSlug =
            draftMethod[p.id] !== undefined
              ? draftMethod[p.id]
              : (p.paymentMethod ?? PAM_DEFAULT_PAYMENT_METHOD);
          return (
            paymentMethods.find((m) => m.slug === methodSlug)?.label ??
            (methodSlug === PAM_DEFAULT_PAYMENT_METHOD
              ? 'Mercado Pago'
              : methodSlug)
          );
        },
      },
      {
        id: 'mpStatus',
        header: 'Estado de pago',
        cell: ({ row }) => row.original.mpStatus ?? '—',
      },
      {
        id: 'expiryDate',
        header: 'Caducidad',
        cell: ({ row }) => formatDate(row.original.expiryDate),
      },
      {
        id: 'welcomeEmail',
        header: 'Welcome',
        cell: ({ row }) => row.original.welcomeEmail,
      },
      {
        id: 'linked',
        header: 'Vínculo',
        cell: ({ row }) =>
          linkedPaymentIds.has(row.original.id) ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              vinculado
            </span>
          ) : (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              sin vínculo
            </span>
          ),
      },
    ],
    [expandedPaymentId, draftMethod, linkedPaymentIds, paymentMethods],
  );

  const campaignColumns = useMemo<ColumnDef<EmailCampaignDto>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Envío',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      { accessorKey: 'status', header: 'Estado' },
      {
        id: 'sent',
        header: 'Enviados',
        cell: ({ row }) =>
          `${row.original.sentCount}/${row.original.totalRecipients}`,
      },
      {
        id: 'engagement',
        header: 'Opens / Clicks',
        cell: ({ row }) =>
          `${row.original.openCount} / ${row.original.clickCount}`,
      },
    ],
    [],
  );

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
          <TabsTrigger value="send">Enviar boletín</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="q">Buscar</Label>
              <Input
                id="q"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Toda la tabla…"
                className="w-56"
              />
            </div>
            <div className="space-y-1">
              <Label>Segmento</Label>
              <Select
                value={segment || '__all__'}
                onValueChange={(value) => {
                  setSegment(value === '__all__' ? '' : value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {segments.map((s) => (
                    <SelectItem key={s.slug} value={s.slug}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Atributo</Label>
              <Select
                value={attrKey || '__none__'}
                onValueChange={(value) => {
                  const next = value === '__none__' ? '' : value;
                  setAttrKey(next);
                  if (!next) setAttrValue('');
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Atributo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Ninguno —</SelectItem>
                  {areaAttrDefs.map((d) => (
                    <SelectItem key={d.id} value={d.slug}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {attrKey ? (
              <div className="space-y-1">
                <Label htmlFor="av">Valor</Label>
                <Input
                  id="av"
                  value={attrValue}
                  onChange={(e) => {
                    setAttrValue(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filtra al escribir…"
                  className="w-40"
                />
              </div>
            ) : null}
            <Button variant="secondary" onClick={() => void exportExcel()}>
              Exportar Excel
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
              {pages > 1 ? ` · pág. ${page}/${pages}` : ''}
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
            <DataTable
              columns={contactColumns}
              data={contacts}
              getRowId={(c) => String(c.contact_id)}
              onRowClick={openContactEditor}
              isRowExpanded={(c) => expandedContactId === c.contact_id}
              tableClassName="w-max min-w-full"
              tableStyle={{
                minWidth: `${Math.max(visibleColCount * 140, 640)}px`,
              }}
              renderExpandedRow={(c) =>
                draftContact ? (
                  <div
                    className="sticky left-0 z-20 w-[min(100vw-4rem,42rem)] max-w-full border-t border-border bg-muted/40 p-4 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>Nombre</Label>
                        <Input
                          className="w-full min-w-0"
                          value={draftContact.name}
                          onChange={(e) =>
                            setDraftContact({
                              ...draftContact,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>Apellido</Label>
                        <Input
                          className="w-full min-w-0"
                          value={draftContact.last_name}
                          onChange={(e) =>
                            setDraftContact({
                              ...draftContact,
                              last_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          className="w-full min-w-0"
                          value={draftContact.email}
                          onChange={(e) =>
                            setDraftContact({
                              ...draftContact,
                              email: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>DNI</Label>
                        <Input
                          className="w-full min-w-0"
                          value={draftContact.dni}
                          onChange={(e) =>
                            setDraftContact({
                              ...draftContact,
                              dni: e.target.value,
                            })
                          }
                        />
                      </div>
                      {areaAttrDefs.map((d) => (
                        <div
                          key={d.id}
                          className="flex min-w-0 flex-col gap-1.5"
                        >
                          <Label>{d.label}</Label>
                          <Input
                            className="w-full min-w-0"
                            value={draftContact.attributes[d.slug] ?? ''}
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
                        </div>
                      ))}
                      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                        <IconActionButton
                          label="Guardar en WhatsApp"
                          variant="default"
                          disabled={savingContactId === c.contact_id}
                          onClick={() => void saveContact(c.contact_id)}
                        >
                          <Save className="size-4" />
                        </IconActionButton>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void openCreatePaymentFromContact(c)}
                        >
                          <Plus className="mr-1 size-4" />
                          Crear pago
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null
              }
              footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {total} en total
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">
                        Por página
                      </Label>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[25, 50, 100].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Página {pages === 0 ? 0 : page} de {pages || 1}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || pages === 0 || page >= pages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </div>
              }
            />
          )}

        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Ledger local. Cruce vía <code className="text-xs">payment_id</code>
              . Widget → Mercado Pago; históricos desde Contactos (Crear pago) o
              Añadir pago con autocompletado CRM.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMethodsManager((v) => !v)}
              >
                {showMethodsManager ? 'Cerrar medios' : 'Medios de pago'}
              </Button>
              <Button size="sm" onClick={() => setShowNewPayment((v) => !v)}>
                <Plus className="mr-1 size-4" />
                {showNewPayment ? 'Cerrar formulario' : 'Añadir pago'}
              </Button>
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
                onClick={() => {
                  void loadPayments();
                  void loadPaymentMethods();
                }}
              >
                <RefreshCw className="mr-1 size-4" />
                Actualizar
              </Button>
            </div>
          </div>

          {showMethodsManager ? (
            <div className="space-y-3 rounded-md border border-border/60 p-4">
              <p className="text-sm font-medium">Catálogo de medios de pago</p>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="Ej. Niubiz, Izipay…"
                  value={newMethodLabel}
                  onChange={(e) => setNewMethodLabel(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={savingMethod}
                  onClick={() => void createPaymentMethod()}
                >
                  <Plus className="mr-1 size-4" />
                  {savingMethod ? 'Creando…' : 'Crear medio'}
                </Button>
              </div>
              <ul className="divide-y divide-border/60 rounded-md border border-border/50">
                {paymentMethods.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium">{m.label}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {m.slug}
                      </span>
                      {m.system ? (
                        <Badge variant="secondary" className="ml-2">
                          Sistema
                        </Badge>
                      ) : null}
                      {!m.active ? (
                        <Badge variant="outline" className="ml-2">
                          Inactivo
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      {!m.system ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void togglePaymentMethodActive(m)}
                        >
                          {m.active ? 'Desactivar' : 'Activar'}
                        </Button>
                      ) : null}
                      {!m.system ? (
                        <IconActionButton
                          label="Eliminar"
                          variant="ghost"
                          onClick={() => void removePaymentMethod(m)}
                        >
                          <Trash2 className="size-4" />
                        </IconActionButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showNewPayment ? (
            <div className="grid gap-3 rounded-md border border-border/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative flex min-w-0 flex-col gap-1.5">
                <Label>Nombres</Label>
                <Input
                  className="w-full min-w-0"
                  value={newPayment.nombres}
                  autoComplete="off"
                  placeholder="Escribe para buscar contacto…"
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewPayment({ ...newPayment, nombres: value });
                    queueContactSuggestions('nombres', value);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (suggestField === 'nombres') {
                        setSuggestField(null);
                        setContactSuggestions([]);
                      }
                    }, 150);
                  }}
                />
                {suggestField === 'nombres' &&
                (suggestLoading || contactSuggestions.length > 0) ? (
                  <div className="absolute top-full z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
                    {suggestLoading ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Buscando…
                      </p>
                    ) : (
                      contactSuggestions.map((c) => (
                        <button
                          key={c.contact_id}
                          type="button"
                          className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyContactSuggestion(c)}
                        >
                          <span className="font-medium">
                            {c.name} {c.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.phone}
                            {c.email ? ` · ${c.email}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Apellidos</Label>
                <Input
                  className="w-full min-w-0"
                  value={newPayment.apellidos}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, apellidos: e.target.value })
                  }
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>DNI</Label>
                <Input
                  className="w-full min-w-0"
                  value={newPayment.dni}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, dni: e.target.value })
                  }
                />
              </div>
              <div className="relative flex min-w-0 flex-col gap-1.5">
                <Label>Celular</Label>
                <Input
                  className="w-full min-w-0"
                  value={newPayment.celular}
                  autoComplete="off"
                  placeholder="Escribe para buscar contacto…"
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewPayment({ ...newPayment, celular: value });
                    queueContactSuggestions('celular', value);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => {
                      if (suggestField === 'celular') {
                        setSuggestField(null);
                        setContactSuggestions([]);
                      }
                    }, 150);
                  }}
                />
                {suggestField === 'celular' &&
                (suggestLoading || contactSuggestions.length > 0) ? (
                  <div className="absolute top-full z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-md">
                    {suggestLoading ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Buscando…
                      </p>
                    ) : (
                      contactSuggestions.map((c) => (
                        <button
                          key={c.contact_id}
                          type="button"
                          className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyContactSuggestion(c)}
                        >
                          <span className="font-medium">
                            {c.name} {c.last_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.phone}
                            {c.email ? ` · ${c.email}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Correo</Label>
                <Input
                  className="w-full min-w-0"
                  value={newPayment.correo}
                  onChange={(e) =>
                    setNewPayment({ ...newPayment, correo: e.target.value })
                  }
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Plan</Label>
                <Select
                  value={newPayment.plan}
                  onValueChange={(value) =>
                    setNewPayment((prev) => ({
                      ...prev,
                      plan: value,
                      ...(CONFIRMED_MP.includes(prev.mpStatus)
                        ? {
                            expiryDate: computeExpiryDateInput(
                              prev.frecuencia,
                              value,
                              pamPlans,
                            ),
                          }
                        : {}),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir membresía" />
                  </SelectTrigger>
                  <SelectContent>
                    {activePamPlans.map((p) => (
                      <SelectItem key={p.id} value={p.slug}>
                        {p.name}
                      </SelectItem>
                    ))}
                    {newPayment.plan &&
                    !activePamPlans.some((p) => p.slug === newPayment.plan) ? (
                      <SelectItem value={newPayment.plan}>
                        {newPayment.plan} (histórico)
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Frecuencia</Label>
                <Select
                  value={newPayment.frecuencia}
                  onValueChange={(value) =>
                    setNewPayment((prev) => ({
                      ...prev,
                      frecuencia: value,
                      ...(CONFIRMED_MP.includes(prev.mpStatus)
                        ? {
                            expiryDate: computeExpiryDateInput(
                              value,
                              prev.plan,
                              pamPlans,
                            ),
                          }
                        : {}),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Medio de pago</Label>
                <Select
                  value={newPayment.paymentMethod}
                  onValueChange={(value) =>
                    setNewPayment({ ...newPayment, paymentMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activePaymentMethods.map((m) => (
                      <SelectItem key={m.id} value={m.slug}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Estado de pago (opcional)</Label>
                <Select
                  value={newPayment.mpStatus || '__none__'}
                  onValueChange={(value) => {
                    const mpStatus = value === '__none__' ? '' : value;
                    setNewPayment((prev) => ({
                      ...prev,
                      mpStatus,
                      ...(CONFIRMED_MP.includes(mpStatus)
                        ? {
                            expiryDate: computeExpiryDateInput(
                              prev.frecuencia,
                              prev.plan,
                              pamPlans,
                            ),
                          }
                        : {}),
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
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
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <Label>Caducidad (opcional)</Label>
                <Input
                  type="date"
                  value={newPayment.expiryDate}
                  onChange={(e) =>
                    setNewPayment({
                      ...newPayment,
                      expiryDate: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button
                  disabled={creatingPayment}
                  onClick={() => void createPayment()}
                >
                  {creatingPayment ? 'Guardando…' : 'Crear pago y sync CRM'}
                </Button>
              </div>
            </div>
          ) : null}

          {paymentsLoading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : payments.length === 0 ? (
            <EmptyState
              title="Sin pagos"
              description="Registros del widget o altas manuales aparecerán aquí."
            />
          ) : (
            <DataTable
              columns={paymentColumns}
              data={payments}
              getRowId={(p) => p.id}
              tableClassName="min-w-[800px]"
              onRowClick={(p) => {
                setExpandedPaymentId((prev) => (prev === p.id ? null : p.id));
                setDraftMp((prev) => ({
                  ...prev,
                  [p.id]: p.mpStatus ?? '',
                }));
                setDraftExpiry((prev) => ({
                  ...prev,
                  [p.id]: toDateInput(p.expiryDate),
                }));
                setDraftMethod((prev) => ({
                  ...prev,
                  [p.id]: p.paymentMethod ?? PAM_DEFAULT_PAYMENT_METHOD,
                }));
              }}
              isRowExpanded={(p) => expandedPaymentId === p.id}
              renderExpandedRow={(p) => {
                const methodSlug =
                  draftMethod[p.id] !== undefined
                    ? draftMethod[p.id]
                    : (p.paymentMethod ?? PAM_DEFAULT_PAYMENT_METHOD);
                const mpValue =
                  draftMp[p.id] !== undefined
                    ? draftMp[p.id]
                    : (p.mpStatus ?? '');
                const expiryValue =
                  draftExpiry[p.id] !== undefined
                    ? draftExpiry[p.id]
                    : toDateInput(p.expiryDate);
                return (
                  <div
                    className="sticky left-0 z-20 w-[min(100vw-4rem,42rem)] max-w-full border-t border-border bg-muted/40 p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                        <span className="text-xs text-muted-foreground">
                          Checkout URL
                        </span>
                        <p className="break-all font-mono text-xs">
                          {p.checkoutUrl || '—'}
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>Medio de pago</Label>
                        <Select
                          value={methodSlug}
                          onValueChange={(value) =>
                            setDraftMethod((prev) => ({
                              ...prev,
                              [p.id]: value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {activePaymentMethods.map((m) => (
                              <SelectItem key={m.id} value={m.slug}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>Estado de pago</Label>
                        <Select
                          value={mpValue || '__none__'}
                          onValueChange={(value) => {
                            const next = value === '__none__' ? '' : value;
                            setDraftMp((prev) => ({
                              ...prev,
                              [p.id]: next,
                            }));
                            if (CONFIRMED_MP.includes(next)) {
                              setDraftExpiry((prev) => ({
                                ...prev,
                                [p.id]: computeExpiryDateInput(
                                  p.frecuencia,
                                  p.plan,
                                  pamPlans,
                                ),
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
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
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>Fecha caducidad</Label>
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
                      </div>
                      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
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
                  </div>
                );
              }}
            />
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
            <DataTable
              columns={campaignColumns}
              data={campaigns}
              getRowId={(c) => c.id}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
