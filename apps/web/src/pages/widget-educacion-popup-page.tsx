import type { EducacionPopupSettingsDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import {
  PopupSettingsFields,
  PopupVisualPreview,
  popupPayloadFromSettings,
} from '@/components/popup-settings-panel';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card } from '@/components/ui';
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
    const payload = popupPayloadFromSettings(state.popup);
    if (!payload.imagenUrl || !payload.botonUrl) {
      toast.error('Imagen y URL del botón son obligatorios');
      return;
    }
    try {
      await api.updateEducacionPopup(payload);
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
    <>
      <PopupSettingsFields
        popup={popup}
        onChange={patchPopup}
        siteLabel="educacion.mali.pe"
      />
      <Button onClick={() => void savePopup()}>Guardar popup</Button>
    </>
  );

  const preview = (
    <div className="space-y-4">
      <PopupVisualPreview popup={popup} />

      <Card className="space-y-3 p-4">
        <h3 className="font-semibold">WordPress</h3>
        <p className="text-sm text-muted">
          Con el plugin <strong>mali-one-embed</strong> activo y el shortcode{' '}
          <code>[mali_popup]</code> en la página, el popup se carga desde MALI ONE.
        </p>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-medium text-foreground">
            Alternativa manual (sin plugin)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted/30 p-3 text-xs">
            {`<script src="https://dev.mali.pe/widgets/shared/popup-loader.js?ctx=educacion" defer></script>`}
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
