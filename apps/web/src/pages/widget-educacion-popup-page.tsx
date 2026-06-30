import type { EducacionPopupSettingsDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card, Input } from '@/components/ui';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';

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
          Se carga en todo educacion.mali.pe vía script remoto (no iframe).
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
    <Card className="space-y-3 p-4">
      <h3 className="font-semibold">Embed en WordPress</h3>
      <p className="text-sm text-muted">
        Activa el popup global desde el plugin <code>mali-one-embed</code> o
        añade el script en el footer del tema.
      </p>
      <pre className="overflow-x-auto rounded bg-muted/30 p-3 text-xs">
        {`<script src="{APP_URL}/widgets/educacion/popup-loader.js" defer></script>`}
      </pre>
    </Card>
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
