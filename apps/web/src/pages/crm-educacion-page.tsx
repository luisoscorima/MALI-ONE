import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Columns3, Download, Save, UsersRound } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { api, type EducationArea, type EducationCatalog, type EducationContact,
  type EducationLead, type EducationLeadCounts, type EducationManagementCatalog } from '@/lib/api';
import {
  Badge, Button, DataTable, DropdownMenu, DropdownMenuCheckboxItem,
  DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui';

const AREA_LABELS: Record<EducationArea, string> = {
  educacion: 'Educación',
  educacion_ca: 'Educación CA',
  educacion_ep: 'Educación EP',
};
const AREAS = Object.keys(AREA_LABELS) as EducationArea[];
const CHANNEL_LABELS: Record<string, string> = {
  meta_lead_form: 'Formulario Meta', meta_ctwa: 'Anuncio a WhatsApp',
  widget: 'Widget web', tiktok: 'TikTok', import: 'Importación',
  manual: 'Manual', organic_wa: 'WhatsApp orgánico',
  mali_one_link: 'Enlace / QR MALI ONE', other: 'Otro',
};
const FIXED_COLUMNS = [
  ['name', 'Nombre'], ['area', 'Número'], ['last_name', 'Apellido'],
  ['phone', 'Teléfono'], ['email', 'Email'], ['dni', 'DNI'],
  ['segments', 'Segmentos'], ['advisor', 'Asesor'], ['lead_status', 'Estado del lead'],
] as const;
const STORAGE_KEY = 'crm-educacion-contact-cols-v2';
const PAGE_SIZE = 50;

function storedColumns(): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (Array.isArray(value)) return new Set(value.filter((v): v is string => typeof v === 'string'));
  } catch { /* Prefer defaults when storage is invalid. */ }
  return new Set(FIXED_COLUMNS.map(([id]) => id));
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima' });
}

type DraftContact = Pick<EducationContact, 'name' | 'last_name' | 'opt_in_email' | 'segment_slugs' | 'attributes'> & {
  email: string; dni: string;
};

