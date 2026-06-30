import { useCallback, useEffect, useState } from 'react';
import type { MuseoPopupSettingsDto } from '@mali-one/shared';
import { Spinner } from '@/components/feedback';
import {
  PopupSettingsFields,
  PopupVisualPreview,
  popupPayloadFromSettings,
} from '@/components/popup-settings-panel';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { WIDGET_AREAS } from '@/lib/widget-catalog';
import { useToast } from '@/contexts/toast-context';

export function WidgetMuseoPopupPage() {
  const toast = useToast();
  const [popup, setPopup] = useState<MuseoPopupSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const area = WIDGET_AREAS.museo;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const admin = await api.getPamWidgetAdmin();
      setPopup(admin.popup);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePopup() {
    if (!popup) return;
    const payload = popupPayloadFromSettings(popup);
    if (!payload.imagenUrl || !payload.botonUrl) {
      toast.error('Imagen y URL del botón son obligatorios');
      return;
    }
    try {
      await api.updateMuseoPopup(payload);
      toast.success('Popup guardado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    }
  }

  if (loading || !popup) {
    return <Spinner className="mx-auto mt-12" />;
  }

  const config = (
    <>
      <PopupSettingsFields
        popup={popup}
        onChange={(patch) => setPopup({ ...popup, ...patch })}
        siteLabel="mali.pe/es"
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
          <code>[mali_popup]</code> en la página, el popup del museo se carga desde
          MALI ONE (config separada de Educación).
        </p>
        <p className="text-sm text-muted">
          Puedes desactivar los plugins legacy <code>mali-popup</code> y{' '}
          <code>mali-shared-config</code> (sección popup) tras migrar.
        </p>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-medium text-foreground">
            Alternativa manual (sin plugin)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted/30 p-3 text-xs">
            {`<script src="https://dev.mali.pe/widgets/shared/popup-loader.js?site=museo" defer></script>`}
          </pre>
        </details>
      </Card>
    </div>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Popup promocional"
      description="Overlay global para mali.pe/es (contenido distinto a Educación)"
      config={config}
      preview={preview}
    />
  );
}
