import { useCallback, useEffect, useState } from 'react';
import type { EducacionAdminStateDto, EducacionSedeDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { EDUCACION_PREVIEW_TABS } from '@/lib/widget-tools';

export function WidgetEducacionPage() {
  const toast = useToast();
  const [state, setState] = useState<EducacionAdminStateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setState(await api.getEducacionWidgetAdmin());
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
    setSaving(true);
    try {
      await api.updateEducacionWidgetSettings(state.settings);
      toast.success('Contactos actualizados');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

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

  const config = (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Contactos e imágenes</h2>
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
              ['imageCorreo', 'Imagen correo'],
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
        <h2 className="font-semibold">Sedes ({state.sedes.length})</h2>
        <p className="text-sm text-muted">
          Edita brochures, coordenadas y horarios usados por mapa.html y selector-sedes.html.
        </p>
        <div className="space-y-4">
          {state.sedes.map((sede) => (
            <div key={sede.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span>{sede.slug}</span>
                {sede.district?.name && <span>· {sede.district.name}</span>}
              </div>
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
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
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
                  Mapa
                </label>
                <label className="flex items-center gap-2">
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
                  Selector
                </label>
              </div>
              <Button className="text-sm px-3 py-1.5" onClick={() => void saveSede(sede)}>
                Guardar sede
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      title="Widgets Educación"
      description="Configura mapa y selector para educacion.mali.pe"
      config={config}
      preview={<WidgetPreviewFrame tabs={EDUCACION_PREVIEW_TABS} />}
    />
  );
}
