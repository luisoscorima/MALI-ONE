import type { EducacionSedeDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';

const SELECTOR_PREVIEW = [
  {
    id: 'selector',
    label: 'Selector sedes',
    src: '/widgets/educacion/selector-sedes.html',
    height: '200px',
  },
];

export function WidgetEducacionSelectorPage() {
  const toast = useToast();
  const { state, setState, loading } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;

  async function saveSede(sede: EducacionSedeDto) {
    try {
      await api.updateEducacionSede(sede.id, {
        nombre: sede.nombre,
        direccion: sede.direccion,
        lat: sede.lat,
        lng: sede.lng,
        horarioHtml: sede.horarioHtml,
        brochureUrl: sede.brochureUrl,
        showOnMap: sede.showOnMap,
        showOnSelector: sede.showOnSelector,
        activo: sede.activo,
      });
      toast.success(`Sede ${sede.nombre} guardada`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar sede');
    }
  }

  if (loading || !state) {
    return <Spinner className="mx-auto mt-12" />;
  }

  const selectorSedes = state.sedes.filter((s) => s.showOnSelector);

  const config = (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">Sedes en el selector ({selectorSedes.length})</h2>
      <p className="text-sm text-muted">
        Botón flotante con enlaces a brochures. Comparte registros de sede con el
        mapa: nombre y brochure son los mismos datos.
      </p>
      <div className="space-y-4">
        {state.sedes.map((sede) => (
          <div key={sede.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted">{sede.slug}</span>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sede.showOnSelector}
                  onChange={(e) =>
                    setState({
                      ...state,
                      sedes: state.sedes.map((s) =>
                        s.id === sede.id
                          ? { ...s, showOnSelector: e.target.checked }
                          : s,
                      ),
                    })
                  }
                />
                Visible en selector
              </label>
            </div>
            {!sede.showOnSelector ? (
              <p className="text-xs text-muted">Oculta en el selector</p>
            ) : (
              <>
                <Input
                  placeholder="Nombre visible"
                  value={sede.nombre}
                  onChange={(e) =>
                    setState({
                      ...state,
                      sedes: state.sedes.map((s) =>
                        s.id === sede.id ? { ...s, nombre: e.target.value } : s,
                      ),
                    })
                  }
                />
                <Input
                  placeholder="Brochure URL"
                  value={sede.brochureUrl}
                  onChange={(e) =>
                    setState({
                      ...state,
                      sedes: state.sedes.map((s) =>
                        s.id === sede.id ? { ...s, brochureUrl: e.target.value } : s,
                      ),
                    })
                  }
                />
                <Button className="text-sm px-3 py-1.5" onClick={() => void saveSede(sede)}>
                  Guardar sede
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Selector de sedes"
      description="Widget para educacion.mali.pe — brochures por sede"
      config={config}
      preview={<WidgetPreviewFrame tabs={SELECTOR_PREVIEW} />}
    />
  );
}
