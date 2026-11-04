import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Columns3, Download, Plus, Save, UsersRound } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import {
  api, ApiRequestError, type EducationArea, type EducationCatalog, type EducationCategoryScope,
  type EducationContact, type EducationCycle, type EducationCycleCounts, type EducationCycleView,
  type EducationLead, type EducationManagementCatalog, type EducationSlaReport,
} from '@/lib/api';
import {
  Badge, Button, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DropdownMenu, DropdownMenuCheckboxItem,
  DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, Input, Label,
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui';

const EDUCATION_AREA: EducationArea = 'educacion';

const CATEGORY_SCOPE_LABELS: Record<EducationCategoryScope, string> = {
  all: 'Todas',
  general: 'General',
  ca: 'CA',
  ep: 'EP',
};
const CATEGORY_SCOPES = Object.keys(CATEGORY_SCOPE_LABELS) as EducationCategoryScope[];

function categoryLabel(categoria?: string | null, categorias?: string[] | null) {
  const value = String(categoria ?? categorias?.[0] ?? '').trim().toLowerCase();
  if (value === 'ca') return 'CA';
  if (value === 'ep') return 'EP';
  if (value === 'general') return 'General';
  if (!value) return 'General';
  return value.toUpperCase();
}

function worksEducation(areas: string[]) {
  return areas.includes(EDUCATION_AREA)
    || areas.includes('educacion_ca')
    || areas.includes('educacion_ep')
    || areas.length === 0;
}
const CHANNEL_LABELS: Record<string, string> = {
  meta_lead_form: 'Formulario Meta', meta_ctwa: 'Anuncio a WhatsApp',
  widget: 'Widget web', tiktok: 'TikTok', import: 'Importación',
  manual: 'Manual', organic_wa: 'WhatsApp orgánico',
  mali_one_link: 'Enlace / QR MALI ONE', other: 'Otro',
};
const SALE_MISSING_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  dni: 'DNI',
  email: 'Email',
  telefono: 'Teléfono o WhatsApp',
  categoria: 'Categoría CA/EP',
};

type SaleReadyPrompt = {
  contactId: number;
  leadId?: number;
  leadStatusId: number;
  missing: string[];
  name: string;
  last_name: string;
  email: string;
  dni: string;
};

type ManualLeadDraft = {
  source_key: 'manual_call' | 'manual_historical' | 'manual_organic';
  categoria: 'ca' | 'ep';
  name: string;
  last_name: string;
  phone: string;
  email: string;
  dni: string;
  curso: string;
};

const EMPTY_MANUAL_LEAD: ManualLeadDraft = {
  source_key: 'manual_call',
  categoria: 'ep',
  name: '',
  last_name: '',
  phone: '',
  email: '',
  dni: '',
  curso: '',
};
const FIXED_COLUMNS = [
  ['name', 'Nombre'], ['categoria', 'Categoría'], ['last_name', 'Apellido'],
  ['phone', 'Teléfono'], ['prospectia', 'Prospectia'], ['wa_identity', 'Usuario WhatsApp'], ['email', 'Email'], ['dni', 'DNI'],
  ['segments', 'Segmentos'], ['advisor', 'Asesor'], ['lead_status', 'Estado del lead'],
] as const;
const STORAGE_KEY = 'crm-educacion-contact-cols-v5';
const PREVIOUS_STORAGE_KEY = 'crm-educacion-contact-cols-v4';
const LEGACY_STORAGE_KEY = 'crm-educacion-contact-cols-v3';
const PAGE_SIZE = 50;

function storedColumns(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const value = JSON.parse(saved ?? localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? 'null');
    if (Array.isArray(value)) {
      const visible = new Set(value.filter((v): v is string => typeof v === 'string'));
      if (visible.has('area')) { visible.delete('area'); visible.add('categoria'); }
      if (!saved) { visible.add('wa_identity'); visible.add('prospectia'); }
      return visible;
    }
  } catch { /* Prefer defaults when storage is invalid. */ }
  return new Set(FIXED_COLUMNS.map(([id]) => id));
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

function waUsername(value: string | null) {
  return value ? `@${value.replace(/^@/, '')}` : null;
}

const LEAD_STATUS_PATH = ['por_contactar', 'contactado', 'evaluando', 'promesa', 'venta_exitosa'] as const;
const LEAD_STATUS_EXITS = ['no_contesta', 'no_interesado', 'perdido'] as const;

function LeadStatusSelect({
  value, disabled, statuses, onChange, className,
}: {
  value: string;
  disabled: boolean;
  statuses: EducationManagementCatalog['statuses'];
  onChange: (value: string) => void;
  className?: string;
}) {
  const ofArea = statuses.filter((status) =>
    status.area === EDUCATION_AREA
    || status.area === 'educacion_ca'
    || status.area === 'educacion_ep'
  );
  const bySlug = (slugs: readonly string[]) => slugs
    .map((slug) => ofArea.find((status) => status.slug === slug))
    .filter((status): status is (typeof ofArea)[number] => Boolean(status));
  const path = bySlug(LEAD_STATUS_PATH);
  const exits = bySlug(LEAD_STATUS_EXITS);
  const known = new Set<string>([...LEAD_STATUS_PATH, ...LEAD_STATUS_EXITS]);
  const other = ofArea.filter((status) => !known.has(status.slug));
  const group = (label: string, items: typeof ofArea) => items.length === 0 ? null : (
    <SelectGroup>
      <SelectLabel>{label}</SelectLabel>
      {items.map((status) => (
        <SelectItem key={status.id} value={String(status.id)}>{status.label}</SelectItem>
      ))}
    </SelectGroup>
  );
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className={className}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Sin estado</SelectItem>
        {group('Inscripción', path)}
        {group('Intento o cierre', exits)}
        {group('Otros', other)}
      </SelectContent>
    </Select>
  );
}

function prospectiaLabel(match: string | null | undefined) {
  if (!match) return <span className="text-xs text-muted-foreground">Sin consultar</span>;
  if (match === 'exists') return <Badge>Prospectia</Badge>;
  if (match === 'missing') return <span className="text-xs text-muted-foreground">No existe</span>;
  return <span className="text-xs text-muted-foreground">No verificado</span>;
}

type DraftContact = Pick<EducationContact, 'name' | 'last_name' | 'opt_in_email' | 'segment_slugs' | 'attributes'> & {
  email: string; dni: string;
};

