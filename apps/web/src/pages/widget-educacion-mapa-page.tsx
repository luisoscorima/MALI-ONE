import { useState } from 'react';
import { MapPin } from 'lucide-react';
import type { EducacionDistrictDto, EducacionSedeDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import {
  WidgetConfigItemCard,
  WidgetConfigItemList,
  WidgetConfigItemMapThumb,
} from '@/components/widget-config-item-card';
import { Button, Card, Input, SettingSwitchInline } from '@/components/ui';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { formatCoordinates, parseCoordinates, slugify } from '@/lib/coordinates';
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

function emptySede(districts: EducacionDistrictDto[]): SedeDraft {
  return {
    id: '',
    slug: '',
    nombre: '',
    direccion: '',
    lat: null,
    lng: null,
    coords: '',
    horarioHtml: '',
    brochureUrl: '',
    districtId: districts[0]?.id ?? null,
    showOnMap: true,
    sortOrder: 0,
    activo: true,
  };
}

export function WidgetEducacionMapaPage() {
  const toast = useToast();
  const { state, setState, loading, saving, saveSettings, reload } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;
  const [draft, setDraft] = useState<SedeDraft | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  async function persistSede(sede: SedeDraft) {
    const { lat, lng } = parseCoordinates(sede.coords);
    const payload = {
      slug: sede.slug.trim(),
      nombre: sede.nombre.trim(),
      direccion: sede.direccion?.trim() || null,
      lat,
      lng,
      horarioHtml: sede.horarioHtml?.trim() || null,
      brochureUrl: sede.brochureUrl.trim(),
      districtId: sede.districtId,
      showOnMap: true,
      activo: sede.activo,
      sortOrder: sede.sortOrder,
    };

    if (!payload.slug || !payload.nombre || !payload.brochureUrl) {
      toast.error('Slug, nombre y brochure son obligatorios');
      return;
    }

    try {
      if (sede.id) {
        await api.updateEducacionSede(sede.id, payload);
        toast.success(`Sede ${payload.nombre} guardada`);
      } else {
        await api.createEducacionSede(payload);
        toast.success(`Sede ${payload.nombre} creada`);
        setDraft(null);
      }
      await reload();
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar sede');
    }
  }

  async function removeSede(sede: EducacionSedeDto) {
    if (!confirm(`¿Eliminar la sede "${sede.nombre}"?`)) return;
    try {
      await api.deleteEducacionSede(sede.id);
      toast.success('Sede eliminada');
      await reload();
      setPreviewKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function duplicateSede(sede: EducacionSedeDto) {
    const base = slugify(`${sede.slug}-copia`);
    setDraft(
      withCoords({
        ...sede,
        id: '',
        slug: base,
        nombre: `${sede.nombre} (copia)`,
      }),
    );
  }

  if (loading || !state) {
    return <Spinner className="mx-auto mt-12" />;
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
        <Button onClick={() => void saveSettings()} disabled={saving}>
          Guardar contactos
        </Button>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Sedes del mapa ({state.sedes.length})</h2>
            <p className="text-sm text-muted">
              Ubicaciones con coordenadas y horarios. Datos independientes del selector.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setDraft(emptySede(state.districts))}
          >
            Nueva sede
          </Button>
        </div>

        {draft && !draft.id && (
          <SedeEditor
            sede={draft}
            districts={state.districts}
            onChange={setDraft}
            onSave={() => void persistSede(draft)}
            onCancel={() => setDraft(null)}
            title="Nuevo ítem"
          />
        )}

        <WidgetConfigItemList>
          {state.sedes.map((sede, index) => (
            <SedeEditor
              key={sede.id}
              sede={withCoords(sede)}
              districts={state.districts}
              title={`Ítem ${index + 1}`}
              onChange={(next) => {
                const { lat, lng } = parseCoordinates(next.coords);
                setState({
                  ...state,
                  sedes: state.sedes.map((s) =>
                    s.id === sede.id ? { ...s, ...next, lat, lng } : s,
                  ),
                });
              }}
              onSave={() => {
                const current = state.sedes.find((s) => s.id === sede.id);
                if (current) void persistSede(withCoords(current));
              }}
              onDelete={() => void removeSede(sede)}
              onDuplicate={() => duplicateSede(sede)}
            />
          ))}
        </WidgetConfigItemList>
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Mapa de sedes"
      description="Widget para educacion.mali.pe — contactos y ubicaciones"
      config={config}
      preview={<WidgetPreviewFrame key={previewKey} tabs={MAPA_PREVIEW} />}
    />
  );
}

function SedeEditor({
  sede,
  districts,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  title,
}: {
  sede: SedeDraft;
  districts: EducacionDistrictDto[];
  onChange: (sede: SedeDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  title?: string;
}) {
  const { lat, lng } = parseCoordinates(sede.coords);

  return (
    <WidgetConfigItemCard
      badge={title}
      inactive={!sede.activo}
      aside={
        <WidgetConfigItemMapThumb
          lat={lat}
          lng={lng}
          label={sede.nombre.trim() || 'Sede'}
          placeholderIcon={MapPin}
        />
      }
      actions={
        <>
          <Button className="text-sm px-3 py-1.5" onClick={onSave}>
            Guardar
          </Button>
          {onDuplicate && (
            <Button variant="outline" className="text-sm px-3 py-1.5" onClick={onDuplicate}>
              Duplicar
            </Button>
          )}
          {onDelete && (
            <Button variant="outline" className="text-sm px-3 py-1.5" onClick={onDelete}>
              Eliminar
            </Button>
          )}
          {onCancel && (
            <Button variant="outline" className="text-sm px-3 py-1.5" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </>
      }
    >
      <Input
        placeholder="Slug (único)"
        value={sede.slug}
        disabled={Boolean(sede.id)}
        onChange={(e) => onChange({ ...sede, slug: slugify(e.target.value) })}
      />
      <Input
        placeholder="Nombre"
        value={sede.nombre}
        onChange={(e) => onChange({ ...sede, nombre: e.target.value })}
      />
      <Input
        placeholder="Dirección"
        value={sede.direccion ?? ''}
        onChange={(e) => onChange({ ...sede, direccion: e.target.value })}
      />
      <Input
        placeholder="Coordenadas (lat, lng)"
        value={sede.coords}
        onChange={(e) => onChange({ ...sede, coords: e.target.value })}
      />
      <select
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={sede.districtId ?? ''}
        onChange={(e) =>
          onChange({ ...sede, districtId: e.target.value || null })
        }
      >
        <option value="">Sin distrito</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <textarea
        className="w-full rounded-lg border border-border bg-background p-2 text-sm"
        rows={3}
        placeholder="Horario HTML"
        value={sede.horarioHtml ?? ''}
        onChange={(e) => onChange({ ...sede, horarioHtml: e.target.value })}
      />
      <Input
        placeholder="Brochure URL"
        value={sede.brochureUrl}
        onChange={(e) => onChange({ ...sede, brochureUrl: e.target.value })}
      />
      <SettingSwitchInline
        checked={sede.activo}
        onCheckedChange={(activo) => onChange({ ...sede, activo })}
      />
    </WidgetConfigItemCard>
  );
}
