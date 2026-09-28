import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { EducacionSedeDto } from '@mali-one/shared';
import { PageLoading } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import {
  WidgetConfigItemCard,
  WidgetConfigItemList,
  WidgetConfigItemMapThumb,
} from '@/components/widget-config-item-card';
import { Card, Input, SettingSwitchInline } from '@/components/ui';
import { WidgetItemCardActions, WidgetSaveButton } from '@/components/widget-item-card-actions';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { formatCoordinates, parseCoordinates } from '@/lib/coordinates';
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

type SedeDraft = EducacionSedeDto & { coords: string };

function withCoords(sede: EducacionSedeDto): SedeDraft {
  return { ...sede, coords: formatCoordinates(sede.lat, sede.lng) };
}

export function WidgetEducacionMapaPage() {
  const toast = useToast();
  const { state, setState, loading, saving, saveSettings, reload } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;
  const [previewKey, setPreviewKey] = useState(0);

  async function persistSede(sede: SedeDraft) {
    const { lat, lng } = parseCoordinates(sede.coords);
    try {
      await api.updateEducacionSede(sede.id, {
        showOnMap: sede.showOnMap,
        nombreMapa: sede.nombreMapa,
        lat,
        lng,
      });
      toast.success(`Sede ${sede.nombre} guardada`);
      await reload();
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar sede');
    }
  }

  if (loading || !state) {
    return <PageLoading variant="form" />;
  }

  const contactFields = [
    ['whatsapp', 'WhatsApp'],
    ['telefono', 'Teléfono'],
    ['email', 'Email'],
    ['emailVirtual', 'Email virtual'],
    ['soporteVirtual', 'Soporte virtual'],
    ['mapsApiKey', 'Google Maps API key (no borrar)'],
  ] as const;

  const config = (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <h2 className="font-semibold">Datos de contacto</h2>
        <p className="text-sm text-muted">
          Información general del mapa. Las imágenes de iconos están fijas en el widget.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {contactFields.map(([key, label]) => (
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
        <WidgetSaveButton onClick={() => void saveSettings()} disabled={saving}>
          Guardar contactos
        </WidgetSaveButton>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="font-semibold">Sedes del mapa ({state.sedes.filter((sede) => sede.showOnMap).length})</h2>
          <p className="text-sm text-muted">
            El nombre oficial, la dirección, el horario, el brochure y el distrito se editan en{' '}
            <Link className="underline" to="/admin/catalogo-educacion">Catálogo Educación</Link>.
            Aquí eliges si la sede se muestra, su nombre visible y las coordenadas.
          </p>
        </div>
        <WidgetConfigItemList>
          {state.sedes.map((sede) => {
            const draft = withCoords(sede);
            return (
              <SedeEditor
                key={sede.id}
                sede={draft}
                onChange={(next) => {
                  const { lat, lng } = parseCoordinates(next.coords);
                  setState({
                    ...state,
                    sedes: state.sedes.map((item) =>
                      item.id === sede.id ? { ...item, ...next, lat, lng } : item,
                    ),
                  });
                }}
                onSave={() => {
                  const current = state.sedes.find((item) => item.id === sede.id);
                  if (current) void persistSede(withCoords(current));
                }}
              />
            );
          })}
        </WidgetConfigItemList>
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Mapa de sedes"
      description="Qué sedes del catálogo aparecen en educacion.mali.pe"
      config={config}
      preview={<WidgetPreviewFrame key={previewKey} tabs={MAPA_PREVIEW} />}
    />
  );
}

function SedeEditor({
  sede,
  onChange,
  onSave,
}: {
  sede: SedeDraft;
  onChange: (sede: SedeDraft) => void;
  onSave: () => void;
}) {
  const { lat, lng } = parseCoordinates(sede.coords);
  const visible = sede.nombreMapa?.trim() || sede.nombre;

  return (
    <WidgetConfigItemCard
      badge={sede.district?.name || 'Sin distrito'}
      inactive={!sede.showOnMap}
      aside={
        <WidgetConfigItemMapThumb
          lat={lat}
          lng={lng}
          label={visible}
          placeholderIcon={MapPin}
        />
      }
      actions={<WidgetItemCardActions onSave={onSave} />}
    >
      <p className="text-sm font-medium">{sede.nombre}</p>
      <p className="text-sm text-muted">{sede.direccion || 'Sin dirección en el catálogo'}</p>
      <Input
        placeholder={`Nombre visible (si se deja vacío: ${sede.nombre})`}
        value={sede.nombreMapa ?? ''}
        onChange={(e) => onChange({ ...sede, nombreMapa: e.target.value })}
      />
      <Input
        placeholder="Coordenadas (lat, lng)"
        value={sede.coords}
        onChange={(e) => onChange({ ...sede, coords: e.target.value })}
      />
      {!sede.districtId && (
        <p className="text-sm text-muted">Sin distrito no aparece en el listado del mapa.</p>
      )}
      <SettingSwitchInline
        label="Mostrar en el mapa"
        checked={sede.showOnMap}
        onCheckedChange={(checked) => onChange({ ...sede, showOnMap: checked })}
      />
    </WidgetConfigItemCard>
  );
}
