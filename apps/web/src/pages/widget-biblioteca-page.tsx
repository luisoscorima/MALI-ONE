import { useCallback, useEffect, useState } from 'react';
import type { BibliotecaCarouselItemDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { BIBLIOTECA_PREVIEW_TABS } from '@/lib/widget-tools';

export function WidgetBibliotecaPage() {
  const toast = useToast();
  const [items, setItems] = useState<BibliotecaCarouselItemDto[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function saveItem(item: BibliotecaCarouselItemDto) {
    try {
      await api.updateBibliotecaCarouselItem(item.id, {
        title: item.title,
        subtitle: item.subtitle,
        descriptionHtml: item.descriptionHtml,
        link: item.link,
        imageSrc: item.imageSrc,
        imageAlt: item.imageAlt,
        backgroundSrc: item.backgroundSrc,
        sortOrder: item.sortOrder,
        activo: item.activo,
      });
      toast.success('Ítem guardado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  if (loading) return <Spinner className="mx-auto mt-12" />;

  const config = (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">Carrusel Koha ({items.length} ítems)</h2>
      <p className="text-sm text-muted">
        Datos servidos a biblioteca.mali.pe vía API. El carrusel usa imágenes del OPAC Koha.
      </p>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
            <Input
              value={item.title}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id ? { ...i, title: e.target.value } : i,
                  ),
                )
              }
            />
            <Input
              placeholder="Enlace OPAC"
              value={item.link}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id ? { ...i, link: e.target.value } : i,
                  ),
                )
              }
            />
            <Input
              placeholder="imageSrc"
              value={item.imageSrc}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id ? { ...i, imageSrc: e.target.value } : i,
                  ),
                )
              }
            />
            <textarea
              className="w-full rounded-lg border border-border bg-background p-2 text-sm"
              rows={2}
              value={item.descriptionHtml}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? { ...i, descriptionHtml: e.target.value }
                      : i,
                  ),
                )
              }
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.activo}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === item.id ? { ...i, activo: e.target.checked } : i,
                    ),
                  )
                }
              />
              Activo
            </label>
            <Button className="text-sm px-3 py-1.5" onClick={() => void saveItem(item)}>
              Guardar
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <WidgetToolLayout
      title="Widgets Biblioteca"
      description="Configura el carrusel para biblioteca.mali.pe"
      config={config}
      preview={<WidgetPreviewFrame tabs={BIBLIOTECA_PREVIEW_TABS} />}
    />
  );
}
