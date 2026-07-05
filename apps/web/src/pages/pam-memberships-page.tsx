import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Mail, Pencil, Save, X } from 'lucide-react';
import type {
  PamPlanDto,
  PamRegistrationDto,
  UpdatePamRegistrationDto,
} from '@mali-one/shared';
import { PageLoading } from '@/components/feedback';
import { IconActionButton } from '@/components/icon-action-button';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import {
  WidgetConfigItemCard,
  WidgetConfigItemList,
  WidgetConfigItemPamPlanThumb,
} from '@/components/widget-config-item-card';
import { WidgetItemCardActions, WidgetSaveButton } from '@/components/widget-item-card-actions';
import { Card, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SettingSwitchInline, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';

type PamPageState = {
  settings: { id: string; benefits: string[]; notes: string[] };
  plans: PamPlanDto[];
  registrations: PamRegistrationDto[];
};

const MEMBERSHIP_PREVIEW = [
  {
    id: 'membership',
    label: 'Membresías',
    src: '/widgets/pam/membership.html',
    height: '900px',
    pamEmbed: true,
  },
];

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

const EMAIL_STATUSES = ['PENDIENTE', 'ENVIADO', 'ERROR_DATOS', 'ERROR_TEMP'];

const CONFIRMED_MP = ['approved', 'authorized'];

function isPending(reg: PamRegistrationDto) {
  return !reg.mpStatus || !CONFIRMED_MP.includes(reg.mpStatus);
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

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  );
}

