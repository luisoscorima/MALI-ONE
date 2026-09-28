import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { MaterialIconPicker } from '@/components/material-icon-picker';
import { formatCoordinates, parseCoordinates } from '@/lib/coordinates';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { PageHeader } from '@/components/page-header';
import { EmptyState, Spinner } from '@/components/feedback';
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

type Oferta = {
  id: string;
  nombre: string;
  precio: number | null;
  descuento: string | null;
  horario: string | null;
  activo: boolean;
  sortOrder: number;
  areaId: string | null;
  area: { id: string; nombre: string; parentNombre: string | null } | null;
  cursos?: { id: string; nombre: string }[];
};

type Area = {
  id: string;
  slug: string;
  nombre: string;
  parentId: string | null;
  whatsappArea: string | null;
  activo: boolean;
  sortOrder: number;
  lineas: number;
  cursos: number;
};

const WHATSAPP_AREA_LABEL: Record<string, string> = {
  educacion_ca: 'Educación CA',
  educacion_ep: 'Educación EP',
};

function areaPath(area: Area, areas: Area[]) {
  if (!area.parentId) return area.nombre;
  const parent = areas.find((item) => item.id === area.parentId);
  return parent ? `${parent.nombre} · ${area.nombre}` : area.nombre;
}

type Sede = {
  id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  brochureUrl: string | null;
  icon: string;
  horarioHtml: string | null;
  lat: number | null;
  lng: number | null;
  districtId: string | null;
  distrito: { id: string; nombre: string } | null;
  showOnSelector: boolean;
  showOnMap: boolean;
  activo: boolean;
  sortOrder: number;
};

type Distrito = {
  id: string;
  nombre: string;
  slug: string;
  brochureUrl: string | null;
  sortOrder: number;
  sedes: number;
};

type OfertaKind = 'cursos' | 'programas';

function money(value: number | null) {
  if (value == null) return '—';
  return `S/ ${value.toFixed(2)}`;
}

