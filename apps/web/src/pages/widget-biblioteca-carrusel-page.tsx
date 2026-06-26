import { useCallback, useEffect, useState } from 'react';
import type { BibliotecaCarouselItemDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';

const CARRUSEL_PREVIEW = [
  {
    id: 'carrusel',
    label: 'Carrusel Koha',
    src: '/widgets/biblioteca/carrusel-biblioteca.html',
    height: '720px',
  },
];

function emptyItem(sortOrder: number): BibliotecaCarouselItemDto {
  return {
    id: '',
    title: '',
    subtitle: null,
    descriptionHtml: '',
    link: '',
    imageSrc: '',
    imageAlt: '',
    backgroundSrc: '',
    sortOrder,
    activo: true,
  };
}

export function WidgetBibliotecaCarruselPage() {
  const toast = useToast();
  const [items, setItems] = useState<BibliotecaCarouselItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<BibliotecaCarouselItemDto | null>(null);
  const area = WIDGET_AREAS.biblioteca;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.listBibliotecaCarouselAdmin());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistItem(item: BibliotecaCarouselItemDto) {
    const payload = {
      title: item.title.trim(),
      subtitle: item.subtitle?.trim() || null,
      descriptionHtml: item.descriptionHtml,
      link: item.link.trim(),
      imageSrc: item.imageSrc.trim(),
      imageAlt: item.imageAlt.trim() || item.title.trim(),
      backgroundSrc: item.backgroundSrc.trim() || item.imageSrc.trim(),
      sortOrder: item.sortOrder,
      activo: item.activo,
    };

    if (!payload.title || !payload.link || !payload.imageSrc) {
      toast.error('Título, enlace e imagen son obligatorios');
      return;
    }

    try {
      if (item.id) {
        await api.updateBibliotecaCarouselItem(item.id, payload);
        toast.success('Ítem guardado');
      } else {
        await api.createBibliotecaCarouselItem(payload);
        toast.success('Ítem creado');
        setDraft(null);
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  async function removeItem(item: BibliotecaCarouselItemDto) {
    if (!confirm(`¿Eliminar "${item.title}"?`)) return;
    try {
      await api.deleteBibliotecaCarouselItem(item.id);
      toast.success('Ítem eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function duplicateItem(item: BibliotecaCarouselItemDto) {
    setDraft({
      ...item,
      id: '',
      title: `${item.title} (copia)`,
      sortOrder: item.sortOrder + 1,
    });
  }

  if (loading) return <Spinner className="mx-auto mt-12" />;

  const config = (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Carrusel Koha ({items.length} ítems)</h2>
          <p className="text-sm text-muted">
            Datos servidos a biblioteca.mali.pe vía API.
          </p>
        </div>
        <Button variant="outline" onClick={() => setDraft(emptyItem(items.length))}>
          Nuevo ítem
        </Button>
      </div>

      {draft && !draft.id && (
        <ItemEditor
          item={draft}
          onChange={setDraft}
          onSave={() => void persistItem(draft)}
          onCancel={() => setDraft(null)}
          title="Nuevo ítem"
        />
      )}

      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {items.map((item) => (
          <ItemEditor
            key={item.id}
            item={item}
            onChange={(next) =>
              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, ...next } : i)),
              )
            }
            onSave={() => {
              const current = items.find((i) => i.id === item.id);
              if (current) void persistItem(current);
            }}
            onDelete={() => void removeItem(item)}
            onDuplicate={() => duplicateItem(item)}
          />
        ))}
      </div>
    </Card>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Carrusel Koha"
      description="Widget para biblioteca.mali.pe — novedades bibliográficas"
      config={config}
      preview={<WidgetPreviewFrame tabs={CARRUSEL_PREVIEW} />}
    />
  );
}

function ItemEditor({
  item,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onDuplicate,
  title,
}: {
  item: BibliotecaCarouselItemDto;
  onChange: (item: BibliotecaCarouselItemDto) => void;
  onSave: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      {title && <p className="text-sm font-medium">{title}</p>}
      <Input
        placeholder="Título"
        value={item.title}
        onChange={(e) => onChange({ ...item, title: e.target.value })}
      />
      <Input
        placeholder="Enlace OPAC"
        value={item.link}
        onChange={(e) => onChange({ ...item, link: e.target.value })}
      />
      <Input
        placeholder="URL imagen (imageSrc)"
        value={item.imageSrc}
        onChange={(e) => onChange({ ...item, imageSrc: e.target.value })}
      />
      <Input
        placeholder="URL fondo (backgroundSrc)"
        value={item.backgroundSrc}
        onChange={(e) => onChange({ ...item, backgroundSrc: e.target.value })}
      />
      <textarea
        className="w-full rounded-lg border border-border bg-background p-2 text-sm"
        rows={2}
        placeholder="Descripción HTML"
        value={item.descriptionHtml}
        onChange={(e) => onChange({ ...item, descriptionHtml: e.target.value })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={item.activo}
          onChange={(e) => onChange({ ...item, activo: e.target.checked })}
        />
        Activo
      </label>
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
