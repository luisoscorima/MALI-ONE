import { useState } from 'react';
import type {
  EducacionAliadoCategoria,
  EducacionAliadoDto,
} from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';
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

function parseAliadosImport(raw: string): Record<string, unknown>[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Pega un JSON con la lista de aliados');
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { aliados?: unknown }).aliados)
  ) {
    return (parsed as { aliados: Record<string, unknown>[] }).aliados;
  }
  throw new Error('Usa un array [...] o el bloque aliados: [...] de mapa_conf.js');
}

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
  const { state, setState, loading, reload } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;
  const [draft, setDraft] = useState<EducacionAliadoDto | null>(null);
  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);

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
    if (!confirm(`¿Eliminar "${aliado.nombre}"?`)) return;
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

  async function runBulkImport() {
    setImporting(true);
    try {
      const items = parseAliadosImport(importJson);
      const result = await api.importEducacionAliados(items, true);
      toast.success(`Importados ${result.upserted} aliados (URLs conservadas)`);
      setImportJson('');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
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
            Logos con filtro por categoría. Las imágenes pueden ser URLs externas
            (p. ej. WordPress); no hace falta subirlas a S3.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDraft(emptyAliado(state.aliados.length))}>
          Nuevo aliado
        </Button>
      </div>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Importar en lote (JSON)
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted">
            Pega el array de <code>mapa_conf.js</code> (campo{' '}
            <code>imagen</code> o <code>imageUrl</code>). Se conservan las URLs
            de educacion.mali.pe. Los aliados que no estén en la lista se
            desactivan.
          </p>
          <textarea
            className="min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            placeholder={'[\n  { "nombre": "...", "imagen": "https://...", "categoria": "aliado", "url": "..." }\n]'}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <Button
            variant="outline"
            className="text-sm"
            disabled={importing || !importJson.trim()}
            onClick={() => void runBulkImport()}
          >
            {importing ? 'Importando…' : 'Importar aliados'}
          </Button>
        </div>
      </details>

      {draft && !draft.id && (
        <AliadoEditor
          aliado={draft}
          onChange={setDraft}
          onSave={() => void persistAliado(draft)}
          onCancel={() => setDraft(null)}
          title="Nuevo aliado"
        />
      )}

      <div className="space-y-4">
        {state.aliados.map((aliado) => (
          <AliadoEditor
            key={aliado.id}
            aliado={aliado}
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
      </div>
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
    <div className="rounded-lg border border-border p-3 space-y-2">
      {title && <p className="text-sm font-medium">{title}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          placeholder="Nombre"
          value={aliado.nombre}
          onChange={(e) => onChange({ ...aliado, nombre: e.target.value })}
        />
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
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
      </div>
      <Input
        placeholder="URL del logo (S3 o externa)"
        value={aliado.imageUrl}
        onChange={(e) => onChange({ ...aliado, imageUrl: e.target.value })}
      />
      {aliado.imageUrl && (
        <img
          src={aliado.imageUrl}
          alt={aliado.nombre}
          className="h-16 object-contain"
        />
      )}
      <Input
        placeholder="Sitio web (opcional)"
        value={aliado.url ?? ''}
        onChange={(e) =>
          onChange({ ...aliado, url: e.target.value || null })
        }
      />
      <div className="grid gap-2 md:grid-cols-2">
        <Input
          placeholder="Orden"
          type="number"
          value={aliado.sortOrder}
          onChange={(e) =>
            onChange({ ...aliado, sortOrder: Number(e.target.value) || 0 })
          }
        />
        <label className="flex items-center gap-2 text-sm self-center">
          <input
            type="checkbox"
            checked={aliado.activo}
            onChange={(e) => onChange({ ...aliado, activo: e.target.checked })}
          />
          Activo
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
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
      </div>
    </div>
  );
}
