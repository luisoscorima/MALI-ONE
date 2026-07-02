import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BibliotecaCarouselItemDto,
  BibliotecaCarouselSettingsDto,
} from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import {
  WidgetConfigItemCard,
  WidgetConfigItemImageThumb,
} from '@/components/widget-config-item-card';
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
  const [settings, setSettings] = useState<BibliotecaCarouselSettingsDto | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<BibliotecaCarouselItemDto | null>(null);
  const area = WIDGET_AREAS.biblioteca;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsData, settingsData] = await Promise.all([
        api.listBibliotecaCarouselAdmin(),
        api.getBibliotecaCarouselSettings(),
      ]);
      setItems(itemsData);
      setSettings(settingsData);
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

  async function saveSettings() {
    if (!settings) return;
    const headerTitle = settings.headerTitle.trim();
    const headerColor = settings.headerColor.trim().toLowerCase();

    if (!headerTitle) {
      toast.error('El título del encabezado es obligatorio');
      return;
    }
    if (!/^#[0-9a-f]{6}$/.test(headerColor)) {
      toast.error('El color debe ser hexadecimal (#RRGGBB)');
      return;
    }

    try {
      const saved = await api.updateBibliotecaCarouselSettings({
        headerTitle,
        headerColor,
      });
      setSettings(saved);
      setPreviewKey((k) => k + 1);
      toast.success('Encabezado guardado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar encabezado');
    }
  }

  if (loading || !settings) return <Spinner className="mx-auto mt-12" />;

  const config = (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Encabezado del carrusel</h2>
        <p className="text-sm text-muted">
          Título y color que aparecen arriba en biblioteca.mali.pe.
        </p>
        <Input
          placeholder="Título del encabezado"
          value={settings.headerTitle}
          onChange={(e) =>
            setSettings({ ...settings, headerTitle: e.target.value })
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Color</span>
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
              value={settings.headerColor}
              onChange={(e) =>
                setSettings({ ...settings, headerColor: e.target.value })
              }
            />
          </label>
          <Input
            className="max-w-[8rem] font-mono"
            value={settings.headerColor}
            onChange={(e) =>
              setSettings({ ...settings, headerColor: e.target.value })
            }
          />
          <span
            className="rounded px-2 py-1 text-sm font-bold tracking-wide"
            style={{ color: settings.headerColor }}
          >
            Vista previa
          </span>
        </div>
        <Button onClick={() => void saveSettings()}>Guardar encabezado</Button>
      </Card>

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
    </div>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Carrusel Koha"
      description="Widget para biblioteca.mali.pe — novedades bibliográficas"
      config={config}
      preview={<WidgetPreviewFrame key={previewKey} tabs={CARRUSEL_PREVIEW} />}
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
    <WidgetConfigItemCard
      badge={title}
      inactive={!item.activo}
      aside={
        <WidgetConfigItemImageThumb
          imageUrl={item.imageSrc}
          alt={item.imageAlt || item.title}
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
        <DescriptionHtmlField
          value={item.descriptionHtml}
          onChange={(descriptionHtml) => onChange({ ...item, descriptionHtml })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={item.activo}
            onChange={(e) => onChange({ ...item, activo: e.target.checked })}
          />
          Activo
        </label>
      </div>
    </WidgetConfigItemCard>
  );
}

function wrapWithTag(
  value: string,
  start: number,
  end: number,
  openTag: string,
  closeTag: string,
) {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  if (
    selected &&
    before.endsWith(openTag) &&
    after.startsWith(closeTag)
  ) {
    return {
      value: before.slice(0, -openTag.length) + selected + after.slice(closeTag.length),
      selectionStart: start - openTag.length,
      selectionEnd: end - openTag.length,
    };
  }

  if (selected) {
    return {
      value: before + openTag + selected + closeTag + after,
      selectionStart: start + openTag.length,
      selectionEnd: end + openTag.length,
    };
  }

  return {
    value: before + openTag + closeTag + after,
    selectionStart: start + openTag.length,
    selectionEnd: start + openTag.length,
  };
}

function DescriptionHtmlField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyItalic = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const { selectionStart, selectionEnd } = el;
    const result = wrapWithTag(value, selectionStart, selectionEnd, '<i>', '</i>');
    onChange(result.value);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }, [onChange, value]);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Descripción bibliográfica</span>
        <Button
          type="button"
          variant="outline"
          className="h-7 min-w-7 px-2 text-sm italic font-serif"
          title="Cursiva — selecciona texto y pulsa (Ctrl+I)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={applyItalic}
        >
          I
        </Button>
        <span className="text-xs text-muted">Selecciona el título y pulsa I para cursiva</span>
      </div>
      <textarea
        ref={textareaRef}
        className="w-full rounded-lg border border-border bg-background p-2 text-sm font-mono"
        rows={3}
        placeholder="Autor; Título del libro. Año."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            applyItalic();
          }
        }}
      />
    </div>
  );
}
