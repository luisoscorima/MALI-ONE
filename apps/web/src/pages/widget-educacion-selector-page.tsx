import { useState } from 'react';
import type { EducacionSelectorSedeDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import {
  WidgetConfigItemCard,
  WidgetConfigItemMaterialIconThumb,
} from '@/components/widget-config-item-card';
import { Button, Card, Input } from '@/components/ui';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { slugify } from '@/lib/coordinates';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';

const SELECTOR_PREVIEW = [
  {
    id: 'selector',
    label: 'Selector sedes',
    src: '/widgets/educacion/selector-sedes.html',
    height: 'min(85vh, 640px)',
    previewMode: true,
  },
];


function emptySelectorSede(): EducacionSelectorSedeDto {
  return {
    id: '',
    slug: '',
    nombre: '',
    brochureUrl: '',
    icon: '',
    sortOrder: 0,
    activo: true,
  };
}

export function WidgetEducacionSelectorPage() {
  const toast = useToast();
  const { state, setState, loading, reload } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;
  const [draft, setDraft] = useState<EducacionSelectorSedeDto | null>(null);

  async function persistSede(sede: EducacionSelectorSedeDto) {
    const icon = sede.icon.trim();
    const payload: Record<string, unknown> = {
      slug: sede.slug.trim(),
      nombre: sede.nombre.trim(),
      brochureUrl: sede.brochureUrl.trim(),
      sortOrder: sede.sortOrder,
      activo: sede.activo,
    };
    if (icon) payload.icon = icon;

    if (!payload.slug || !payload.nombre || !payload.brochureUrl) {
      toast.error('Slug, nombre y brochure son obligatorios');
      return;
    }

    try {
      if (sede.id) {
        await api.updateEducacionSelectorSede(sede.id, payload);
        toast.success(`Sede ${payload.nombre} guardada`);
      } else {
        await api.createEducacionSelectorSede(payload);
        toast.success(`Sede ${payload.nombre} creada`);
        setDraft(null);
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar sede');
    }
  }

  async function removeSede(sede: EducacionSelectorSedeDto) {
    if (!confirm(`¿Eliminar "${sede.nombre}" del selector?`)) return;
    try {
      await api.deleteEducacionSelectorSede(sede.id);
      toast.success('Sede eliminada');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function duplicateSede(sede: EducacionSelectorSedeDto) {
    setDraft({
      ...emptySelectorSede(),
      slug: slugify(`${sede.slug}-copia`),
      nombre: `${sede.nombre} (copia)`,
      brochureUrl: sede.brochureUrl,
      icon: sede.icon,
      sortOrder: sede.sortOrder + 1,
    });
  }

  if (loading || !state) {
    return <Spinner className="mx-auto mt-12" />;
  }

  const config = (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">
            Sedes del selector ({state.selectorSedes.length})
          </h2>
          <p className="text-sm text-muted">
            Sedes principales con enlace a brochure. Datos independientes del mapa.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDraft(emptySelectorSede())}>
          Nueva sede
        </Button>
      </div>

      {draft && !draft.id && (
        <SelectorEditor
          sede={draft}
          onChange={setDraft}
          onSave={() => void persistSede(draft)}
          onCancel={() => setDraft(null)}
          title="Nueva sede"
        />
      )}

      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {state.selectorSedes.map((sede) => (
          <SelectorEditor
            key={sede.id}
            sede={sede}
            onChange={(next) =>
              setState({
                ...state,
                selectorSedes: state.selectorSedes.map((s) =>
                  s.id === sede.id ? { ...s, ...next } : s,
                ),
              })
            }
            onSave={() => {
              const current = state.selectorSedes.find((s) => s.id === sede.id);
              if (current) void persistSede(current);
            }}
            onDelete={() => void removeSede(sede)}
            onDuplicate={() => duplicateSede(sede)}
          />
        ))}
      </div>
    </Card>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Selector de sedes"
      description="Widget para educacion.mali.pe — brochures por sede principal"
      config={config}
      preview={<WidgetPreviewFrame tabs={SELECTOR_PREVIEW} />}
    />
  );
}

function SelectorEditor({
  sede,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  title,
}: {
  sede: EducacionSelectorSedeDto;
  onChange: (sede: EducacionSelectorSedeDto) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  title?: string;
}) {
  return (
    <WidgetConfigItemCard
      badge={title}
      inactive={!sede.activo}
      aside={
        <WidgetConfigItemMaterialIconThumb
          icon={sede.icon}
          label={sede.slug || 'sede'}
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
      <div className="space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            placeholder="Slug"
            value={sede.slug}
            disabled={Boolean(sede.id)}
            onChange={(e) => onChange({ ...sede, slug: slugify(e.target.value) })}
          />
          <Input
            placeholder="Orden"
            type="number"
            value={sede.sortOrder}
            onChange={(e) =>
              onChange({ ...sede, sortOrder: Number(e.target.value) || 0 })
            }
          />
        </div>
        <Input
          placeholder="Nombre visible"
          value={sede.nombre}
          onChange={(e) => onChange({ ...sede, nombre: e.target.value })}
        />
        <Input
          placeholder="Icono Material Icons (nombre del glifo)"
          value={sede.icon}
          onChange={(e) => onChange({ ...sede, icon: e.target.value })}
        />
        <Input
          placeholder="Brochure URL"
          value={sede.brochureUrl}
          onChange={(e) => onChange({ ...sede, brochureUrl: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sede.activo}
            onChange={(e) => onChange({ ...sede, activo: e.target.checked })}
          />
          Activa
        </label>
      </div>
    </WidgetConfigItemCard>
  );
}