export function CrmEducacionPage() {
  const toast = useToast();
  const [tab, setTab] = useState('contacts');
  const [categoria, setCategoria] = useState<EducationCategoryScope>('all');
  const [catalog, setCatalog] = useState<EducationCatalog>({ attributes: [], segments: [] });
  const [contacts, setContacts] = useState<EducationContact[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactPage, setContactPage] = useState(1);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState('');
  const contactRequestId = useRef(0);
  const cycleRequestId = useRef(0);
  const reviewEntryRequestId = useRef(0);
  const [contactQ, setContactQ] = useState('');
  const [debouncedContactQ, setDebouncedContactQ] = useState('');
  const [segment, setSegment] = useState('');
  const [attrKey, setAttrKey] = useState('');
  const [attrValue, setAttrValue] = useState('');
  const [debouncedAttrValue, setDebouncedAttrValue] = useState('');
  const [visible, setVisible] = useState(storedColumns);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saleReadyPrompt, setSaleReadyPrompt] = useState<SaleReadyPrompt | null>(null);
  const [saleReadySaving, setSaleReadySaving] = useState(false);
  const [manualLeadOpen, setManualLeadOpen] = useState(false);
  const [manualLeadDraft, setManualLeadDraft] = useState<ManualLeadDraft>(EMPTY_MANUAL_LEAD);
  const [manualLeadSaving, setManualLeadSaving] = useState(false);
  const [manualLeadExists, setManualLeadExists] = useState<{
    contact_id: number;
    cycle_id: number | null;
    assigned_user_label: string | null;
    lead_status_label: string | null;
  } | null>(null);
  const [cycles, setCycles] = useState<EducationCycle[]>([]);
  const [cycleTotal, setCycleTotal] = useState(0);
  const [cyclePage, setCyclePage] = useState(1);
  const [cycleLoading, setCycleLoading] = useState(true);
  const [cycleError, setCycleError] = useState('');
  const [opportunityQ, setOpportunityQ] = useState('');
  const [debouncedOpportunityQ, setDebouncedOpportunityQ] = useState('');
  const [channel, setChannel] = useState('');
  const [opportunityView, setOpportunityView] = useState<EducationCycleView>('open');
  const [sla, setSla] = useState<EducationSlaReport | null>(null);
  const [slaError, setSlaError] = useState('');
  const slaRequestId = useRef(0);
  const [cycleCounts, setCycleCounts] = useState<EducationCycleCounts>({
    open: 0, closed: 0, review: 0, unassigned: 0,
  });
  const [reviewEntries, setReviewEntries] = useState<EducationLead[]>([]);
  const [reviewEntryTotal, setReviewEntryTotal] = useState(0);
  const [reviewEntryPage, setReviewEntryPage] = useState(1);
  const [reviewEntryLoading, setReviewEntryLoading] = useState(false);
  const [reviewEntryError, setReviewEntryError] = useState('');
  const [managementCatalog, setManagementCatalog] = useState<EducationManagementCatalog>({ advisors: [], statuses: [] });
  const [managementSaving, setManagementSaving] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [syncingProspectia, setSyncingProspectia] = useState(false);
  const [prospectiaWatch, setProspectiaWatch] = useState(0);
  const [prospectiaSync, setProspectiaSync] = useState({
    running: false, processed: 0, total: 0, finished_at: null as string | null,
  });
  const prospectiaWasRunning = useRef(false);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify([...visible])); }, [visible]);
  useEffect(() => {
    void api.getCrmEducationCatalogs().then(setCatalog).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los catálogos');
    });
  }, [toast]);
  useEffect(() => {
    void api.getCrmEducationManagementCatalogs().then(setManagementCatalog).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar asesores y estados');
    });
  }, [toast]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedContactQ(contactQ.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [contactQ]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedAttrValue(attrValue.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [attrValue]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedOpportunityQ(opportunityQ.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [opportunityQ]);

  const contactParams = useMemo(() => ({
    categoria, q: debouncedContactQ, segment, attr_key: attrKey,
    attr_value: debouncedAttrValue, page: contactPage, limit: PAGE_SIZE,
  }), [categoria, debouncedContactQ, segment, attrKey, debouncedAttrValue, contactPage]);
  const loadContacts = useCallback(async () => {
    const requestId = ++contactRequestId.current;
    setContactLoading(true);
    setContactError('');
    try {
      const data = await api.listCrmEducationContacts(contactParams);
      if (requestId === contactRequestId.current) {
        setContacts(data.items);
        setContactTotal(data.total);
      }
    } catch (error) {
      if (requestId === contactRequestId.current) {
        setContactError(error instanceof Error ? error.message : 'No se pudieron cargar los contactos');
      }
    } finally {
      if (requestId === contactRequestId.current) setContactLoading(false);
    }
  }, [contactParams]);
  useEffect(() => { void loadContacts(); }, [loadContacts]);
  const cycleParams = useMemo(() => ({
    categoria, channel, q: debouncedOpportunityQ, view: opportunityView,
    page: cyclePage, limit: PAGE_SIZE,
  }), [categoria, channel, debouncedOpportunityQ, opportunityView, cyclePage]);
  const loadCycles = useCallback(async () => {
    const requestId = ++cycleRequestId.current;
    setCycleLoading(true);
    setCycleError('');
    try {
      const data = await api.listCrmEducationCycles(cycleParams);
      if (requestId !== cycleRequestId.current) return;
      setCycles(data.items);
      setCycleTotal(data.total);
      setCycleCounts(data.counts);
    } catch (error) {
      if (requestId !== cycleRequestId.current) return;
      setCycleError(error instanceof Error ? error.message : 'No se pudieron cargar las oportunidades');
    } finally {
      if (requestId === cycleRequestId.current) setCycleLoading(false);
    }
  }, [cycleParams]);
  useEffect(() => { void loadCycles(); }, [loadCycles]);

  const loadSla = useCallback(async () => {
    const requestId = ++slaRequestId.current;
    setSlaError('');
    try {
      const data = await api.getCrmEducationSla({ categoria });
      if (requestId !== slaRequestId.current) return;
      setSla(data);
    } catch (error) {
      if (requestId !== slaRequestId.current) return;
      setSla(null);
      setSlaError(error instanceof Error ? error.message : 'No se pudo cargar el SLA');
    }
  }, [categoria]);
  useEffect(() => { void loadSla(); }, [loadSla]);

  const loadReviewEntries = useCallback(async () => {
    const requestId = ++reviewEntryRequestId.current;
    setReviewEntryLoading(true);
    setReviewEntryError('');
    try {
      const data = await api.listCrmEducationLeads({
        categoria, channel, q: debouncedOpportunityQ, view: 'conflict',
        page: reviewEntryPage, limit: PAGE_SIZE,
      });
      if (requestId !== reviewEntryRequestId.current) return;
      setReviewEntries(data.items);
      setReviewEntryTotal(data.total);
    } catch (error) {
      if (requestId !== reviewEntryRequestId.current) return;
      setReviewEntryError(error instanceof Error ? error.message : 'No se pudieron cargar los conflictos comerciales');
    } finally {
      if (requestId === reviewEntryRequestId.current) setReviewEntryLoading(false);
    }
  }, [categoria, channel, debouncedOpportunityQ, reviewEntryPage]);
  useEffect(() => { void loadReviewEntries(); }, [loadReviewEntries]);

  const seedSaleReadyPrompt = useCallback((
    contactId: number,
    leadStatusId: number,
    leadId: number | undefined,
    missing: string[],
  ): SaleReadyPrompt => {
    const fromContact = contacts.find((item) => item.contact_id === contactId);
    const fromCycle = cycles.find((item) => item.contact_id === contactId
      && (leadId == null || item.id === leadId));
    return {
      contactId,
      leadId,
      leadStatusId,
      missing,
      name: fromContact?.name ?? fromCycle?.contacts.name ?? '',
      last_name: fromContact?.last_name ?? fromCycle?.contacts.last_name ?? '',
      email: fromContact?.email ?? fromCycle?.contacts.email ?? '',
      dni: fromContact?.dni ?? '',
    };
  }, [contacts, cycles]);

  const updateManagement = useCallback(async (contactId: number,
    changes: { assigned_user_id?: number | null; lead_status_id?: number | null; lead_id?: number }) => {
    setManagementSaving(true);
    try {
      await api.patchCrmEducationManagement(contactId, { area: EDUCATION_AREA, ...changes });
      toast.success('Lead actualizado');
      setSaleReadyPrompt(null);
      await Promise.all([loadContacts(), loadCycles(), loadReviewEntries()]);
    } catch (error) {
      if (
        error instanceof ApiRequestError
        && error.code === 'missing_fields'
        && typeof changes.lead_status_id === 'number'
      ) {
        setSaleReadyPrompt(seedSaleReadyPrompt(
          contactId,
          changes.lead_status_id,
          changes.lead_id,
          error.missing_fields ?? [],
        ));
        toast.error(error.message);
        return;
      }
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el lead');
    }
    finally { setManagementSaving(false); }
  }, [loadContacts, loadCycles, loadReviewEntries, seedSaleReadyPrompt, toast]);

  async function submitManualLead() {
    if (!manualLeadDraft.name.trim()) {
      toast.error('Nombre requerido');
      return;
    }
    if (!manualLeadDraft.phone.trim() && !manualLeadDraft.email.trim() && !manualLeadDraft.dni.trim()) {
      toast.error('Indica teléfono, DNI o email');
      return;
    }
    setManualLeadSaving(true);
    setManualLeadExists(null);
    try {
      const created = await api.createCrmEducationManualLead({
        source_key: manualLeadDraft.source_key,
        categoria: manualLeadDraft.categoria,
        name: manualLeadDraft.name.trim(),
        last_name: manualLeadDraft.last_name.trim() || undefined,
        phone: manualLeadDraft.phone.trim() || undefined,
        email: manualLeadDraft.email.trim() || undefined,
        dni: manualLeadDraft.dni.trim() || undefined,
        curso: manualLeadDraft.curso.trim() || undefined,
      });
      toast.success(`Lead registrado (#${created.contact_id})`);
      setManualLeadOpen(false);
      setManualLeadDraft(EMPTY_MANUAL_LEAD);
      setTab('opportunities');
      await Promise.all([loadContacts(), loadCycles()]);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'already_exists' && error.contact_id) {
        setManualLeadExists({
          contact_id: error.contact_id,
          cycle_id: error.cycle_id ?? null,
          assigned_user_label: error.assigned_user_label ?? null,
          lead_status_label: error.lead_status_label ?? null,
        });
        toast.error(error.message);
        return;
      }
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar el lead');
    } finally {
      setManualLeadSaving(false);
    }
  }

  async function completeSaleReadyAndRetry() {
    if (!saleReadyPrompt) return;
    setSaleReadySaving(true);
    try {
      await api.patchCrmEducationContact(saleReadyPrompt.contactId, {
        area: EDUCATION_AREA,
        name: saleReadyPrompt.name,
        last_name: saleReadyPrompt.last_name,
        email: saleReadyPrompt.email || null,
        dni: saleReadyPrompt.dni || null,
      });
      await api.patchCrmEducationManagement(saleReadyPrompt.contactId, {
        area: EDUCATION_AREA,
        lead_status_id: saleReadyPrompt.leadStatusId,
        ...(saleReadyPrompt.leadId ? { lead_id: saleReadyPrompt.leadId } : {}),
      });
      toast.success('Venta exitosa registrada');
      setSaleReadyPrompt(null);
      await Promise.all([loadContacts(), loadCycles(), loadReviewEntries()]);
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'missing_fields') {
        setSaleReadyPrompt((current) => current
          ? { ...current, missing: error.missing_fields ?? current.missing }
          : current);
        toast.error(error.message);
        return;
      }
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la venta');
    } finally {
      setSaleReadySaving(false);
    }
  }
  const reviewLead = useCallback(async (lead: EducationLead,
    action: 'open_new' | 'keep_existing' | 'dismiss') => {
    try {
      await api.reviewCrmEducationLead(lead.id, { area: EDUCATION_AREA, action });
      toast.success('Conflicto resuelto');
      await Promise.all([loadContacts(), loadCycles(), loadReviewEntries()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo revisar el conflicto'); }
  }, [loadContacts, loadCycles, loadReviewEntries, toast]);

  const reloadAfterProspectia = useRef({ loadContacts, loadCycles });
  reloadAfterProspectia.current = { loadContacts, loadCycles };
  useEffect(() => {
    let cancel = false;
    let timer = 0;
    async function poll() {
      try {
        const status = await api.getCrmEducationProspectiaSync();
        if (cancel) return;
        setProspectiaSync(status);
        if (status.running) {
          prospectiaWasRunning.current = true;
          timer = window.setTimeout(() => void poll(), 2000);
          return;
        }
        if (prospectiaWasRunning.current) {
          prospectiaWasRunning.current = false;
          toast.success('Prospectia sincronizado');
          const reload = reloadAfterProspectia.current;
          await Promise.all([reload.loadContacts(), reload.loadCycles()]);
        }
        setSyncingProspectia(false);
      } catch (error) {
        if (!cancel) {
          setSyncingProspectia(false);
          toast.error(error instanceof Error ? error.message : 'No se pudo consultar el avance de Prospectia');
        }
      }
    }
    void poll();
    return () => { cancel = true; window.clearTimeout(timer); };
  }, [prospectiaWatch, toast]);

  async function syncProspectia() {
    setSyncingProspectia(true);
    try {
      await api.syncCrmEducationProspectia();
      setProspectiaWatch((value) => value + 1);
    } catch (error) {
      setSyncingProspectia(false);
      toast.error(error instanceof Error ? error.message : 'No se pudo sincronizar Prospectia');
    }
  }

  async function distributeLeads() {
    setDistributing(true);
    try {
      const result = await api.distributeCrmEducation({ categoria, channel, q: debouncedOpportunityQ });
      toast.success(`${result.assigned} leads asignados`);
      await Promise.all([loadContacts(), loadCycles(), loadReviewEntries()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudieron asignar los leads'); }
    finally { setDistributing(false); }
  }

  const areaAttributes = useMemo(() => catalog.attributes.filter((d) =>
    d.active && !d.segment_slug && d.area === EDUCATION_AREA &&
    !['dni', 'email', 'correo'].includes(d.slug),
  ).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)), [catalog]);
  const segments = useMemo(() => catalog.segments.filter((s) => s.area === EDUCATION_AREA), [catalog]);
  const segmentOptions = useMemo(() => [...new Set(segments.map((s) => s.slug))], [segments]);
  const attrOptions = useMemo(() => [...new Set(areaAttributes.map((d) => d.slug))], [areaAttributes]);
  const educationAdvisors = useMemo(
    () => managementCatalog.advisors.filter((advisor) => worksEducation(advisor.areas)),
    [managementCatalog.advisors],
  );

  const contactColumns = useMemo<ColumnDef<EducationContact>[]>(() => {
    const cols: ColumnDef<EducationContact>[] = [];
    if (visible.has('name')) cols.push({ id: 'name', header: 'Nombre', cell: ({ row }) => row.original.name || '—' });
    cols.push({ id: 'categoria', header: 'Categoría', cell: ({ row }) =>
      <Badge variant="secondary">{categoryLabel(row.original.categoria, row.original.categorias)}</Badge> });
    if (visible.has('last_name')) cols.push({ id: 'last_name', header: 'Apellido', cell: ({ row }) => row.original.last_name || '—' });
    if (visible.has('phone')) cols.push({ id: 'phone', header: 'Teléfono', cell: ({ row }) => row.original.phone || '—' });
    if (visible.has('prospectia')) cols.push({ id: 'prospectia', header: 'Prospectia', cell: ({ row }) =>
      prospectiaLabel(row.original.prospectia_match) });
    if (visible.has('wa_identity')) cols.push({ id: 'wa_identity', header: 'Usuario WhatsApp', cell: ({ row }) =>
      <div className="min-w-36">
        <div>{waUsername(row.original.wa_username) || (row.original.whatsapp_user_id ? 'Número privado' : '—')}</div>
        {row.original.whatsapp_user_id && <div className="font-mono text-xs text-muted-foreground">{row.original.whatsapp_user_id}</div>}
      </div> });
    if (visible.has('email')) cols.push({ id: 'email', header: 'Email', cell: ({ row }) => row.original.email || '—' });
    if (visible.has('dni')) cols.push({ id: 'dni', header: 'DNI', cell: ({ row }) => row.original.dni || row.original.attributes.dni || '—' });
    if (visible.has('segments')) cols.push({
      id: 'segments', header: 'Segmentos', cell: ({ row }) => row.original.segment_slugs.length ?
        <div className="flex flex-wrap gap-1">{row.original.segment_slugs.map((slug) => <Badge key={slug} variant="outline">
          {catalog.segments.find((s) => s.area === EDUCATION_AREA && s.slug === slug)?.label ?? slug}
        </Badge>)}</div> : '—',
    });
    if (visible.has('advisor')) cols.push({ id: 'advisor', header: 'Asesor',
      cell: ({ row }) => row.original.assigned_user_label || 'Sin asignar' });
    if (visible.has('lead_status')) cols.push({ id: 'lead_status', header: 'Estado del lead',
      cell: ({ row }) => row.original.lead_status_label || '—' });
    for (const definition of areaAttributes) {
      const key = `attr:${definition.slug}`;
      if (!visible.has(key) && !visible.has(`attr:${definition.area}:${definition.slug}`)) continue;
      cols.push({
        id: key, header: definition.label,
        cell: ({ row }) => row.original.attributes[definition.slug] || '—',
      });
    }
    return cols;
  }, [visible, areaAttributes, catalog.segments]);

  const cycleColumns = useMemo<ColumnDef<EducationCycle>[]>(() => [
    { id: 'categoria', header: 'Categoría', cell: ({ row }) =>
      categoryLabel(row.original.categoria) },
    {
      id: 'person', header: 'Contacto', cell: ({ row }) => {
        const cycle = row.original;
        const name = [cycle.contacts.name, cycle.contacts.last_name].filter(Boolean).join(' ');
        const username = waUsername(cycle.contacts.wa_username);
        const bsuid = cycle.contacts.whatsapp_user_id;
        return <div><div>{name || '—'}</div>
          <div className="text-xs text-muted-foreground">{[cycle.contacts.phone,
            username, !username && bsuid ? bsuid : null,
            cycle.contacts.email].filter(Boolean).join(' · ') || '—'}</div>
        </div>;
      }
    },
    { id: 'interest', header: 'Curso o interés', cell: ({ row }) =>
      row.original.curso_interes || row.original.categoria_label || row.original.categoria || '—' },
    { id: 'source', header: 'Origen reciente', cell: ({ row }) => <div>
      <div>{row.original.channel ? CHANNEL_LABELS[row.original.channel] ?? row.original.channel : '—'}</div>
      <div className="text-xs text-muted-foreground">{row.original.source_label || '—'}</div>
    </div> },
    { id: 'kind', header: 'Regla', cell: ({ row }) => {
      const rule = row.original.assignment_rule;
      return rule ? <Badge variant={rule === 'conflict' ? 'destructive' : 'outline'}>
        {rule === 'new_number' ? 'Número nuevo'
          : rule === 'same_advisor' ? 'Mismo asesor'
            : rule === 'reassignable' ? 'Puede reasignarse' : 'Conflicto'}
      </Badge> : '—';
    } },
    { id: 'advisor', header: 'Asesor', cell: ({ row }) => {
      const cycle = row.original;
      return <Select value={cycle.assigned_user_id ? String(cycle.assigned_user_id) : '__none__'}
        disabled={Boolean(cycle.closed_at) || managementSaving}
        onValueChange={(value) => void updateManagement(cycle.contact_id,
          { assigned_user_id: Number(value), lead_id: cycle.id })}>
        <SelectTrigger className="min-w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" disabled>Sin asignar</SelectItem>
          {educationAdvisors.map((advisor) =>
            <SelectItem key={advisor.id} value={String(advisor.id)}>{advisor.label}</SelectItem>)}
        </SelectContent>
      </Select>;
    } },
    { id: 'status', header: 'Estado del lead', cell: ({ row }) => {
      const cycle = row.original;
      return <LeadStatusSelect
        className="min-w-40"
        value={cycle.lead_status_id ? String(cycle.lead_status_id) : '__none__'}
        disabled={Boolean(cycle.closed_at) || managementSaving}
        statuses={managementCatalog.statuses}
        onChange={(value) => void updateManagement(cycle.contact_id,
          { lead_status_id: value === '__none__' ? null : Number(value), lead_id: cycle.id })}
      />;
    } },
    { id: 'last', header: 'Última actividad', cell: ({ row }) => formatDate(row.original.last_interaction_at) },
    { id: 'actions', header: 'Revisión', cell: ({ row }) => {
      const cycle = row.original;
      return cycle.requires_review && cycle.assigned_user_id && !cycle.closed_at
        ? <Button size="sm" variant="outline" disabled={managementSaving}
          onClick={() => void updateManagement(cycle.contact_id,
            { assigned_user_id: cycle.assigned_user_id!, lead_id: cycle.id })}>Confirmar asesor</Button>
        : '—';
    } },
  ], [educationAdvisors, managementCatalog.statuses, managementSaving, updateManagement]);

  const reviewEntryColumns = useMemo<ColumnDef<EducationLead>[]>(() => [
    { id: 'area', header: 'Área', cell: () => 'Educación' },
    { id: 'person', header: 'Contacto', cell: ({ row }) => {
      const lead = row.original;
      const name = [lead.contacts?.name, lead.contacts?.last_name].filter(Boolean).join(' ');
      return <div><div>{name || '—'}</div><div className="text-xs text-muted-foreground">
        {[lead.contacts?.phone || lead.phone, waUsername(lead.wa_username || lead.contacts?.wa_username || null),
          lead.contacts?.email || lead.email].filter(Boolean).join(' · ') || '—'}
      </div></div>;
    } },
    { id: 'source', header: 'Captación', cell: ({ row }) => <div>
      <div>{CHANNEL_LABELS[row.original.channel] ?? row.original.channel}</div>
      <div className="text-xs text-muted-foreground">{row.original.source_label || row.original.source_key || '—'}</div>
    </div> },
    { id: 'reason', header: 'Motivo', cell: ({ row }) =>
      row.original.conflict_reason === 'estado_convertido' ? 'Estado convertido o venta exitosa'
        : row.original.conflict_reason === 'no_interesado_reciente' ? 'No interesado en los últimos 60 días'
          : row.original.conflict_reason || 'Conflicto comercial' },
    { id: 'previous', header: 'Ciclo anterior', cell: ({ row }) => <div className="min-w-44 text-xs">
      <div>Asesor: {row.original.previous_advisor_label || '—'}</div>
      <div>Estado: {row.original.previous_status_label || '—'}</div>
      <div>Último contacto: {row.original.previous_interaction_at ? formatDate(row.original.previous_interaction_at) : '—'}</div>
    </div> },
    { id: 'date', header: 'Fecha', cell: ({ row }) => formatDate(row.original.last_seen_at) },
    { id: 'actions', header: 'Resolver', cell: ({ row }) => <div className="flex gap-1">
      <Button size="sm" variant="outline" onClick={() => void reviewLead(row.original, 'open_new')}>Nuevo ciclo</Button>
      <Button size="sm" variant="outline" onClick={() => void reviewLead(row.original, 'keep_existing')}>Mantener</Button>
      <Button size="sm" variant="outline" onClick={() => void reviewLead(row.original, 'dismiss')}>Descartar</Button>
    </div> },
  ], [reviewLead]);

  function changeCategoria(value: string) {
    setCategoria(value as EducationCategoryScope);
    setContactPage(1); setCyclePage(1); setReviewEntryPage(1);
    setSegment(''); setAttrKey(''); setAttrValue('');
    setExpandedId(null);
  }
  function toggleColumn(key: string) {
    if (key === 'name' || key === 'categoria') return;
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function openContact(contact: EducationContact) {
    if (expandedId === contact.contact_id) { setExpandedId(null); setDraft(null); return; }
    setExpandedId(contact.contact_id);
    setDraft({
      name: contact.name, last_name: contact.last_name, email: contact.email ?? '',
      dni: contact.dni ?? contact.attributes.dni ?? '', opt_in_email: contact.opt_in_email,
      segment_slugs: [...contact.segment_slugs],
      attributes: { ...contact.attributes }
    });
  }
  async function saveContact(contact: EducationContact) {
    if (!draft) return;
    setSaving(true);
    try {
      await api.patchCrmEducationContact(contact.contact_id, {
        area: EDUCATION_AREA, name: draft.name, last_name: draft.last_name,
        email: draft.email || null, dni: draft.dni || null,
        opt_in_email: draft.opt_in_email,
        segment_slugs: draft.segment_slugs,
        attributes: draft.attributes,
      });
      toast.success('Contacto actualizado');
      setExpandedId(null); setDraft(null);
      await loadContacts();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar'); }
    finally { setSaving(false); }
  }
  async function exportContacts() {
    setExporting(true);
    try {
      const rows: EducationContact[] = [];
      let page = 1;
      while (true) {
        const data = await api.listCrmEducationContacts({ ...contactParams, page, limit: 2000 });
        rows.push(...data.items);
        if (page >= data.pages) break;
        page += 1;
      }
      const sheet = XLSX.utils.json_to_sheet(rows.map((c) => ({
        Categoría: categoryLabel(c.categoria, c.categorias), Nombre: c.name, Apellido: c.last_name,
        Teléfono: c.phone ?? '', 'Usuario WhatsApp': waUsername(c.wa_username) ?? '',
        BSUID: c.whatsapp_user_id ?? '', Email: c.email ?? '', DNI: c.dni ?? '',
        Asesor: c.assigned_user_label ?? '',
        'Estado del lead': c.lead_status_label ?? '',
        Segmentos: c.segment_slugs.join(', '), ...c.attributes,
      })));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, 'Contactos Educación');
      XLSX.writeFile(book, `crm-educacion-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo exportar'); }
    finally { setExporting(false); }
  }

  function renderContactEditor(contact: EducationContact) {
    if (!draft) return null;
    const areaSegments = catalog.segments.filter((item) => item.area === EDUCATION_AREA);
    const segmentSlugs = [...new Set([
      ...areaSegments.map((item) => item.slug),
      ...contact.segment_slugs,
    ])];
    const definitions = catalog.attributes.filter((definition) =>
      definition.area === EDUCATION_AREA && definition.active &&
      !definition.segment_slug &&
      !['dni', 'email', 'correo'].includes(definition.slug),
    );
    return (
      <div className="max-w-3xl space-y-4 p-4" onClick={(event) => event.stopPropagation()}>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ['name', 'Nombre'], ['last_name', 'Apellido'],
            ['email', 'Email'], ['dni', 'DNI'],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input value={draft[key]} onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })} />
            </div>
          ))}
          {definitions.map((definition) => (
            <div key={definition.id} className="space-y-1">
              <Label>{definition.label}</Label>
              <Input
                value={draft.attributes[definition.slug] ?? ''}
                onChange={(event) => setDraft({
                  ...draft,
                  attributes: {
                    ...draft.attributes,
                    [definition.slug]: event.target.value,
                  },
                })}
              />
            </div>
          ))}
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Segmentos</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {segmentSlugs.map((slug) => {
                const definition = areaSegments.find((item) => item.slug === slug);
                return <label key={slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.segment_slugs.includes(slug)}
                    onChange={(event) => setDraft((current) => {
                      if (!current) return current;
                      const next = new Set(current.segment_slugs);
                      if (event.target.checked) next.add(slug);
                      else next.delete(slug);
                      return { ...current, segment_slugs: [...next] };
                    })}
                  />
                  {definition?.label ?? `${slug} (inactivo)`}
                </label>;
              })}
              {segmentSlugs.length === 0 && <span className="text-sm text-muted-foreground">
                No hay segmentos configurados para Educación.
              </span>}
            </div>
          </fieldset>
          <div className="space-y-1">
            <Label>Asesor responsable</Label>
            <Select value={contact.assigned_user_id ? String(contact.assigned_user_id) : '__none__'}
              disabled={managementSaving}
              onValueChange={(value) => void updateManagement(contact.contact_id,
                { assigned_user_id: Number(value), ...(contact.lead_id ? { lead_id: contact.lead_id } : {}) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>Sin asignar</SelectItem>
                {educationAdvisors.map((advisor) =>
                  <SelectItem key={advisor.id} value={String(advisor.id)}>{advisor.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {contact.requires_review && contact.assigned_user_id &&
              <Button size="sm" variant="outline" disabled={managementSaving}
                onClick={() => void updateManagement(contact.contact_id,
                  { assigned_user_id: contact.assigned_user_id!,
                    ...(contact.lead_id ? { lead_id: contact.lead_id } : {}) })}>
                Confirmar asesor
              </Button>}
          </div>
          <div className="space-y-1">
            <Label>Estado del lead</Label>
            <LeadStatusSelect
              value={contact.lead_status_id ? String(contact.lead_status_id) : '__none__'}
              disabled={managementSaving}
              statuses={managementCatalog.statuses}
              onChange={(value) => void updateManagement(contact.contact_id,
                { lead_status_id: value === '__none__' ? null : Number(value),
                  ...(contact.lead_id ? { lead_id: contact.lead_id } : {}) })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.opt_in_email} onChange={(event) =>
            setDraft({ ...draft, opt_in_email: event.target.checked })} />
          Acepta correos
        </label>
        <Button disabled={saving} onClick={() => void saveContact(contact)}>
          <Save className="mr-1 size-4" />Guardar en WhatsApp
        </Button>
      </div>
    );
  }

  return <div className="space-y-6">
    <Dialog open={Boolean(saleReadyPrompt)} onOpenChange={(open) => {
      if (!open && !saleReadySaving) setSaleReadyPrompt(null);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Completar datos para venta exitosa</DialogTitle>
          <DialogDescription>
            El estado no cambió. Completa lo faltante o cancela y sigue en el estado anterior.
          </DialogDescription>
        </DialogHeader>
        {saleReadyPrompt && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Falta:{' '}
              {saleReadyPrompt.missing
                .map((field) => SALE_MISSING_LABELS[field] ?? field)
                .join(', ')}
            </p>
            {saleReadyPrompt.missing.includes('categoria') && (
              <p className="text-sm text-muted-foreground">
                La categoría CA/EP del ciclo debe existir en la oportunidad; no se edita aquí.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['name', 'Nombre'],
                ['last_name', 'Apellido'],
                ['email', 'Email'],
                ['dni', 'DNI'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    value={saleReadyPrompt[key]}
                    disabled={saleReadySaving}
                    onChange={(event) => setSaleReadyPrompt({
                      ...saleReadyPrompt,
                      [key]: event.target.value,
                    })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saleReadySaving}
            onClick={() => setSaleReadyPrompt(null)}
          >
            Cancelar
          </Button>
          <Button disabled={saleReadySaving} onClick={() => void completeSaleReadyAndRetry()}>
            Guardar y marcar venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={manualLeadOpen} onOpenChange={(open) => {
      if (manualLeadSaving) return;
      setManualLeadOpen(open);
      if (!open) {
        setManualLeadDraft(EMPTY_MANUAL_LEAD);
        setManualLeadExists(null);
      }
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar lead</DialogTitle>
          <DialogDescription>
            Históricos, solo llamada u orgánicos sin chat de WhatsApp. Si ya existe, no se crea otro.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select
              value={manualLeadDraft.source_key}
              onValueChange={(value) => setManualLeadDraft({
                ...manualLeadDraft,
                source_key: value as ManualLeadDraft['source_key'],
              })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_call">Llamada</SelectItem>
                <SelectItem value="manual_historical">Histórico</SelectItem>
                <SelectItem value="manual_organic">Orgánico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Categoría</Label>
            <Select
              value={manualLeadDraft.categoria}
              onValueChange={(value) => setManualLeadDraft({
                ...manualLeadDraft,
                categoria: value as 'ca' | 'ep',
              })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ep">EP</SelectItem>
                <SelectItem value="ca">CA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {([
            ['name', 'Nombre'],
            ['last_name', 'Apellido'],
            ['phone', 'Teléfono'],
            ['email', 'Email'],
            ['dni', 'DNI'],
            ['curso', 'Curso / interés'],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input
                value={manualLeadDraft[key]}
                disabled={manualLeadSaving}
                onChange={(event) => setManualLeadDraft({
                  ...manualLeadDraft,
                  [key]: event.target.value,
                })}
              />
            </div>
          ))}
        </div>
        {manualLeadExists && (
          <p className="text-sm text-muted-foreground">
            Ya existe el contacto #{manualLeadExists.contact_id}
            {manualLeadExists.lead_status_label ? ` · ${manualLeadExists.lead_status_label}` : ''}
            {manualLeadExists.assigned_user_label ? ` · ${manualLeadExists.assigned_user_label}` : ''}.
            Ábrelo en Contactos u Oportunidades; no se creó un lead nuevo.
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={manualLeadSaving}
            onClick={() => setManualLeadOpen(false)}
          >
            Cancelar
          </Button>
          <Button disabled={manualLeadSaving} onClick={() => void submitManualLead()}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <PageHeader
      title="CRM Educación"
      description="Vitrina de fichas y oportunidades de Educación (área única) con filtro por categoría CA/EP/General."
    />
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-56 space-y-1">
        <Label>Categoría</Label>
        <Select value={categoria} onValueChange={changeCategoria}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORY_SCOPES.map((item) => <SelectItem key={item} value={item}>
              {CATEGORY_SCOPE_LABELS[item]}
            </SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" onClick={() => {
        setManualLeadExists(null);
        setManualLeadDraft(EMPTY_MANUAL_LEAD);
        setManualLeadOpen(true);
      }}>
        <Plus className="mr-1 size-4" />Registrar lead
      </Button>
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="contacts">Contactos</TabsTrigger>
        <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
        <TabsTrigger value="payments">Pagos</TabsTrigger>
        <TabsTrigger value="campaigns">Campañas</TabsTrigger>
      </TabsList>
      <TabsContent value="contacts" className="space-y-4">
        {contactError && <AlertBanner variant="error">{contactError}</AlertBanner>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Buscar</Label>
            <Input value={contactQ} placeholder="Nombre, @usuario, BSUID, teléfono…" className="w-64"
              onChange={(event) => { setContactQ(event.target.value); setContactPage(1); }} />
          </div>
          <div className="space-y-1">
            <Label>Segmento</Label>
            <Select value={segment || '__all__'} onValueChange={(value) => {
              setSegment(value === '__all__' ? '' : value);
              setContactPage(1);
            }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {segmentOptions.map((slug) => <SelectItem key={slug} value={slug}>
                  {segments.find((item) => item.slug === slug)?.label ?? slug}
                </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Atributo</Label>
            <Select value={attrKey || '__none__'} onValueChange={(value) => {
              setAttrKey(value === '__none__' ? '' : value);
              setContactPage(1);
            }}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Ninguno</SelectItem>
                {attrOptions.map((slug) => <SelectItem key={slug} value={slug}>
                  {areaAttributes.find((item) => item.slug === slug)?.label ?? slug}
                </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {attrKey && <div className="space-y-1">
            <Label>Valor</Label>
            <Input value={attrValue} className="w-40" onChange={(event) => {
              setAttrValue(event.target.value);
              setContactPage(1);
            }} />
          </div>}
          <Button variant="secondary" disabled={exporting || !contactTotal}
            onClick={() => void exportContacts()}>
            <Download className="mr-1 size-4" />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Columns3 className="mr-1 size-4" />Columnas</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Columnas fijas</DropdownMenuLabel>
              {FIXED_COLUMNS.map(([key, label]) => <DropdownMenuCheckboxItem
                key={key}
                checked={key === 'categoria' || visible.has(key)}
                disabled={key === 'categoria' || key === 'name'}
                onCheckedChange={() => toggleColumn(key)}
                onSelect={(event) => event.preventDefault()}
              >{label}</DropdownMenuCheckboxItem>)}
              <DropdownMenuLabel>Atributos WhatsApp</DropdownMenuLabel>
              {areaAttributes.map((definition) => {
                const key = `attr:${definition.slug}`;
                return <DropdownMenuCheckboxItem
                  key={key}
                  checked={visible.has(key) || visible.has(`attr:${definition.area}:${definition.slug}`)}
                  onCheckedChange={() => toggleColumn(key)}
                  onSelect={(event) => event.preventDefault()}
                >{definition.label}</DropdownMenuCheckboxItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-sm text-muted-foreground">{contactTotal} contactos</span>
        </div>
        {contactLoading ? <TableSkeleton rows={8} cols={7} /> : contacts.length === 0 ?
          <EmptyState title="Sin contactos" description="No hay contactos para estos filtros." /> :
          <DataTable
            columns={contactColumns}
            data={contacts}
            getRowId={(contact) => String(contact.contact_id)}
            onRowClick={openContact}
            isRowExpanded={(contact) => expandedId === contact.contact_id}
            renderExpandedRow={renderContactEditor}
          />}
        <div className="flex items-center justify-end gap-3 text-sm">
          <span>Página {contactPage} de {Math.max(1, Math.ceil(contactTotal / PAGE_SIZE))}</span>
          <Button variant="outline" disabled={contactPage <= 1}
            onClick={() => setContactPage((page) => page - 1)}>Anterior</Button>
          <Button variant="outline" disabled={contactPage * PAGE_SIZE >= contactTotal}
            onClick={() => setContactPage((page) => page + 1)}>Siguiente</Button>
        </div>
      </TabsContent>
      <TabsContent value="opportunities" className="space-y-4">
        {cycleError && <AlertBanner variant="error">{cycleError}</AlertBanner>}
        {slaError ? (
          <p className="text-xs text-muted-foreground">SLA: {slaError}</p>
        ) : sla ? (
          <p className="text-sm text-muted-foreground">
            SLA 1.ª respuesta (≤{sla.summary.sla_minutes} min, {sla.filters.from} → {sla.filters.to}):
            {' '}promedio <strong>{sla.summary.avg_first_response_minutes} min</strong>
            {' · '}{sla.summary.sla_met_pct}% dentro de SLA
            {' · '}respondidos {sla.summary.answered_count}
            {' · '}sin respuesta {sla.summary.unanswered_open_count}
            {sla.by_advisor.length > 0 ? (
              <>
                <br />
                <span className="text-xs">
                  Por asesor:{' '}
                  {sla.by_advisor
                    .map((row) =>
                      `${row.advisor_label} ${row.avg_first_response_minutes} min (${row.sla_met_pct}%)`,
                    )
                    .join(' · ')}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['open', 'Abiertas', cycleCounts.open],
            ['closed', 'Cerradas', cycleCounts.closed],
            ['review', 'Requieren revisión', cycleCounts.review + reviewEntryTotal],
            ['unassigned', 'Sin asignar', cycleCounts.unassigned],
          ] as const).map(([key, label, count]) => <Button key={key}
            size="sm" variant={opportunityView === key ? 'default' : 'outline'}
            onClick={() => { setOpportunityView(key); setCyclePage(1); setReviewEntryPage(1); }}>
            {label}<Badge variant={(key === 'review' || key === 'unassigned') && count > 0 ? 'destructive' : 'secondary'}
              className="ml-2">{count}</Badge>
          </Button>)}
        </div>
        <p className="text-xs text-muted-foreground">
          Cada fila representa un ciclo comercial. Las captaciones alimentan el origen reciente;
          los conflictos de reingreso se resuelven por separado dentro de Requieren revisión.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Buscar</Label>
            <Input value={opportunityQ} placeholder="Contacto, @usuario, teléfono, fuente…" className="w-72"
              onChange={(event) => { setOpportunityQ(event.target.value); setCyclePage(1); setReviewEntryPage(1); }} />
          </div>
          <div className="space-y-1">
            <Label>Canal</Label>
            <Select value={channel || '__all__'} onValueChange={(value) => {
              setChannel(value === '__all__' ? '' : value);
              setCyclePage(1); setReviewEntryPage(1);
            }}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los canales</SelectItem>
                {Object.entries(CHANNEL_LABELS).map(([value, label]) =>
                  <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(opportunityView === 'open' || opportunityView === 'unassigned') && <Button disabled={distributing}
            onClick={() => void distributeLeads()}>
            <UsersRound className="mr-1 size-4" />
            {distributing ? 'Asignando…' : 'Asignar automáticamente'}
          </Button>}
          <Button variant="outline" disabled={syncingProspectia || prospectiaSync.running}
            onClick={() => void syncProspectia()}>
            {prospectiaSync.running && prospectiaSync.total > 0
              ? `Sincronizando ${prospectiaSync.processed.toLocaleString('es-PE')} de ${prospectiaSync.total.toLocaleString('es-PE')}`
              : syncingProspectia || prospectiaSync.running
                ? 'Sincronizando…'
                : 'Sincronizar Prospectia'}
          </Button>
          {prospectiaSync.finished_at && !prospectiaSync.running && (
            <span className="text-sm text-muted-foreground">
              Última sincronización: {formatDate(prospectiaSync.finished_at)}
            </span>
          )}
          <span className="text-sm text-muted-foreground">{cycleTotal} oportunidades</span>
        </div>
        {opportunityView === 'review' && <div className="space-y-2">
          <h3 className="text-sm font-semibold">Asesor por confirmar</h3>
          {cycleLoading ? <TableSkeleton rows={5} cols={7} /> : cycles.length === 0 ?
            <EmptyState title="Sin asesores por confirmar" description="No hay ciclos pendientes de confirmación." /> :
            <DataTable columns={cycleColumns} data={cycles}
              getRowId={(cycle) => String(cycle.id)} tableClassName="min-w-full" />}
        </div>}
        {opportunityView !== 'review' && (cycleLoading ? <TableSkeleton rows={8} cols={7} /> : cycles.length === 0 ?
          <EmptyState title="Sin oportunidades" description="No hay ciclos comerciales para estos filtros." /> :
          <DataTable columns={cycleColumns} data={cycles}
            getRowId={(cycle) => String(cycle.id)} tableClassName="min-w-full" />)}
        <div className="flex items-center justify-end gap-3 text-sm">
          <span>Página {cyclePage} de {Math.max(1, Math.ceil(cycleTotal / PAGE_SIZE))}</span>
          <Button variant="outline" disabled={cyclePage <= 1}
            onClick={() => setCyclePage((page) => page - 1)}>Anterior</Button>
          <Button variant="outline" disabled={cyclePage * PAGE_SIZE >= cycleTotal}
            onClick={() => setCyclePage((page) => page + 1)}>Siguiente</Button>
        </div>
        {opportunityView === 'review' && <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-semibold">Conflictos comerciales</h3>
            <p className="text-xs text-muted-foreground">
              Reingresos que requieren decidir si abren un ciclo nuevo o conservan el anterior.
            </p>
          </div>
          {reviewEntryError && <AlertBanner variant="error">{reviewEntryError}</AlertBanner>}
          {reviewEntryLoading ? <TableSkeleton rows={5} cols={6} /> : reviewEntries.length === 0 ?
            <EmptyState title="Sin conflictos comerciales" description="No hay captaciones pendientes de decisión." /> :
            <DataTable columns={reviewEntryColumns} data={reviewEntries}
              getRowId={(lead) => String(lead.id)} tableClassName="min-w-full" />}
          <div className="flex items-center justify-end gap-3 text-sm">
            <span>Página {reviewEntryPage} de {Math.max(1, Math.ceil(reviewEntryTotal / PAGE_SIZE))}</span>
            <Button variant="outline" disabled={reviewEntryPage <= 1}
              onClick={() => setReviewEntryPage((page) => page - 1)}>Anterior</Button>
            <Button variant="outline" disabled={reviewEntryPage * PAGE_SIZE >= reviewEntryTotal}
              onClick={() => setReviewEntryPage((page) => page + 1)}>Siguiente</Button>
          </div>
        </div>}
      </TabsContent>
      <TabsContent value="payments">
        <EmptyState title="Pagos próximamente" description="Esta sección estará disponible más adelante." />
      </TabsContent>
      <TabsContent value="campaigns">
        <EmptyState title="Campañas próximamente" description="Esta sección estará disponible cuando termine su configuración." />
      </TabsContent>
    </Tabs>
  </div>;
}
