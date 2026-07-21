import { useCallback, useEffect, useState } from 'react';
import type { PamPlanDto } from '@mali-one/shared';
import { PageLoading } from '@/components/feedback';
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
  SettingSwitchInline,
  Textarea,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { Link } from 'react-router-dom';

type PamPageState = {
  settings: { id: string; benefits: string[]; notes: string[] };
  plans: PamPlanDto[];
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, plans] = await Promise.all([
        api.getPamSettings(),
        api.getPamPlans(),
      ]);
      setState({ settings, plans });
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

  if (loading || !state) return <PageLoading variant="table" />;

  const config = (
    <div className="space-y-6">
      <Card className="space-y-2 border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        <p>
          Solo vitrina del widget (planes, beneficios, checkout). Personas y
          pagos:{' '}
          <Link className="text-foreground underline" to="/admin/crm-pam">
            CRM PAM
          </Link>
          .
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
    </div>
  );

  return (
    <WidgetToolLayout
      title="Membresías PAM"
      description="Vitrina del widget: planes, beneficios y checkout MP."
      config={config}
      preview={<WidgetPreviewFrame tabs={MEMBERSHIP_PREVIEW} />}
    />
  );
}
