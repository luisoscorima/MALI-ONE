import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { PageHeader } from '@/components/page-header';
import { EmptyState, Spinner } from '@/components/feedback';
import {
  Button,
  Card,
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
};

type Sede = {
  id: string;
  slug: string;
  nombre: string;
  direccion: string | null;
  brochureUrl: string | null;
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextCursos, nextProgramas, nextSedes, nextDistritos] = await Promise.all([
        api.listEducacionCatalogCursos(),
        api.listEducacionCatalogProgramas(),
        api.listEducacionCatalogSedes(),
        api.listEducacionCatalogDistritos(),
      ]);
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
        description="Cursos, programas, sedes y distritos. El mapa usa estos mismos distritos."
      />
      <Tabs defaultValue="cursos">
        <TabsList>
          <TabsTrigger value="cursos">Cursos</TabsTrigger>
          <TabsTrigger value="programas">Programas</TabsTrigger>
          <TabsTrigger value="sedes">Sedes</TabsTrigger>
          <TabsTrigger value="distritos">Distritos</TabsTrigger>
        </TabsList>
        <TabsContent value="cursos">
          <OfertaPanel
            kind="cursos"
            rows={cursos}
            loading={loading}
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
            onCreate={() => setOfertaEdit({ kind: 'programas', item: null })}
            onEdit={(item) => setOfertaEdit({ kind: 'programas', item })}
            onDelete={(item) => void removeOferta('programas', item)}
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
                    <TableHead className="p-4">Sedes</TableHead>
                    <TableHead className="p-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distritos.map((distrito) => (
                    <TableRow key={distrito.id}>
                      <TableCell className="p-4 font-medium">{distrito.nombre}</TableCell>
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
        onClose={() => setOfertaEdit(null)}
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
  onCreate,
  onEdit,
  onDelete,
}: {
  kind: OfertaKind;
  rows: Oferta[];
  loading: boolean;
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
  onClose,
  onSaved,
}: {
  state: { kind: OfertaKind; item: Oferta | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const item = state?.item;
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [descuento, setDescuento] = useState('');
  const [horario, setHorario] = useState('');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(item?.nombre ?? '');
    setPrecio(item?.precio == null ? '' : String(item.precio));
    setDescuento(item?.descuento ?? '');
    setHorario(item?.horario ?? '');
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

  return (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>El precio, el descuento y el horario describen la oferta. El pago de una persona no se registra aquí.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="grid gap-2 text-sm">
            Nombre
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
          </label>
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
  const [districtId, setDistrictId] = useState('');
  const [showOnSelector, setShowOnSelector] = useState(true);
  const [showOnMap, setShowOnMap] = useState(false);
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(sede?.nombre ?? '');
    setDireccion(sede?.direccion ?? '');
    setBrochureUrl(sede?.brochureUrl ?? '');
    setDistrictId(sede?.districtId ?? '');
    setShowOnSelector(sede?.showOnSelector ?? true);
    setShowOnMap(sede?.showOnMap ?? false);
    setActivo(sede?.activo ?? true);
  }, [sede]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const body = {
      nombre,
      direccion,
      brochureUrl,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sede?.id ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
          <DialogDescription>Esta lista es la que eligen los enlaces de WhatsApp.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={(event) => void save(event)}>
          <label className="grid gap-2 text-sm">
            Nombre
            <Input value={nombre} onChange={(event) => setNombre(event.target.value)} required />
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
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={activo} onCheckedChange={(value) => setActivo(value === true)} />
            Activa en los enlaces de WhatsApp
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNombre(distrito?.nombre ?? '');
  }, [distrito]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (distrito?.id) {
        await api.updateEducacionCatalogDistrito(distrito.id, {
          nombre,
          sortOrder: distrito.sortOrder,
        });
      } else {
        await api.createEducacionCatalogDistrito({ nombre });
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
          <Button type="submit" className="justify-self-end" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
