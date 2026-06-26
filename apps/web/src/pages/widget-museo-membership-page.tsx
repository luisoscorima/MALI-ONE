import { useCallback, useEffect, useState } from 'react';
import type { PamAdminStateDto, PamPlanDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';

const MEMBERSHIP_PREVIEW = [
  {
    id: 'membership',
    label: 'Membresías',
    src: '/widgets/pam/membership.html',
    height: '900px',
    pamEmbed: true,
  },
];

export function WidgetMuseoMembershipPage() {
  const toast = useToast();
  const [state, setState] = useState<PamAdminStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const area = WIDGET_AREAS.museo;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await api.getPamWidgetAdmin());
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
      await api.updatePamWidgetSettings({
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

  if (loading || !state) return <Spinner className="mx-auto mt-12" />;

  const config = (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Beneficios y notas</h2>
        <textarea
          className="w-full rounded-lg border border-border bg-background p-2 text-sm"
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
        <textarea
          className="w-full rounded-lg border border-border bg-background p-2 text-sm"
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
        <Button onClick={() => void saveSettings()}>Guardar textos PAM</Button>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Planes</h2>
        {state.plans.map((plan) => (
          <div key={plan.id} className="rounded-lg border border-border p-3 space-y-2">
            <Input
              value={plan.name}
              onChange={(e) =>
                setState({
                  ...state,
                  plans: state.plans.map((p) =>
                    p.id === plan.id ? { ...p, name: e.target.value } : p,
                  ),
                })
              }
            />
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                placeholder="Precio mensual"
                value={plan.monthlyPrice}
                onChange={(e) =>
                  setState({
                    ...state,
                    plans: state.plans.map((p) =>
                      p.id === plan.id ? { ...p, monthlyPrice: e.target.value } : p,
                    ),
                  })
                }
              />
              <Input
                placeholder="Precio anual"
                value={plan.yearlyPrice}
                onChange={(e) =>
                  setState({
                    ...state,
                    plans: state.plans.map((p) =>
                      p.id === plan.id ? { ...p, yearlyPrice: e.target.value } : p,
                    ),
                  })
                }
              />
            </div>
            <Input
              placeholder="Checkout mensual MP"
              value={plan.monthlyCheckout}
              onChange={(e) =>
                setState({
                  ...state,
                  plans: state.plans.map((p) =>
                    p.id === plan.id ? { ...p, monthlyCheckout: e.target.value } : p,
                  ),
                })
              }
            />
            <Input
              placeholder="Checkout anual MP"
              value={plan.yearlyCheckout}
              onChange={(e) =>
                setState({
                  ...state,
                  plans: state.plans.map((p) =>
                    p.id === plan.id ? { ...p, yearlyCheckout: e.target.value } : p,
                  ),
                })
              }
            />
            <Button className="text-sm px-3 py-1.5" onClick={() => void savePlan(plan)}>
              Guardar plan
            </Button>
          </div>
        ))}
      </Card>

      <Card className="overflow-x-auto p-4">
        <h2 className="mb-3 font-semibold">
          Registros recientes ({state.registrations.length})
        </h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-2">Fecha</th>
              <th className="py-2 pr-2">Nombre</th>
              <th className="py-2 pr-2">Correo</th>
              <th className="py-2 pr-2">Plan</th>
              <th className="py-2">MP</th>
            </tr>
          </thead>
          <tbody>
            {state.registrations.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-2 pr-2">
                  {new Date(r.createdAt).toLocaleDateString('es-PE')}
                </td>
                <td className="py-2 pr-2">
                  {r.nombres} {r.apellidos}
                </td>
                <td className="py-2 pr-2">{r.correo}</td>
                <td className="py-2 pr-2">
                  {r.plan} / {r.frecuencia}
                </td>
                <td className="py-2">{r.mpStatus ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Membresías PAM"
      description="Widget para mali.pe/es — planes, beneficios y registros"
      config={config}
      preview={<WidgetPreviewFrame tabs={MEMBERSHIP_PREVIEW} />}
    />
  );
}