function RegistrationRow({
  reg,
  expanded,
  editing,
  editForm,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onChange,
  onSave,
  onResendWelcome,
  saving,
}: {
  reg: PamRegistrationDto;
  expanded: boolean;
  editing: boolean;
  editForm: UpdatePamRegistrationDto;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChange: (patch: UpdatePamRegistrationDto) => void;
  onSave: () => void;
  onResendWelcome: () => void;
  saving: boolean;
}) {
  const pending = isPending(reg);

  return (
    <>
      <TableRow
        className="cursor-pointer border-border/60 hover:bg-border/20"
        onClick={onToggle}
      >
        <TableCell className="py-2 pr-2">
          <span className="mr-1 text-muted">{expanded ? '▾' : '▸'}</span>
          {formatDate(reg.createdAt)}
        </TableCell>
        <TableCell className="py-2 pr-2">
          {reg.nombres} {reg.apellidos}
          {pending && (
            <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
              pendiente
            </span>
          )}
        </TableCell>
        <TableCell className="py-2 pr-2">{reg.correo}</TableCell>
        <TableCell className="py-2 pr-2">
          {reg.plan} / {reg.frecuencia}
        </TableCell>
        <TableCell className="py-2">{reg.mpStatus ?? '—'}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="border-border/60 bg-border/10">
          <TableCell colSpan={5} className="p-4">
            {editing ? (
              <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Nombres</span>
                    <Input
                      value={editForm.nombres ?? ''}
                      onChange={(e) => onChange({ nombres: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Apellidos</span>
                    <Input
                      value={editForm.apellidos ?? ''}
                      onChange={(e) => onChange({ apellidos: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">DNI</span>
                    <Input
                      value={editForm.dni ?? ''}
                      onChange={(e) => onChange({ dni: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Celular</span>
                    <Input
                      value={editForm.celular ?? ''}
                      onChange={(e) => onChange({ celular: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Correo</span>
                    <Input
                      type="email"
                      value={editForm.correo ?? ''}
                      onChange={(e) => onChange({ correo: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Género</span>
                    <Input
                      value={editForm.genero ?? ''}
                      onChange={(e) => onChange({ genero: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="text-muted">Dirección</span>
                    <Input
                      value={editForm.direccion ?? ''}
                      onChange={(e) => onChange({ direccion: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Ciudad</span>
                    <Input
                      value={editForm.ciudad ?? ''}
                      onChange={(e) => onChange({ ciudad: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Distrito</span>
                    <Input
                      value={editForm.distrito ?? ''}
                      onChange={(e) => onChange({ distrito: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Fecha nacimiento</span>
                    <Input
                      type="date"
                      value={editForm.fechaNacimiento ?? ''}
                      onChange={(e) => onChange({ fechaNacimiento: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Cómo te enteraste</span>
                    <Input
                      value={editForm.comoTeEnteraste ?? ''}
                      onChange={(e) => onChange({ comoTeEnteraste: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Plan</span>
                    <Input
                      value={editForm.plan ?? ''}
                      onChange={(e) => onChange({ plan: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Frecuencia</span>
                    <Input
                      value={editForm.frecuencia ?? ''}
                      onChange={(e) => onChange({ frecuencia: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-3">
                    <span className="text-muted">Checkout URL (Mercado Pago)</span>
                    <Input
                      value={editForm.checkoutUrl ?? ''}
                      onChange={(e) => onChange({ checkoutUrl: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Estado Mercado Pago</span>
                    <Select
                      value={editForm.mpStatus || '__none__'}
                      onValueChange={(value) =>
                        onChange({ mpStatus: value === '__none__' ? '' : value })
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
                    <span className="text-muted">Mensaje bienvenida</span>
                    <Select
                      value={editForm.welcomeEmail ?? 'PENDIENTE'}
                      onValueChange={(value) => onChange({ welcomeEmail: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Fecha caducidad</span>
                    <Input
                      type="date"
                      value={editForm.expiryDate ?? ''}
                      onChange={(e) => onChange({ expiryDate: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted">Aviso caducidad</span>
                    <Select
                      value={editForm.expiryNotice ?? 'PENDIENTE'}
                      onValueChange={(value) => onChange({ expiryNotice: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <p className="text-xs text-muted">
                  Al marcar MP como <strong>approved</strong> o <strong>authorized</strong>, se
                  calculará la fecha de caducidad y se enviará el correo de bienvenida si aún está
                  pendiente.
                </p>
                <div className="flex items-center gap-1">
                  <IconActionButton
                    label={saving ? 'Guardando…' : 'Guardar cambios'}
                    variant="default"
                    onClick={() => void onSave()}
                    disabled={saving}
                  >
                    <Save className="size-4" />
                  </IconActionButton>
                  <IconActionButton label="Cancelar" onClick={onCancelEdit}>
                    <X className="size-4" />
                  </IconActionButton>
                </div>
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()}>
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailField label="Registrado en" value={formatDateTime(reg.createdAt)} />
                  <DetailField label="DNI" value={reg.dni} />
                  <DetailField label="Celular" value={reg.celular} />
                  <DetailField label="Dirección" value={reg.direccion} />
                  <DetailField label="Ciudad" value={reg.ciudad} />
                  <DetailField label="Distrito" value={reg.distrito} />
                  <DetailField label="Género" value={reg.genero} />
                  <DetailField label="Fecha nacimiento" value={reg.fechaNacimiento} />
                  <DetailField label="Cómo te enteraste" value={reg.comoTeEnteraste} />
                  <DetailField
                    label="Checkout URL"
                    value={
                      reg.checkoutUrl ? (
                        <a
                          href={reg.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-primary hover:underline"
                        >
                          {reg.checkoutUrl}
                        </a>
                      ) : (
                        '—'
                      )
                    }
                  />
                  <DetailField
                    label="Acepta privacidad"
                    value={reg.aceptaPrivacidad ? 'Sí' : 'No'}
                  />
                  <DetailField label="Estado MP" value={reg.mpStatus} />
                  <DetailField label="Mensaje bienvenida" value={reg.welcomeEmail} />
                  <DetailField label="Fecha caducidad" value={formatDate(reg.expiryDate)} />
                  <DetailField label="Aviso caducidad" value={reg.expiryNotice} />
                </dl>
                <div className="mt-4 flex items-center gap-1">
                  <IconActionButton label="Editar registro" onClick={onStartEdit}>
                    <Pencil className="size-4" />
                  </IconActionButton>
                  {reg.mpStatus && CONFIRMED_MP.includes(reg.mpStatus) && (
                    <IconActionButton
                      label="Reenviar bienvenida"
                      onClick={() => void onResendWelcome()}
                    >
                      <Mail className="size-4" />
                    </IconActionButton>
                  )}
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PlanEditor({
  plan,
  title,
  onChange,
  onSave,
}: {
  plan: PamPlanDto;
  title?: string;
  onChange: (patch: Partial<PamPlanDto>) => void;
  onSave: () => void;
}) {
  return (
    <WidgetConfigItemCard
      badge={title}
      inactive={!plan.activo}
      aside={
        <WidgetConfigItemPamPlanThumb
          name={plan.name}
          color={plan.color}
          monthlyPrice={plan.monthlyPrice}
        />
      }
      actions={<WidgetItemCardActions onSave={onSave} />}
    >
      <Input
        placeholder="Nombre del plan"
        value={plan.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <Input
        placeholder="Precio mensual"
        value={plan.monthlyPrice}
        onChange={(e) => onChange({ monthlyPrice: e.target.value })}
      />
      <Input
        placeholder="Precio anual"
        value={plan.yearlyPrice}
        onChange={(e) => onChange({ yearlyPrice: e.target.value })}
      />
      <Input
        placeholder="Checkout mensual MP"
        value={plan.monthlyCheckout}
        onChange={(e) => onChange({ monthlyCheckout: e.target.value })}
      />
      <Input
        placeholder="Checkout anual MP"
        value={plan.yearlyCheckout}
        onChange={(e) => onChange({ yearlyCheckout: e.target.value })}
      />
      <SettingSwitchInline
        label="Plan activo"
        checked={plan.activo}
        onCheckedChange={(activo) => onChange({ activo })}
        activeLabel="Activo"
        inactiveLabel="Inactivo"
      />
    </WidgetConfigItemCard>
  );
}

export function PamMembershipsPage() {
  const toast = useToast();
  const [state, setState] = useState<PamPageState | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdatePamRegistrationDto>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, plans, registrations] = await Promise.all([
        api.getPamSettings(),
        api.getPamPlans(),
        api.listPamRegistrations(),
      ]);
      setState({ settings, plans, registrations });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings() {
    if (!state) return;
    try {
      await api.updatePamSettings({
        benefits: state.settings.benefits,
        notes: state.settings.notes,
      });
      toast.success('Beneficios guardados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function savePlan(plan: PamPlanDto) {
    try {
      await api.updatePamPlan(plan.id, {
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        monthlyCheckout: plan.monthlyCheckout,
        yearlyCheckout: plan.yearlyCheckout,
        activo: plan.activo,
      });
      toast.success(`Plan ${plan.name} guardado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar plan');
    }
  }

  function startEdit(reg: PamRegistrationDto) {
    setEditingId(reg.id);
    setEditForm({
      nombres: reg.nombres,
      apellidos: reg.apellidos,
      dni: reg.dni,
      celular: reg.celular,
      correo: reg.correo,
      direccion: reg.direccion ?? '',
      ciudad: reg.ciudad ?? '',
      distrito: reg.distrito ?? '',
      genero: reg.genero ?? '',
      fechaNacimiento: reg.fechaNacimiento ?? '',
      comoTeEnteraste: reg.comoTeEnteraste ?? '',
      plan: reg.plan,
      frecuencia: reg.frecuencia,
      checkoutUrl: reg.checkoutUrl ?? '',
      mpStatus: reg.mpStatus ?? '',
      welcomeEmail: reg.welcomeEmail,
      expiryNotice: reg.expiryNotice,
      expiryDate: toDateInput(reg.expiryDate),
    });
  }

  function updateRegistrationInState(updated: PamRegistrationDto) {
    setState((prev) =>
      prev
        ? {
            ...prev,
            registrations: prev.registrations.map((r) =>
              r.id === updated.id ? updated : r,
            ),
          }
        : prev,
    );
  }

  async function saveRegistration(id: string) {
    setSavingId(id);
    try {
      const updated = await api.updatePamRegistration(id, editForm);
      updateRegistrationInState(updated);
      setEditingId(null);
      toast.success('Registro actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar registro');
    } finally {
      setSavingId(null);
    }
  }

  async function resendWelcome(id: string) {
    try {
      const updated = await api.resendPamWelcome(id);
      updateRegistrationInState(updated);
      toast.success('Correo de bienvenida reenviado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al reenviar correo');
    }
  }

  if (loading || !state) return <PageLoading variant="table" />;

  const config = (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Beneficios y notas</h2>
        <Textarea
          rows={6}
          value={state.settings.benefits.join('\n')}
          onChange={(e) =>
            setState({
              ...state,
              settings: {
                ...state.settings,
                benefits: e.target.value.split('\n').filter(Boolean),
              },
            })
          }
        />
        <Textarea
          rows={4}
          value={state.settings.notes.join('\n')}
          onChange={(e) =>
            setState({
              ...state,
              settings: {
                ...state.settings,
                notes: e.target.value.split('\n').filter(Boolean),
              },
            })
          }
        />
        <WidgetSaveButton onClick={() => void saveSettings()}>
          Guardar textos PAM
        </WidgetSaveButton>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Planes ({state.plans.length})</h2>
          <p className="text-sm text-muted">
            Precios y enlaces de checkout Mercado Pago.
          </p>
        </div>

        <WidgetConfigItemList>
          {state.plans.map((plan, index) => (
            <PlanEditor
              key={plan.id}
              plan={plan}
              title={`Ítem ${index + 1}`}
              onChange={(patch) =>
                setState({
                  ...state,
                  plans: state.plans.map((p) =>
                    p.id === plan.id ? { ...p, ...patch } : p,
                  ),
                })
              }
              onSave={() => {
                const current = state.plans.find((p) => p.id === plan.id);
                if (current) void savePlan(current);
              }}
            />
          ))}
        </WidgetConfigItemList>
      </Card>

      <Card className="overflow-x-auto p-4">
        <h2 className="mb-1 font-semibold">
          Registros recientes ({state.registrations.length})
        </h2>
        <p className="mb-3 text-xs text-muted">
          Haz clic en una fila para ver el detalle. Los registros sin pago confirmado aparecen
          como pendientes; puedes marcar MP como approved para activar bienvenida y caducidad.
        </p>
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="border-border text-muted">
              <TableHead className="py-2 pr-2">Fecha</TableHead>
              <TableHead className="py-2 pr-2">Nombre</TableHead>
              <TableHead className="py-2 pr-2">Correo</TableHead>
              <TableHead className="py-2 pr-2">Plan</TableHead>
              <TableHead className="py-2">MP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.registrations.map((r) => (
              <RegistrationRow
                key={r.id}
                reg={r}
                expanded={expandedId === r.id}
                editing={editingId === r.id}
                editForm={editForm}
                saving={savingId === r.id}
                onToggle={() => {
                  setExpandedId((prev) => (prev === r.id ? null : r.id));
                  if (editingId && editingId !== r.id) setEditingId(null);
                }}
                onStartEdit={() => startEdit(r)}
                onCancelEdit={() => setEditingId(null)}
                onChange={(patch) =>
                  setEditForm((prev: UpdatePamRegistrationDto) => ({ ...prev, ...patch }))
                }
                onSave={() => void saveRegistration(r.id)}
                onResendWelcome={() => void resendWelcome(r.id)}
              />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      title="Membresías PAM"
      description="Planes, beneficios, registros y pagos del Programa Amigos del MALI"
      config={config}
      preview={<WidgetPreviewFrame tabs={MEMBERSHIP_PREVIEW} />}
    />
  );
}