export function CrmEducacionPage() {
  const toast = useToast();
  const [tab, setTab] = useState('contacts');
  const [area, setArea] = useState<EducationArea | 'all'>('all');
  const [catalog, setCatalog] = useState<EducationCatalog>({ attributes: [], segments: [] });
  const [contacts, setContacts] = useState<EducationContact[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactPage, setContactPage] = useState(1);
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState('');
  const contactRequestId = useRef(0);
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
  const [leads, setLeads] = useState<EducationLead[]>([]);
  const [leadTotal, setLeadTotal] = useState(0);
  const [leadPage, setLeadPage] = useState(1);
  const [leadLoading, setLeadLoading] = useState(true);
  const [leadError, setLeadError] = useState('');
  const [leadQ, setLeadQ] = useState('');
  const [debouncedLeadQ, setDebouncedLeadQ] = useState('');
  const [channel, setChannel] = useState('');
  const [leadView, setLeadView] = useState<'recent' | 'new_number' | 'duplicate' | 'reassignable' | 'conflict' | 'in_progress' | 'all'>('recent');
  const [unassigned, setUnassigned] = useState(false);
  const [leadCounts, setLeadCounts] = useState<EducationLeadCounts>({
    recent: 0, new_number: 0, duplicate: 0, reassignable: 0,
    conflict: 0, in_progress: 0, unassigned: 0, eligible: 0,
  });
  const [managementCatalog, setManagementCatalog] = useState<EducationManagementCatalog>({ advisors: [], statuses: [] });
  const [managementSaving, setManagementSaving] = useState(false);
  const [distributing, setDistributing] = useState(false);

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
    const timer = window.setTimeout(() => setDebouncedLeadQ(leadQ.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [leadQ]);

  const contactParams = useMemo(() => ({
    area, q: debouncedContactQ, segment, attr_key: attrKey,
    attr_value: debouncedAttrValue, page: contactPage, limit: PAGE_SIZE,
  }), [area, debouncedContactQ, segment, attrKey, debouncedAttrValue, contactPage]);
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
  const leadParams = useMemo(() => ({
    area, channel, q: debouncedLeadQ, view: leadView, unassigned,
    page: leadPage, limit: PAGE_SIZE,
  }), [area, channel, debouncedLeadQ, leadView, unassigned, leadPage]);
  const loadLeads = useCallback(async () => {
    setLeadLoading(true);
    setLeadError('');
    try {
      const data = await api.listCrmEducationLeads(leadParams);
      setLeads(data.items);
      setLeadTotal(data.total);
      setLeadCounts(data.counts);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : 'No se pudieron cargar los leads');
    } finally { setLeadLoading(false); }
  }, [leadParams]);
  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const updateManagement = useCallback(async (contactId: number, contactArea: EducationArea,
    changes: { assigned_user_id?: number | null; lead_status_id?: number | null }) => {
    setManagementSaving(true);
    try {
      await api.patchCrmEducationManagement(contactId, { area: contactArea, ...changes });
      toast.success('Lead actualizado');
      await Promise.all([loadContacts(), loadLeads()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el lead'); }
    finally { setManagementSaving(false); }
  }, [loadContacts, loadLeads, toast]);
  const reviewLead = useCallback(async (lead: EducationLead,
    action: 'open_new' | 'keep_existing' | 'dismiss') => {
    try {
      await api.reviewCrmEducationLead(lead.id, { area: lead.area, action });
      toast.success('Conflicto resuelto');
      await Promise.all([loadContacts(), loadLeads()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo revisar el conflicto'); }
  }, [loadContacts, loadLeads, toast]);

  async function distributeLeads() {
    setDistributing(true);
    try {
      const result = await api.distributeCrmEducation({ area, channel, q: debouncedLeadQ });
      toast.success(`${result.assigned} leads asignados`);
      await Promise.all([loadContacts(), loadLeads()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudieron asignar los leads'); }
    finally { setDistributing(false); }
  }

  const areaAttributes = useMemo(() => catalog.attributes.filter((d) =>
    d.active && !d.segment_slug && (area === 'all' || d.area === area) &&
    !['dni', 'email', 'correo'].includes(d.slug),
  ).sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)), [catalog, area]);
  const segments = useMemo(() => catalog.segments.filter((s) => area === 'all' || s.area === area), [catalog, area]);
  const segmentOptions = useMemo(() => [...new Set(segments.map((s) => s.slug))], [segments]);
  const attrOptions = useMemo(() => [...new Set(areaAttributes.map((d) => d.slug))], [areaAttributes]);

  const contactColumns = useMemo<ColumnDef<EducationContact>[]>(() => {
    const cols: ColumnDef<EducationContact>[] = [];
    if (visible.has('name')) cols.push({ id: 'name', header: 'Nombre', cell: ({ row }) => row.original.name || '—' });
    cols.push({ id: 'area', header: 'Número', cell: ({ row }) => <Badge variant="secondary">{AREA_LABELS[row.original.area]}</Badge> });
    if (visible.has('last_name')) cols.push({ id: 'last_name', header: 'Apellido', cell: ({ row }) => row.original.last_name || '—' });
    if (visible.has('phone')) cols.push({ id: 'phone', header: 'Teléfono', cell: ({ row }) => row.original.phone || '—' });
    if (visible.has('email')) cols.push({ id: 'email', header: 'Email', cell: ({ row }) => row.original.email || '—' });
    if (visible.has('dni')) cols.push({ id: 'dni', header: 'DNI', cell: ({ row }) => row.original.dni || row.original.attributes.dni || '—' });
    if (visible.has('segments')) cols.push({
      id: 'segments', header: 'Segmentos', cell: ({ row }) => row.original.segment_slugs.length ?
        <div className="flex flex-wrap gap-1">{row.original.segment_slugs.map((slug) => <Badge key={slug} variant="outline">
          {catalog.segments.find((s) => s.area === row.original.area && s.slug === slug)?.label ?? slug}
        </Badge>)}</div> : '—',
    });
    if (visible.has('advisor')) cols.push({ id: 'advisor', header: 'Asesor',
      cell: ({ row }) => row.original.assigned_user_label || 'Sin asignar' });
    if (visible.has('lead_status')) cols.push({ id: 'lead_status', header: 'Estado del lead',
      cell: ({ row }) => row.original.lead_status_label || '—' });
    for (const definition of areaAttributes) {
      const key = `attr:${definition.area}:${definition.slug}`;
      if (!visible.has(key)) continue;
      cols.push({
        id: key, header: `${AREA_LABELS[definition.area]} · ${definition.label}`,
        cell: ({ row }) => row.original.area === definition.area ? row.original.attributes[definition.slug] || '—' : '—'
      });
    }
    return cols;
  }, [visible, areaAttributes, catalog.segments]);

  const leadColumns = useMemo<ColumnDef<EducationLead>[]>(() => [
    { id: 'area', header: 'Número', cell: ({ row }) => AREA_LABELS[row.original.area] },
    {
      id: 'person', header: 'Contacto', cell: ({ row }) => {
        const lead = row.original;
        const name = [lead.contacts?.name, lead.contacts?.last_name].filter(Boolean).join(' ');
        return <div><div>{name || '—'}</div><div className="text-xs text-muted-foreground">{lead.contacts?.phone || lead.phone || lead.contacts?.email || lead.email || '—'}</div></div>;
      }
    },
    { id: 'channel', header: 'Canal', cell: ({ row }) => CHANNEL_LABELS[row.original.channel] ?? row.original.channel },
    { id: 'source', header: 'Fuente', cell: ({ row }) => row.original.source_label || row.original.source_key || '—' },
    { id: 'kind', header: 'Regla', cell: ({ row }) => {
      const lead = row.original;
      return <div className="space-y-1"><Badge variant={lead.classification === 'conflict' ? 'destructive' : 'outline'}>
        {lead.assignment_rule === 'new_number' ? 'Número nuevo'
          : lead.assignment_rule === 'same_advisor' ? 'Mismo asesor'
            : lead.assignment_rule === 'reassignable' ? 'Puede reasignarse' : 'Conflicto'}
      </Badge>{lead.conflict_reason && <div className="text-xs text-muted-foreground">
        {lead.conflict_reason === 'estado_convertido' ? 'Estado convertido o venta exitosa'
          : lead.conflict_reason === 'no_interesado_reciente' ? 'No interesado en los últimos 60 días'
          : lead.conflict_reason}
      </div>}</div>;
    } },
    { id: 'previous', header: 'Historial anterior', cell: ({ row }) => {
      const lead = row.original;
      return <div className="min-w-44 text-xs">
        <div>Asesor: {lead.previous_advisor_label || '—'}</div>
        <div>Estado: {lead.previous_status_label || '—'}</div>
        <div>Último contacto: {lead.previous_interaction_at ? formatDate(lead.previous_interaction_at) : '—'}</div>
      </div>;
    } },
    { id: 'advisor', header: 'Asesor', cell: ({ row }) => {
      const lead = row.original;
      return <Select value={lead.assigned_user_id ? String(lead.assigned_user_id) : '__none__'}
        disabled={!lead.is_current_cycle || managementSaving}
        onValueChange={(value) => void updateManagement(lead.contact_id!, lead.area,
          { assigned_user_id: Number(value) })}>
        <SelectTrigger className="min-w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__" disabled>Sin asignar</SelectItem>
          {managementCatalog.advisors.filter((advisor) => advisor.areas.includes(lead.area))
            .map((advisor) => <SelectItem key={advisor.id} value={String(advisor.id)}>{advisor.label}</SelectItem>)}
        </SelectContent>
      </Select>;
    } },
    { id: 'status', header: 'Estado del lead', cell: ({ row }) => {
      const lead = row.original;
      return <Select value={lead.lead_status_id ? String(lead.lead_status_id) : '__none__'}
        disabled={!lead.is_current_cycle || managementSaving}
        onValueChange={(value) => void updateManagement(lead.contact_id!, lead.area,
          { lead_status_id: value === '__none__' ? null : Number(value) })}>
        <SelectTrigger className="min-w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sin estado</SelectItem>
          {managementCatalog.statuses.filter((status) => status.area === lead.area)
            .map((status) => <SelectItem key={status.id} value={String(status.id)}>{status.label}</SelectItem>)}
        </SelectContent>
      </Select>;
    } },
    { id: 'first', header: 'Primera captación', cell: ({ row }) => formatDate(row.original.first_seen_at) },
    { id: 'last', header: 'Última actividad', cell: ({ row }) => formatDate(row.original.last_seen_at) },
    { id: 'actions', header: 'Revisión', cell: ({ row }) => {
      const lead = row.original;
      if (lead.classification === 'conflict') return <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => void reviewLead(lead, 'open_new')}>Nuevo ciclo</Button>
        <Button size="sm" variant="outline" onClick={() => void reviewLead(lead, 'keep_existing')}>Mantener</Button>
        <Button size="sm" variant="outline" onClick={() => void reviewLead(lead, 'dismiss')}>Descartar</Button>
      </div>;
      return lead.assignment_rule === 'reassignable' && lead.is_current_cycle &&
        lead.requires_review && lead.assigned_user_id
        ? <Button size="sm" variant="outline" disabled={managementSaving}
          onClick={() => void updateManagement(lead.contact_id!, lead.area,
            { assigned_user_id: lead.assigned_user_id! })}>Confirmar asesor</Button>
        : '—';
    } },
  ], [managementCatalog, managementSaving, updateManagement, reviewLead]);

  function changeArea(value: string) {
    setArea(value as EducationArea | 'all');
    setContactPage(1); setLeadPage(1);
    setSegment(''); setAttrKey(''); setAttrValue('');
    setExpandedId(null);
  }
  function toggleColumn(key: string) {
    if (key === 'name' || key === 'area') return;
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
        area: contact.area, name: draft.name, last_name: draft.last_name,
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
        Número: AREA_LABELS[c.area], Nombre: c.name, Apellido: c.last_name,
        Teléfono: c.phone ?? '', Email: c.email ?? '', DNI: c.dni ?? '',
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
    const areaSegments = catalog.segments.filter((item) => item.area === contact.area);
    const segmentSlugs = [...new Set([
      ...areaSegments.map((item) => item.slug),
      ...contact.segment_slugs,
    ])];
    const definitions = catalog.attributes.filter((definition) =>
      definition.area === contact.area && definition.active &&
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
                No hay segmentos configurados para este número.
              </span>}
            </div>
          </fieldset>
          <div className="space-y-1">
            <Label>Asesor responsable</Label>
            <Select value={contact.assigned_user_id ? String(contact.assigned_user_id) : '__none__'}
              disabled={managementSaving}
              onValueChange={(value) => void updateManagement(contact.contact_id, contact.area,
                { assigned_user_id: Number(value) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>Sin asignar</SelectItem>
                {managementCatalog.advisors.filter((advisor) => advisor.areas.includes(contact.area))
                  .map((advisor) => <SelectItem key={advisor.id} value={String(advisor.id)}>{advisor.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {contact.requires_review && contact.assigned_user_id &&
              <Button size="sm" variant="outline" disabled={managementSaving}
                onClick={() => void updateManagement(contact.contact_id, contact.area,
                  { assigned_user_id: contact.assigned_user_id! })}>
                Confirmar asesor
              </Button>}
          </div>
          <div className="space-y-1">
            <Label>Estado del lead</Label>
            <Select value={contact.lead_status_id ? String(contact.lead_status_id) : '__none__'}
              disabled={managementSaving}
              onValueChange={(value) => void updateManagement(contact.contact_id, contact.area,
                { lead_status_id: value === '__none__' ? null : Number(value) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin estado</SelectItem>
                {managementCatalog.statuses.filter((status) => status.area === contact.area)
                  .map((status) => <SelectItem key={status.id} value={String(status.id)}>{status.label}</SelectItem>)}
              </SelectContent>
            </Select>
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
    <PageHeader
      title="CRM Educación"
      description="Contactos y captaciones de los tres números de Educación."
    />
    <div className="w-56 space-y-1">
      <Label>Número</Label>
      <Select value={area} onValueChange={changeArea}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los números</SelectItem>
          {AREAS.map((item) => <SelectItem key={item} value={item}>
            {AREA_LABELS[item]}
          </SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="contacts">Contactos</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
        <TabsTrigger value="payments">Pagos</TabsTrigger>
        <TabsTrigger value="campaigns">Campañas</TabsTrigger>
      </TabsList>
      <TabsContent value="contacts" className="space-y-4">
        {contactError && <AlertBanner variant="error">{contactError}</AlertBanner>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Buscar</Label>
            <Input value={contactQ} placeholder="Nombre, teléfono, email…" className="w-56"
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
                checked={key === 'area' || visible.has(key)}
                disabled={key === 'area' || key === 'name'}
                onCheckedChange={() => toggleColumn(key)}
                onSelect={(event) => event.preventDefault()}
              >{label}</DropdownMenuCheckboxItem>)}
              <DropdownMenuLabel>Atributos WhatsApp</DropdownMenuLabel>
              {areaAttributes.map((definition) => {
                const key = `attr:${definition.area}:${definition.slug}`;
                return <DropdownMenuCheckboxItem
                  key={key}
                  checked={visible.has(key)}
                  onCheckedChange={() => toggleColumn(key)}
                  onSelect={(event) => event.preventDefault()}
                >{AREA_LABELS[definition.area]} · {definition.label}</DropdownMenuCheckboxItem>;
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
      <TabsContent value="leads" className="space-y-4">
        {leadError && <AlertBanner variant="error">{leadError}</AlertBanner>}
        <div className="flex flex-wrap items-center gap-2">
          {([
            ['recent', 'Nuevos', leadCounts.recent],
            ['new_number', 'Números nuevos', leadCounts.new_number],
            ['duplicate', 'Duplicados', leadCounts.duplicate],
            ['reassignable', 'Puede reasignarse', leadCounts.reassignable],
            ['conflict', 'Conflictos', leadCounts.conflict],
            ['in_progress', 'En curso', leadCounts.in_progress],
            ['all', 'Historial', null],
          ] as const).map(([key, label, count]) => <Button key={key}
            size="sm" variant={leadView === key ? 'default' : 'outline'}
            onClick={() => { setLeadView(key); setLeadPage(1); }}>
            {label}{count !== null && <Badge variant={count > 0 ? 'destructive' : 'secondary'}
              className="ml-2">{count}</Badge>}
          </Button>)}
          <Button size="sm" variant={unassigned ? 'default' : 'outline'}
            onClick={() => { setUnassigned((value) => !value); setLeadPage(1); }}>
            Sin asignar <Badge variant={leadCounts.unassigned > 0 ? 'destructive' : 'secondary'}
              className="ml-2">{leadCounts.unassigned}</Badge>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Nuevos reúne todas las captaciones de los últimos 60 días, incluidos duplicados y casos en curso.
          La asignación automática solo incluye números sin historial en este número de Educación;
          los regresos de más de 60 días conservan al asesor anterior hasta que se confirme o cambie.
          Los contadores de los filtros pueden superponerse.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Buscar</Label>
            <Input value={leadQ} placeholder="Contacto, teléfono, fuente…" className="w-64"
              onChange={(event) => { setLeadQ(event.target.value); setLeadPage(1); }} />
          </div>
          <div className="space-y-1">
            <Label>Canal</Label>
            <Select value={channel || '__all__'} onValueChange={(value) => {
              setChannel(value === '__all__' ? '' : value);
              setLeadPage(1);
            }}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los canales</SelectItem>
                {Object.entries(CHANNEL_LABELS).map(([value, label]) =>
                  <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {leadView === 'recent' && <Button disabled={distributing || leadCounts.eligible === 0}
            onClick={() => void distributeLeads()}>
            <UsersRound className="mr-1 size-4" />
            {distributing ? 'Asignando…' : `Asignar automáticamente (${leadCounts.eligible})`}
          </Button>}
          <span className="text-sm text-muted-foreground">{leadTotal} captaciones</span>
        </div>
        {leadLoading ? <TableSkeleton rows={8} cols={7} /> : leads.length === 0 ?
          <EmptyState title="Sin leads" description="No hay captaciones para estos filtros." /> :
          <DataTable columns={leadColumns} data={leads}
            getRowId={(lead) => String(lead.id)} tableClassName="min-w-full" />}
        <div className="flex items-center justify-end gap-3 text-sm">
          <span>Página {leadPage} de {Math.max(1, Math.ceil(leadTotal / PAGE_SIZE))}</span>
          <Button variant="outline" disabled={leadPage <= 1}
            onClick={() => setLeadPage((page) => page - 1)}>Anterior</Button>
          <Button variant="outline" disabled={leadPage * PAGE_SIZE >= leadTotal}
            onClick={() => setLeadPage((page) => page + 1)}>Siguiente</Button>
        </div>
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
