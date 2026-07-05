import { useState } from 'react';
import type {
  EducacionAliadoCategoria,
  EducacionAliadoDto,
} from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import {
  WidgetConfigItemCard,
  WidgetConfigItemImageThumb,
  WidgetConfigItemList,
} from '@/components/widget-config-item-card';
import { Button, Card, Input, SettingSwitchInline } from '@/components/ui';
import { WidgetItemCardActions } from '@/components/widget-item-card-actions';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';

const ALIADOS_PREVIEW = [
  {
    id: 'aliados',
    label: 'Aliados',
    src: '/widgets/educacion/aliados.html',
    height: '520px',
  },
];

const CATEGORIAS: { value: EducacionAliadoCategoria; label: string }[] = [
  { value: 'patrocinador', label: 'Patrocinador' },
  { value: 'auspiciador', label: 'Auspiciador' },
  { value: 'aliado', label: 'Aliado' },
  { value: 'socio', label: 'Socio' },
];

function emptyAliado(sortOrder: number): EducacionAliadoDto {
  return {
    id: '',
    nombre: '',
    imageUrl: '',
    categoria: 'aliado',
    url: null,
    sortOrder,
    activo: true,
  };
}

export function WidgetEducacionAliadosPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { state, setState, loading, reload } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;
  const [draft, setDraft] = useState<EducacionAliadoDto | null>(null);

  async function persistAliado(aliado: EducacionAliadoDto) {
    const payload = {
      nombre: aliado.nombre.trim(),
      imageUrl: aliado.imageUrl.trim(),
      categoria: aliado.categoria,
      url: aliado.url?.trim() || null,
      sortOrder: aliado.sortOrder,
      activo: aliado.activo,
    };

    if (!payload.nombre || !payload.imageUrl) {
      toast.error('Nombre e imagen son obligatorios');
      return;
    }

    try {
      if (aliado.id) {
        await api.updateEducacionAliado(aliado.id, payload);
        toast.success(`Aliado ${payload.nombre} guardado`);
      } else {
        await api.createEducacionAliado(payload);
        toast.success(`Aliado ${payload.nombre} creado`);
        setDraft(null);
      }
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function removeAliado(aliado: EducacionAliadoDto) {
    const ok = await confirm({
      title: `¿Eliminar "${aliado.nombre}"?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteEducacionAliado(aliado.id);
      toast.success('Aliado eliminado');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function duplicateAliado(aliado: EducacionAliadoDto) {
    setDraft({
      ...emptyAliado(aliado.sortOrder + 1),
      nombre: `${aliado.nombre} (copia)`,
      imageUrl: aliado.imageUrl,
      categoria: aliado.categoria,
      url: aliado.url,
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
            Aliados / auspiciadores ({state.aliados.length})
          </h2>
          <p className="text-sm text-muted">
            Logos con filtro por categoría.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDraft(emptyAliado(state.aliados.length))}>
          Nuevo aliado
        </Button>
      </div>

      {draft && !draft.id && (
        <AliadoEditor
          aliado={draft}
          onChange={setDraft}
          onSave={() => void persistAliado(draft)}
          onCancel={() => setDraft(null)}
          title="Nuevo ítem"
        />
      )}

      <WidgetConfigItemList>
        {state.aliados.map((aliado, index) => (
          <AliadoEditor
            key={aliado.id}
            aliado={aliado}
            title={`Ítem ${index + 1}`}
            onChange={(next) =>
              setState({
                ...state,
                aliados: state.aliados.map((a) =>
                  a.id === aliado.id ? { ...a, ...next } : a,
                ),
              })
            }
            onSave={() => {
              const current = state.aliados.find((a) => a.id === aliado.id);
              if (current) void persistAliado(current);
            }}
            onDelete={() => void removeAliado(aliado)}
            onDuplicate={() => duplicateAliado(aliado)}
          />
        ))}
      </WidgetConfigItemList>
    </Card>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Aliados / auspiciadores"
      description="Grilla de logos para educacion.mali.pe"
      config={config}
      preview={<WidgetPreviewFrame tabs={ALIADOS_PREVIEW} />}
    />
  );
}

function AliadoEditor({
  aliado,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  title,
}: {
  aliado: EducacionAliadoDto;
  onChange: (aliado: EducacionAliadoDto) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  title?: string;
}) {
  return (
    <WidgetConfigItemCard
      badge={title}
      inactive={!aliado.activo}
      aside={
        <WidgetConfigItemImageThumb
          imageUrl={aliado.imageUrl}
          alt={aliado.nombre}
          fit="contain"
        />
      }
      actions={
        <WidgetItemCardActions
          onSave={onSave}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onCancel={onCancel}
        />
      }
    >
      <Input
        placeholder="Nombre"
        value={aliado.nombre}
        onChange={(e) => onChange({ ...aliado, nombre: e.target.value })}
      />
      <select
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={aliado.categoria}
        onChange={(e) =>
          onChange({
            ...aliado,
            categoria: e.target.value as EducacionAliadoCategoria,
          })
        }
      >
        {CATEGORIAS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <Input
        placeholder="URL del logo (S3 o externa)"
        value={aliado.imageUrl}
        onChange={(e) => onChange({ ...aliado, imageUrl: e.target.value })}
      />
      <Input
        placeholder="Sitio web (opcional)"
        value={aliado.url ?? ''}
        onChange={(e) =>
          onChange({ ...aliado, url: e.target.value || null })
        }
      />
      <Input
        placeholder="Orden"
        type="number"
        value={aliado.sortOrder}
        onChange={(e) =>
          onChange({ ...aliado, sortOrder: Number(e.target.value) || 0 })
        }
      />
      <SettingSwitchInline
        label="Aliado activo"
        checked={aliado.activo}
        onCheckedChange={(activo) => onChange({ ...aliado, activo })}
        activeLabel="Activo"
        inactiveLabel="Inactivo"
      />
    </WidgetConfigItemCard>
  );
}