export function CatalogEducacionPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [areas, setAreas] = useState<Area[]>([]);
  const [cursos, setCursos] = useState<Oferta[]>([]);
  const [programas, setProgramas] = useState<Oferta[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [distritos, setDistritos] = useState<Distrito[]>([]);
  const [loading, setLoading] = useState(true);
  const [ofertaEdit, setOfertaEdit] = useState<{
    kind: OfertaKind;
    item: Oferta | null;
  } | null>(null);
  const [sedeEdit, setSedeEdit] = useState<Sede | null | undefined>(undefined);
  const [distritoEdit, setDistritoEdit] = useState<Distrito | null | undefined>(undefined);
  const [areaEdit, setAreaEdit] = useState<{ item: Area | null; parentId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextAreas, nextCursos, nextProgramas, nextSedes, nextDistritos] = await Promise.all([
        api.listEducacionCatalogAreas(),
        api.listEducacionCatalogCursos(),
        api.listEducacionCatalogProgramas(),
        api.listEducacionCatalogSedes(),
        api.listEducacionCatalogDistritos(),
      ]);
      setAreas(nextAreas);
      setCursos(nextCursos);
      setProgramas(nextProgramas);
      setSedes(nextSedes);
      setDistritos(nextDistritos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeOferta(kind: OfertaKind, item: Oferta) {
    const label = kind === 'cursos' ? 'curso' : 'programa';
    const ok = await confirm({
      title: `¿Eliminar este ${label}?`,
      description: 'Los enlaces que lo usaban quedan sin esa atribución. La URL sigue funcionando.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      if (kind === 'cursos') await api.deleteEducacionCatalogCurso(item.id);
      else await api.deleteEducacionCatalogPrograma(item.id);
      toast.success(`${label[0].toUpperCase()}${label.slice(1)} eliminado`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  }

  async function removeArea(item: Area) {
    const label = item.parentId ? 'línea' : 'área';
    const ok = await confirm({
      title: `¿Eliminar esta ${label}?`,
      description: item.lineas > 0
        ? 'Tiene líneas. Elimínalas antes.'
        : item.cursos > 0
          ? 'Tiene cursos asignados. Cámbialos de área antes de eliminarla.'
          : 'Los cursos dejan de ofrecer esta opción al asignarse.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteEducacionCatalogArea(item.id);
      toast.success(`${label[0].toUpperCase()}${label.slice(1)} eliminada`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  }

  async function removeSede(item: Sede) {
    const ok = await confirm({
      title: '¿Eliminar esta sede?',
      description: 'Los enlaces que la usaban quedan sin sede. La URL sigue funcionando.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteEducacionCatalogSede(item.id);
      toast.success('Sede eliminada');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  }

  async function removeDistrito(item: Distrito) {
    const ok = await confirm({
      title: '¿Eliminar este distrito?',
      description: item.sedes > 0
        ? 'Tiene sedes asignadas. Cámbialas de distrito antes de eliminarlo.'
        : 'El mapa deja de ofrecer este distrito al crear una sede.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteEducacionCatalogDistrito(item.id);
      toast.success('Distrito eliminado');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar');
    }
  }

  return (
    <div>
      <PageHeader
        title="Catálogo Educación"
        description="Áreas, líneas, cursos, programas, sedes y distritos. El mapa y el selector muestran estas sedes."
      />
      <Tabs defaultValue="cursos">
        <TabsList>
          <TabsTrigger value="cursos">Cursos</TabsTrigger>
          <TabsTrigger value="programas">Programas</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="sedes">Sedes</TabsTrigger>
          <TabsTrigger value="distritos">Distritos</TabsTrigger>
        </TabsList>
        <TabsContent value="cursos">
          <OfertaPanel
            kind="cursos"
            rows={cursos}
            loading={loading}
            showArea
            onCreate={() => setOfertaEdit({ kind: 'cursos', item: null })}
            onEdit={(item) => setOfertaEdit({ kind: 'cursos', item })}
            onDelete={(item) => void removeOferta('cursos', item)}
          />
        </TabsContent>
        <TabsContent value="programas">
          <OfertaPanel
            kind="programas"
            rows={programas}
            loading={loading}
            showCursos
            onCreate={() => setOfertaEdit({ kind: 'programas', item: null })}
            onEdit={(item) => setOfertaEdit({ kind: 'programas', item })}
            onDelete={(item) => void removeOferta('programas', item)}
          />
        </TabsContent>
        <TabsContent value="areas">
          <AreasPanel
            areas={areas}
            loading={loading}
            onCreate={() => setAreaEdit({ item: null, parentId: '' })}
            onCreateLinea={(parentId) => setAreaEdit({ item: null, parentId })}
            onEdit={(item) => setAreaEdit({ item, parentId: item.parentId ?? '' })}
            onDelete={(item) => void removeArea(item)}
          />
        </TabsContent>
        <TabsContent value="sedes">
          <Card className="mt-4 overflow-hidden p-0">
            <div className="flex justify-end border-b border-border px-4 py-3">
              <Button type="button" onClick={() => setSedeEdit(null)}>
                <Plus className="size-4" /> Nueva sede
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : sedes.length === 0 ? (
              <EmptyState title="Sin sedes" description="Agrega la primera sede del catálogo." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-4">Nombre</TableHead>
                    <TableHead className="p-4">Distrito</TableHead>
                    <TableHead className="p-4">Dirección</TableHead>
                    <TableHead className="p-4">Estado</TableHead>
                    <TableHead className="p-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sedes.map((sede) => (
                    <TableRow key={sede.id}>
                      <TableCell className="p-4 font-medium">{sede.nombre}</TableCell>
                      <TableCell className="p-4 text-sm">{sede.distrito?.nombre || '—'}</TableCell>
                      <TableCell className="p-4 text-sm text-muted">{sede.direccion || '—'}</TableCell>
                      <TableCell className="p-4 text-sm">{sede.activo ? 'Activa' : 'Inactiva'}</TableCell>
                      <TableCell className="p-4">
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setSedeEdit(sede)}>
                            <Pencil className="size-4" /> Editar
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void removeSede(sede)}>
                            <Trash2 className="size-4" /> Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="distritos">
          <Card className="mt-4 overflow-hidden p-0">
            <div className="flex justify-end border-b border-border px-4 py-3">
              <Button type="button" onClick={() => setDistritoEdit(null)}>
                <Plus className="size-4" /> Nuevo distrito
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : distritos.length === 0 ? (
              <EmptyState title="Sin distritos" description="Agrega el primer distrito." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-4">Nombre</TableHead>
                    <TableHead className="p-4">Brochure</TableHead>
                    <TableHead className="p-4">Sedes</TableHead>
                    <TableHead className="p-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distritos.map((distrito) => (
                    <TableRow key={distrito.id}>
                      <TableCell className="p-4 font-medium">{distrito.nombre}</TableCell>
                      <TableCell className="max-w-xs truncate p-4 text-sm text-muted">{distrito.brochureUrl || '—'}</TableCell>
                      <TableCell className="p-4 text-sm">{distrito.sedes}</TableCell>
                      <TableCell className="p-4">
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setDistritoEdit(distrito)}>
                            <Pencil className="size-4" /> Editar
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => void removeDistrito(distrito)}>
                            <Trash2 className="size-4" /> Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <OfertaDialog
        state={ofertaEdit}
        areas={areas}
        cursos={cursos}
        onClose={() => setOfertaEdit(null)}
        onSaved={() => void load()}
      />
      <AreaDialog
        state={areaEdit}
        areas={areas}
        onClose={() => setAreaEdit(null)}
        onSaved={() => void load()}
      />
      <SedeDialog
        sede={sedeEdit}
        distritos={distritos}
        onClose={() => setSedeEdit(undefined)}
        onSaved={() => void load()}
      />
      <DistritoDialog
        distrito={distritoEdit}
        onClose={() => setDistritoEdit(undefined)}
        onSaved={() => void load()}
      />
    </div>
  );
}

function OfertaPanel({
  kind,
  rows,
  loading,
  showArea = false,
  showCursos = false,
  onCreate,
  onEdit,
  onDelete,
}: {
  kind: OfertaKind;
  rows: Oferta[];
  loading: boolean;
  showArea?: boolean;
  showCursos?: boolean;
  onCreate: () => void;
  onEdit: (item: Oferta) => void;
  onDelete: (item: Oferta) => void;
}) {
  const label = kind === 'cursos' ? 'curso' : 'programa';
  return (
    <Card className="mt-4 overflow-hidden p-0">
      <div className="flex justify-end border-b border-border px-4 py-3">
        <Button type="button" onClick={onCreate}>
          <Plus className="size-4" /> {kind === 'cursos' ? 'Nuevo curso' : 'Nuevo programa'}
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : rows.length === 0 ? (
        <EmptyState title={`Sin ${kind}`} description={`Agrega el primer ${label}.`} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="p-4">Nombre</TableHead>
              {showArea ? <TableHead className="p-4">Área</TableHead> : null}
              {showCursos ? <TableHead className="p-4">Cursos</TableHead> : null}
              <TableHead className="p-4">Precio</TableHead>
              <TableHead className="p-4">Descuento</TableHead>
              <TableHead className="p-4">Horario</TableHead>
              <TableHead className="p-4">Estado</TableHead>
              <TableHead className="p-4">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="p-4 font-medium">{row.nombre}</TableCell>
                {showArea ? (
                  <TableCell className="p-4 text-sm text-muted">
                    {row.area
                      ? row.area.parentNombre
                        ? `${row.area.parentNombre} · ${row.area.nombre}`
                        : row.area.nombre
                      : '—'}
                  </TableCell>
                ) : null}
                {showCursos ? (
                  <TableCell className="max-w-xs p-4 text-sm text-muted">
                    {row.cursos?.length ? row.cursos.map((curso) => curso.nombre).join(', ') : '—'}
                  </TableCell>
                ) : null}
                <TableCell className="p-4">{money(row.precio)}</TableCell>
                <TableCell className="p-4">{row.descuento || '—'}</TableCell>
                <TableCell className="p-4">{row.horario || '—'}</TableCell>
                <TableCell className="p-4">{row.activo ? 'Activo' : 'Inactivo'}</TableCell>
                <TableCell className="p-4">
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => onEdit(row)}>
                      <Pencil className="size-4" /> Editar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onDelete(row)}>
                      <Trash2 className="size-4" /> Eliminar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function OfertaDialog({
  state,
  areas,
  cursos,
  onClose,
  onSaved,
}: {
  state: { kind: OfertaKind; item: Oferta | null } | null;
  areas: Area[];
  cursos: Oferta[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const item = state?.item;
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [descuento, setDescuento] = useState('');
  const [horario, setHorario] = useState('');
  const [areaId, setAreaId] = useState('');
  const [cursoIds, setCursoIds] = useState<string[]>([]);
  const [cursoQuery, setCursoQuery] = useState('');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(item?.nombre ?? '');
    setPrecio(item?.precio == null ? '' : String(item.precio));
    setDescuento(item?.descuento ?? '');
    setHorario(item?.horario ?? '');
    setAreaId(item?.areaId ?? '');
    setCursoIds(item?.cursos?.map((curso) => curso.id) ?? []);
    setCursoQuery('');
    setActivo(item?.activo ?? true);
  }, [item, state?.kind]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!state) return;
    setSaving(true);
    const body = {
      nombre,
      precio: precio.trim() === '' ? null : Number(precio),
      descuento,
      horario,
      activo,
      sortOrder: item?.sortOrder ?? 0,
      ...(state.kind === 'cursos' ? { areaId: areaId || null } : { cursoIds }),
    };
    try {
      if (state.kind === 'cursos') {
        if (item) await api.updateEducacionCatalogCurso(item.id, body);
        else await api.createEducacionCatalogCurso(body);
      } else if (item) {
        await api.updateEducacionCatalogPrograma(item.id, body);
      } else {
        await api.createEducacionCatalogPrograma(body);
      }
      toast.success('Guardado');
      onClose();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const title = state?.kind === 'programas'
    ? item ? 'Editar programa' : 'Nuevo programa'
    : item ? 'Editar curso' : 'Nuevo curso';

  const cursoQueryNorm = cursoQuery.trim().toLocaleLowerCase('es');
  const cursosVisibles = [...cursos]
    .filter((curso) => curso.nombre.toLocaleLowerCase('es').includes(cursoQueryNorm))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={state?.kind === 'programas' ? 'max-h-[85vh] overflow-y-auto' : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {state?.kind === 'programas'
              ? 'El programa puede quedar sin cursos. Si marcas alguno, agrupa esas ofertas.'
              : 'El precio, el descuento y el horario describen la oferta. El pago de una persona no se registra aquí.'}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="grid gap-2 text-sm">
            Nombre
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
          {state?.kind === 'cursos' ? (
            <label className="grid gap-2 text-sm">
              Área o línea
              <Select value={areaId || '__none__'} onValueChange={(value) => setAreaId(value === '__none__' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin área</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>{areaPath(area, areas)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : (
            <div className="grid gap-2 text-sm">
              <span>Cursos (opcional)</span>
              <Input
                value={cursoQuery}
                onChange={(event) => setCursoQuery(event.target.value)}
                placeholder="Buscar curso"
              />
              <p className="text-muted">{cursoIds.length === 1 ? '1 seleccionado' : `${cursoIds.length} seleccionados`}</p>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border border-border p-3">
                {cursosVisibles.length === 0 ? (
                  <p className="text-muted">Ningún curso coincide.</p>
                ) : cursosVisibles.map((curso) => (
                  <label key={curso.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={cursoIds.includes(curso.id)}
                      onCheckedChange={(value) => {
                        setCursoIds((current) => (
                          value === true
                            ? current.includes(curso.id) ? current : [...current, curso.id]
                            : current.filter((id) => id !== curso.id)
                        ));
                      }}
                    />
                    <span>{curso.nombre}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="grid gap-2 text-sm">
            Precio (S/, opcional)
            <Input type="number" min="0" step="0.01" value={precio} onChange={(event) => setPrecio(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Descuento (opcional)
            <Input placeholder="10% o S/ 50" value={descuento} onChange={(event) => setDescuento(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Horario (opcional)
            <Input value={horario} onChange={(event) => setHorario(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={activo} onCheckedChange={(value) => setActivo(value === true)} />
            Activo en los enlaces de WhatsApp
          </label>
          <Button type="submit" className="justify-self-end" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SedeDialog({
  sede,
  distritos,
  onClose,
  onSaved,
}: {
  sede: Sede | null | undefined;
  distritos: Distrito[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const open = sede !== undefined;
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [icon, setIcon] = useState('location_on');
  const [horarioHtml, setHorarioHtml] = useState('');
  const [coords, setCoords] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [showOnSelector, setShowOnSelector] = useState(true);
  const [showOnMap, setShowOnMap] = useState(false);
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(sede?.nombre ?? '');
    setDireccion(sede?.direccion ?? '');
    setBrochureUrl(sede?.brochureUrl ?? '');
    setIcon(sede?.icon || 'location_on');
    setHorarioHtml(sede?.horarioHtml ?? '');
    setCoords(formatCoordinates(sede?.lat, sede?.lng));
    setDistrictId(sede?.districtId ?? '');
    setShowOnSelector(sede?.showOnSelector ?? true);
    setShowOnMap(sede?.showOnMap ?? false);
    setActivo(sede?.activo ?? true);
  }, [sede]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const parsed = parseCoordinates(coords);
    const body = {
      nombre,
      direccion,
      brochureUrl,
      icon,
      horarioHtml,
      lat: parsed.lat,
      lng: parsed.lng,
      districtId: districtId || null,
      showOnSelector,
      showOnMap,
      activo,
      sortOrder: sede?.sortOrder ?? 0,
    };
    try {
      if (sede?.id) await api.updateEducacionCatalogSede(sede.id, body);
      else await api.createEducacionCatalogSede(body);
      toast.success('Sede guardada');
      onClose();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sede?.id ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          <DialogDescription>
            Dirección, brochure, horario y distrito se editan aquí. El ícono también se puede cambiar en el selector de sedes: es el mismo dato.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={activo} onCheckedChange={(value) => setActivo(value === true)} />
            Activa en los enlaces de WhatsApp
          </label>
          <label className="grid gap-2 text-sm">
            Nombre
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm">
            Distrito
            <Select value={districtId || '__none__'} onValueChange={(value) => setDistrictId(value === '__none__' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin distrito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin distrito</SelectItem>
                {distritos.map((distrito) => (
                  <SelectItem key={distrito.id} value={distrito.id}>{distrito.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2 text-sm">
            Dirección (opcional)
            <Input value={direccion} onChange={(event) => setDireccion(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Brochure (opcional)
            <Input value={brochureUrl} onChange={(event) => setBrochureUrl(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Horario (opcional)
            <Textarea rows={3} value={horarioHtml} onChange={(event) => setHorarioHtml(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Coordenadas (lat, lng)
            <Input value={coords} onChange={(event) => setCoords(event.target.value)} placeholder="-12.08, -77.03" />
          </label>
          <label className="grid gap-2 text-sm">
            Ícono
            <MaterialIconPicker value={icon} onChange={setIcon} />
          </label>
          <Button type="submit" className="justify-self-end" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DistritoDialog({
  distrito,
  onClose,
  onSaved,
}: {
  distrito: Distrito | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const open = distrito !== undefined;
  const [nombre, setNombre] = useState('');
  const [brochureUrl, setBrochureUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(distrito?.nombre ?? '');
    setBrochureUrl(distrito?.brochureUrl ?? '');
  }, [distrito]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (distrito?.id) {
        await api.updateEducacionCatalogDistrito(distrito.id, {
          nombre,
          brochureUrl,
          sortOrder: distrito.sortOrder,
        });
      } else {
        await api.createEducacionCatalogDistrito({ nombre, brochureUrl });
      }
      toast.success('Distrito guardado');
      onClose();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{distrito?.id ? 'Editar distrito' : 'Nuevo distrito'}</DialogTitle>
          <DialogDescription>El mapa de sedes usa esta misma lista.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="grid gap-2 text-sm">
            Nombre
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm">
            Brochure (opcional)
            <Input value={brochureUrl} onChange={(event) => setBrochureUrl(event.target.value)} />
          </label>
          <Button type="submit" className="justify-self-end" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AreasPanel({
  areas,
  loading,
  onCreate,
  onCreateLinea,
  onEdit,
  onDelete,
}: {
  areas: Area[];
  loading: boolean;
  onCreate: () => void;
  onCreateLinea: (parentId: string) => void;
  onEdit: (item: Area) => void;
  onDelete: (item: Area) => void;
}) {
  const roots = areas.filter((area) => !area.parentId);
  return (
    <Card className="mt-4 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm text-muted">
          El área separa Cursos de Arte y Extensión Profesional. La línea vive dentro de un área.
        </p>
        <Button type="button" onClick={onCreate}>
          <Plus className="size-4" /> Nueva área
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : roots.length === 0 ? (
        <EmptyState
          title="Sin áreas"
          description="Crea Cursos de Arte y Extensión Profesional. Dentro de esta última van las líneas."
        />
      ) : (
        <div>
          {roots.map((area) => {
            const lineas = areas.filter((item) => item.parentId === area.id);
            return (
              <section key={area.id} className="border-b border-border last:border-b-0">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{area.nombre}</p>
                    <p className="text-sm text-muted">
                      {WHATSAPP_AREA_LABEL[area.whatsappArea ?? ''] ?? 'Sin línea de WhatsApp'}
                      {' · '}
                      {area.cursos} {area.cursos === 1 ? 'curso' : 'cursos'}
                      {area.activo ? '' : ' · Inactiva'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => onCreateLinea(area.id)}>
                      <Plus className="size-4" /> Línea
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onEdit(area)}>
                      <Pencil className="size-4" /> Editar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onDelete(area)}>
                      <Trash2 className="size-4" /> Eliminar
                    </Button>
                  </div>
                </div>
                {lineas.length === 0 ? (
                  <p className="px-4 pb-3 text-sm text-muted">Sin líneas. Los cursos pueden asignarse directo a esta área.</p>
                ) : lineas.map((linea) => (
                  <div key={linea.id} className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 pl-8">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{linea.nombre}</p>
                      <p className="text-sm text-muted">
                        Línea · {linea.cursos} {linea.cursos === 1 ? 'curso' : 'cursos'}
                        {linea.activo ? '' : ' · Inactiva'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onEdit(linea)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onDelete(linea)}>
                        <Trash2 className="size-4" /> Eliminar
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AreaDialog({
  state,
  areas,
  onClose,
  onSaved,
}: {
  state: { item: Area | null; parentId: string } | null;
  areas: Area[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const item = state?.item;
  const roots = areas.filter((area) => !area.parentId && area.id !== item?.id);
  const lockedAsArea = (item?.lineas ?? 0) > 0;
  const [nombre, setNombre] = useState('');
  const [parentId, setParentId] = useState('');
  const [whatsappArea, setWhatsappArea] = useState('educacion_ep');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(item?.nombre ?? '');
    setParentId(lockedAsArea ? '' : (item?.parentId ?? state?.parentId ?? ''));
    setWhatsappArea(item?.whatsappArea || 'educacion_ep');
    setActivo(item?.activo ?? true);
  }, [item, state?.parentId, lockedAsArea]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const isLinea = !lockedAsArea && parentId !== '';
    const body = {
      nombre,
      parentId: isLinea ? parentId : null,
      whatsappArea: isLinea ? null : whatsappArea,
      activo,
      ...(item ? { sortOrder: item.sortOrder } : {}),
    };
    try {
      if (item) await api.updateEducacionCatalogArea(item.id, body);
      else await api.createEducacionCatalogArea(body);
      toast.success('Guardado');
      onClose();
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const isLinea = !lockedAsArea && parentId !== '';
  const title = item
    ? item.parentId ? 'Editar línea' : 'Editar área'
    : parentId ? 'Nueva línea' : 'Nueva área';

  return (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Una línea pertenece a un área. La línea de WhatsApp se define en el área.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="grid gap-2 text-sm">
            Nombre
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
          <label className="grid gap-2 text-sm">
            Pertenece a
            <Select
              value={parentId || '__area__'}
              onValueChange={(value) => setParentId(value === '__area__' ? '' : value)}
              disabled={lockedAsArea}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__area__">Es un área</SelectItem>
                {roots.map((area) => (
                  <SelectItem key={area.id} value={area.id}>{area.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {isLinea ? null : (
            <label className="grid gap-2 text-sm">
              WhatsApp
              <Select value={whatsappArea} onValueChange={setWhatsappArea}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educacion_ca">Educación CA</SelectItem>
                  <SelectItem value="educacion_ep">Educación EP</SelectItem>
                </SelectContent>
              </Select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={activo} onCheckedChange={(value) => setActivo(value === true)} />
            Activa
          </label>
          <Button type="submit" className="justify-self-end" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
