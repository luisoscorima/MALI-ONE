import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { EducacionSelectorSedeDto } from '@mali-one/shared';
import { PageLoading } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import {
  WidgetConfigItemCard,
  WidgetConfigItemList,
  WidgetConfigItemMaterialIconThumb,
} from '@/components/widget-config-item-card';
import { Card, Input, SettingSwitchInline } from '@/components/ui';
import { MaterialIconPicker } from '@/components/material-icon-picker';
import { WidgetItemCardActions } from '@/components/widget-item-card-actions';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';

const SELECTOR_PREVIEW = [
  {
    id: 'selector',
    label: 'Selector sedes',
    src: '/widgets/educacion/selector-sedes.html',
    height: 'min(85vh, 640px)',
    previewMode: true,
  },
];

export function WidgetEducacionSelectorPage() {
  const toast = useToast();
  const { state, setState, loading, reload } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;
  const [previewKey, setPreviewKey] = useState(0);

  async function persistSede(sede: EducacionSelectorSedeDto) {
    try {
      await api.updateEducacionSelectorSede(sede.id, {
        showOnSelector: sede.showOnSelector,
        nombreSelector: sede.nombreSelector,
        icon: sede.icon,
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

  const config = (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-semibold">
          Sedes del selector ({state.selectorSedes.filter((sede) => sede.showOnSelector).length})
        </h2>
        <p className="text-sm text-muted">
          El nombre oficial y el brochure se editan en{' '}
          <Link className="underline" to="/admin/catalogo-educacion">Catálogo Educación</Link>.
          Aquí eliges si la sede se muestra, su nombre visible y su ícono. El ícono es el mismo del catálogo.
        </p>
      </div>
      <WidgetConfigItemList>
        {state.selectorSedes.map((sede) => (
          <SelectorEditor
            key={sede.id}
            sede={sede}
            onChange={(next) =>
              setState({
                ...state,
                selectorSedes: state.selectorSedes.map((item) =>
                  item.id === sede.id ? { ...item, ...next } : item,
                ),
              })
            }
            onSave={() => {
              const current = state.selectorSedes.find((item) => item.id === sede.id);
              if (current) void persistSede(current);
            }}
          />
        ))}
      </WidgetConfigItemList>
    </Card>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Selector de sedes"
      description="Qué sedes del catálogo aparecen en educacion.mali.pe"
      config={config}
      preview={<WidgetPreviewFrame key={previewKey} tabs={SELECTOR_PREVIEW} />}
    />
  );
}

function SelectorEditor({
  sede,
  onChange,
  onSave,
}: {
  sede: EducacionSelectorSedeDto;
  onChange: (sede: EducacionSelectorSedeDto) => void;
  onSave: () => void;
}) {
  const visible = sede.nombreSelector?.trim() || sede.nombre;

  return (
    <WidgetConfigItemCard
      inactive={!sede.showOnSelector}
      aside={
        <WidgetConfigItemMaterialIconThumb
          icon={sede.icon}
          label={visible}
        />
      }
      actions={<WidgetItemCardActions onSave={onSave} />}
    >
      <p className="text-sm font-medium">{sede.nombre}</p>
      <p className="truncate text-sm text-muted">{sede.brochureUrl || 'Sin brochure en el catálogo'}</p>
      <Input
        placeholder={`Nombre visible (si se deja vacío: ${sede.nombre})`}
        value={sede.nombreSelector ?? ''}
        onChange={(e) => onChange({ ...sede, nombreSelector: e.target.value })}
      />
      <MaterialIconPicker
        value={sede.icon}
        onChange={(icon) => onChange({ ...sede, icon })}
      />
      <SettingSwitchInline
        label="Mostrar en el selector"
        checked={sede.showOnSelector}
        onCheckedChange={(checked) => onChange({ ...sede, showOnSelector: checked })}
      />
    </WidgetConfigItemCard>
  );
}
