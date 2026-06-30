import { useState } from 'react';
import type { EducacionPopupSettingsDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';

function PopupVisualPreview({ popup }: { popup: EducacionPopupSettingsDto }) {
  const [open, setOpen] = useState(true);

  if (!popup.activo) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">
          El popup está <strong>desactivado</strong>. Actívalo en Configuración para
          que aparezca en educacion.mali.pe.
        </p>
      </Card>
    );
  }

  if (!popup.imagenUrl.trim()) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted">
          Añade una URL de imagen en Configuración para ver la vista previa.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="text-sm text-muted">Así se verá el overlay en el sitio</p>
        <Button
          variant="outline"
          className="text-xs px-2 py-1"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Ocultar popup' : 'Mostrar popup'}
        </Button>
      </div>

      <div
        className="relative flex min-h-[420px] items-center justify-center bg-[#333333]/80 p-6"
        role="presentation"
      >
        {!open && (
          <p className="text-sm text-white/80">
            Popup cerrado — pulsa «Mostrar popup» para simularlo
          </p>
        )}

        {open && (
          <div className="relative w-full max-w-[500px]">
            <button
              type="button"
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-10 text-3xl leading-none text-white"
              onClick={() => setOpen(false)}
            >
              ×
            </button>

            <div className="overflow-hidden shadow-2xl">
              {popup.imagenLinkUrl ? (
                <a
                  href={popup.imagenLinkUrl}
                  target={popup.imagenTarget}
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={popup.imagenUrl}
                    alt={popup.titulo ?? 'Popup'}
                    className="block w-full object-cover"
                  />
                </a>
              ) : (
                <img
                  src={popup.imagenUrl}
                  alt={popup.titulo ?? 'Popup'}
                  className="block w-full object-cover"
                />
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <a
                href={popup.botonUrl || '#'}
                target={popup.botonTarget}
                rel="noopener noreferrer"
                className="inline-block min-w-[165px] bg-[#702082] px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white no-underline hover:bg-[#ae3dc7]"
              >
                {popup.botonTexto || 'Ver más'}
              </a>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-1 border-t border-border px-4 py-3 text-xs text-muted">
        <li>Delay al abrir: {popup.delayMs} ms</li>
        {popup.showOnce && (
          <li>Se muestra una sola vez por visitante (localStorage)</li>
        )}
      </ul>
    </Card>
  );
}

export function WidgetEducacionPopupPage() {
  const toast = useToast();
  const { state, setState, loading, reload } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;

  async function savePopup() {
    if (!state) return;
    const p = state.popup;
    if (!p.imagenUrl.trim() || !p.botonUrl.trim()) {
      toast.error('Imagen y URL del botón son obligatorios');
      return;
    }
    try {
      await api.updateEducacionPopup({
        activo: p.activo,
        imagenUrl: p.imagenUrl.trim(),
        imagenLinkUrl: p.imagenLinkUrl?.trim() || null,
        imagenTarget: p.imagenTarget,
        titulo: p.titulo?.trim() || null,
        botonTexto: p.botonTexto.trim(),
        botonUrl: p.botonUrl.trim(),
        botonTarget: p.botonTarget,
        showOnce: p.showOnce,
        delayMs: p.delayMs,
        animationSpeedMs: p.animationSpeedMs,
      });
      toast.success('Popup guardado');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  if (loading || !state) {
    return <Spinner className="mx-auto mt-12" />;
  }

  const popup = state.popup;

  function patchPopup(patch: Partial<EducacionPopupSettingsDto>) {
    setState({ ...state!, popup: { ...popup, ...patch } });
  }

  const config = (
    <Card className="space-y-4 p-4">
      <div>
        <h2 className="font-semibold">Popup promocional</h2>
        <p className="text-sm text-muted">
          Overlay global en educacion.mali.pe. Los cambios se publican al guardar.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={popup.activo}
          onChange={(e) => patchPopup({ activo: e.target.checked })}
        />
        Popup activo
      </label>

      <Input
        placeholder="URL de la imagen"
        value={popup.imagenUrl}
        onChange={(e) => patchPopup({ imagenUrl: e.target.value })}
      />

      {popup.imagenUrl && (
        <img
          src={popup.imagenUrl}
          alt={popup.titulo ?? 'Vista previa popup'}
          className="max-h-48 rounded border border-border object-contain"
        />
      )}

      <Input
        placeholder="URL al hacer clic en la imagen (opcional)"
        value={popup.imagenLinkUrl ?? ''}
        onChange={(e) =>
          patchPopup({ imagenLinkUrl: e.target.value || null })
        }
      />

      <Input
        placeholder="Título / alt de la imagen"
        value={popup.titulo ?? ''}
        onChange={(e) => patchPopup({ titulo: e.target.value || null })}
      />

      <div className="grid gap-2 md:grid-cols-2">
        <Input
          placeholder="Texto del botón"
          value={popup.botonTexto}
          onChange={(e) => patchPopup({ botonTexto: e.target.value })}
        />
        <Input
          placeholder="URL del botón"
          value={popup.botonUrl}
          onChange={(e) => patchPopup({ botonUrl: e.target.value })}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Input
          placeholder="Delay (ms)"
          type="number"
          value={popup.delayMs}
          onChange={(e) =>
            patchPopup({ delayMs: Number(e.target.value) || 0 })
          }
        />
        <Input
          placeholder="Animación cierre (ms)"
          type="number"
          value={popup.animationSpeedMs}
          onChange={(e) =>
            patchPopup({ animationSpeedMs: Number(e.target.value) || 0 })
          }
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={popup.showOnce}
          onChange={(e) => patchPopup({ showOnce: e.target.checked })}
        />
        Mostrar solo una vez por visitante (localStorage)
      </label>

      <Button onClick={() => void savePopup()}>Guardar popup</Button>
    </Card>
  );

  const preview = (
    <div className="space-y-4">
      <PopupVisualPreview popup={popup} />

      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">WordPress</h3>
        <p className="text-sm text-muted">
          Con el plugin <strong>mali-one-embed</strong> activo y el shortcode{' '}
          <code>[mali_popup]</code> en la página (como en tu home),{' '}
          <strong>no necesitas pegar ningún script</strong>. El plugin carga el
          popup automáticamente desde MALI ONE.
        </p>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-medium text-foreground">
            Alternativa manual (sin plugin)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted/30 p-3 text-xs">
            {`<script src="https://dev.mali.pe/widgets/educacion/popup-loader.js" defer></script>`}
          </pre>
        </details>
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Popup promocional"
      description="Overlay global para educacion.mali.pe"
      config={config}
      preview={preview}
    />
  );
}
