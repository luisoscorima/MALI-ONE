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

const MAPA_PREVIEW = [
  {
    id: 'mapa',
    label: 'Mapa',
    src: '/widgets/educacion/mapa.html',
    height: '680px',
  },
];

export function WidgetEducacionMapaPage() {
  const toast = useToast();
  const { state, setState, loading, saving, saveSettings } = useEducacionAdmin();
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

  const mapSedes = state.sedes.filter((s) => s.showOnMap);

  const config = (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Contactos e imágenes del mapa</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              ['whatsapp', 'WhatsApp'],
              ['telefono', 'Teléfono'],
              ['email', 'Email'],
              ['emailVirtual', 'Email virtual'],
              ['soporteVirtual', 'Soporte virtual'],
              ['imageRectangulo', 'Imagen rectángulo'],
              ['imageWhatsapp', 'Imagen WhatsApp'],
              ['imageCirculo', 'Imagen círculo (marcador lista)'],
              ['imageCorreo', 'Imagen correo'],
              ['imageMarker', 'Imagen marcador mapa'],
              ['mapsApiKey', 'Google Maps API key'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key} className="mb-1 block text-sm text-muted">
                {label}
              </label>
              <Input
                id={key}
                value={String(state.settings[key as keyof typeof state.settings] ?? '')}
                onChange={(e) =>
                  setState({
                    ...state,
                    settings: { ...state.settings, [key]: e.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
        <Button onClick={() => void saveSettings()} disabled={saving}>
          Guardar contactos
        </Button>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Sedes en el mapa ({mapSedes.length})</h2>
        <p className="text-sm text-muted">
          Coordenadas y horarios para ubicaciones en Google Maps. Las sedes son
          registros compartidos con el selector; el nombre y brochure también
          aplican allí si la sede está activa en ambos widgets.
        </p>
        <div className="space-y-4">
          {state.sedes.map((sede) => (
            <div key={sede.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <span>{sede.slug}</span>
                  {sede.district?.name && <span>· {sede.district.name}</span>}
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sede.showOnMap}
                    onChange={(e) =>
                      setState({
                        ...state,
                        sedes: state.sedes.map((s) =>
                          s.id === sede.id ? { ...s, showOnMap: e.target.checked } : s,
                        ),
                      })
                    }
                  />
                  Visible en mapa
                </label>
              </div>
              {!sede.showOnMap ? (
                <p className="text-xs text-muted">Oculta en el mapa</p>
              ) : (
                <>
                  <Input
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
                    placeholder="Dirección"
                    value={sede.direccion ?? ''}
                    onChange={(e) =>
                      setState({
                        ...state,
                        sedes: state.sedes.map((s) =>
                          s.id === sede.id ? { ...s, direccion: e.target.value } : s,
                        ),
                      })
                    }
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      type="number"
                      step="any"
                      placeholder="Lat"
                      value={sede.lat ?? ''}
                      onChange={(e) =>
                        setState({
                          ...state,
                          sedes: state.sedes.map((s) =>
                            s.id === sede.id
                              ? { ...s, lat: e.target.value ? Number(e.target.value) : null }
                              : s,
                          ),
                        })
                      }
                    />
                    <Input
                      type="number"
                      step="any"
                      placeholder="Lng"
                      value={sede.lng ?? ''}
                      onChange={(e) =>
                        setState({
                          ...state,
                          sedes: state.sedes.map((s) =>
                            s.id === sede.id
                              ? { ...s, lng: e.target.value ? Number(e.target.value) : null }
                              : s,
                          ),
                        })
                      }
                    />
                  </div>
                  <textarea
                    className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                    rows={3}
                    placeholder="Horario HTML"
                    value={sede.horarioHtml ?? ''}
                    onChange={(e) =>
                      setState({
                        ...state,
                        sedes: state.sedes.map((s) =>
                          s.id === sede.id ? { ...s, horarioHtml: e.target.value } : s,
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
    </div>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Mapa de sedes"
      description="Widget para educacion.mali.pe — contactos, imágenes y ubicaciones"
      config={config}
      preview={<WidgetPreviewFrame tabs={MAPA_PREVIEW} />}
    />
  );
}
