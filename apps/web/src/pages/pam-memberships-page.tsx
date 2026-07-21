import { useCallback, useEffect, useState, Fragment } from 'react';
import { Mail, Save } from 'lucide-react';
import type { PamPlanDto, PamRegistrationDto } from '@mali-one/shared';
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
import {
  Card,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SettingSwitchInline,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { Link } from 'react-router-dom';

type PamPageState = {
  settings: { id: string; benefits: string[]; notes: string[] };
  plans: PamPlanDto[];
  payments: PamRegistrationDto[];
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

function PlanEditor({
  plan,
  title,
  onChange,
  onSave,
}: {
  plan: PamPlanDto;
  title: string;
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
        placeholder="Checkout mensual MP"
        value={plan.monthlyCheckout}
        onChange={(e) => onChange({ monthlyCheckout: e.target.value })}
      />
      <Input
        placeholder="Precio anual"
        value={plan.yearlyPrice}
        onChange={(e) => onChange({ yearlyPrice: e.target.value })}
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
  const [draftMp, setDraftMp] = useState<Record<string, string>>({});
  const [draftExpiry, setDraftExpiry] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, plans, payments] = await Promise.all([
        api.getPamSettings(),
        api.getPamPlans(),
        api.listPamRegistrations(),
      ]);
      setState({ settings, plans, payments });
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

  function updatePaymentInState(updated: PamRegistrationDto) {
    setState((prev) =>
      prev
        ? {
            ...prev,
            payments: prev.payments.map((p) =>
              p.id === updated.id ? updated : p,
            ),
          }
        : prev,
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
      toast.success('Pago actualizado (sync CRM)');
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

  if (loading || !state) return <PageLoading variant="table" />;

  const config = (
    <div className="space-y-6">
      <Card className="space-y-2 border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        <p>
          Personas y demografía:{' '}
          <Link className="text-foreground underline" to="/admin/crm-pam">
            CRM PAM
          </Link>
          . Aquí: vitrina + <strong className="text-foreground">pagos</strong>{' '}
          (MP, caducidad, welcome SMTP).
        </p>
      </Card>

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
          Pagos recientes ({state.payments.length})
        </h2>
        <p className="mb-3 text-xs text-muted">
          Ledger de membresía (no CRM). Marca MP como approved/authorized para
          calcular caducidad y disparar bienvenida por SMTP. La persona ya está
          en WhatsApp desde el alta del widget.
        </p>
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="border-border text-muted">
              <TableHead className="py-2 pr-2">Registrado</TableHead>
              <TableHead className="py-2 pr-2">Persona</TableHead>
              <TableHead className="py-2 pr-2">Plan</TableHead>
              <TableHead className="py-2 pr-2">MP</TableHead>
              <TableHead className="py-2 pr-2">Caducidad</TableHead>
              <TableHead className="py-2">Welcome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.payments.map((p) => {
              const pending =
                !p.mpStatus || !CONFIRMED_MP.includes(p.mpStatus);
              const expanded = expandedId === p.id;
              const mpValue =
                draftMp[p.id] !== undefined ? draftMp[p.id] : (p.mpStatus ?? '');
              const expiryValue =
                draftExpiry[p.id] !== undefined
                  ? draftExpiry[p.id]
                  : toDateInput(p.expiryDate);

              return (
                <Fragment key={p.id}>
                  <TableRow
                    className="cursor-pointer border-border/60 hover:bg-border/20"
                    onClick={() => {
                      setExpandedId((prev) => (prev === p.id ? null : p.id));
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
                    <TableCell className="py-2 pr-2">
                      <span className="mr-1 text-muted">
                        {expanded ? '▾' : '▸'}
                      </span>
                      {formatDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell className="py-2 pr-2">
                      <div>
                        {p.nombres} {p.apellidos}
                        {pending && (
                          <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
                            pendiente
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">{p.correo}</div>
                    </TableCell>
                    <TableCell className="py-2 pr-2">
                      {p.plan} / {p.frecuencia}
                    </TableCell>
                    <TableCell className="py-2 pr-2">
                      {p.mpStatus ?? '—'}
                    </TableCell>
                    <TableCell className="py-2 pr-2">
                      {formatDate(p.expiryDate)}
                    </TableCell>
                    <TableCell className="py-2">{p.welcomeEmail}</TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="border-border/60 bg-border/10">
                      <TableCell colSpan={6} className="p-4">
                        <div
                          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-sm sm:col-span-2 lg:col-span-3">
                            <span className="text-xs text-muted">
                              Checkout URL
                            </span>
                            <p className="break-all font-mono text-xs">
                              {p.checkoutUrl || '—'}
                            </p>
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted">
                              Acepta privacidad
                            </span>
                            <p>{p.aceptaPrivacidad ? 'Sí' : 'No'}</p>
                          </div>
                          <div className="text-sm">
                            <span className="text-xs text-muted">
                              Aviso caducidad
                            </span>
                            <p>{p.expiryNotice}</p>
                          </div>
                          <label className="space-y-1 text-sm">
                            <span className="text-muted">Estado Mercado Pago</span>
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
                            <span className="text-muted">Fecha caducidad</span>
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
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      title="Membresías PAM"
      description="Vitrina, planes y ledger de pagos. Personas: CRM PAM."
      config={config}
      preview={<WidgetPreviewFrame tabs={MEMBERSHIP_PREVIEW} />}
    />
  );
}
