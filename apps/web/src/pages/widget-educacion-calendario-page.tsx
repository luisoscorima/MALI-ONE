import { PageLoading } from '@/components/feedback';
import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { Card, Input } from '@/components/ui';
import { WidgetSaveButton } from '@/components/widget-item-card-actions';
import { useEducacionAdmin } from '@/hooks/use-educacion-admin';
import { WIDGET_AREAS } from '@/lib/widget-catalog';

const CALENDARIO_PREVIEW = [
  {
    id: 'calendario',
    label: 'Calendario',
    src: '/widgets/educacion/calendario.html',
    height: '800px',
  },
];

export function WidgetEducacionCalendarioPage() {
  const { state, setState, loading, saving, saveSettings } = useEducacionAdmin();
  const area = WIDGET_AREAS.educacion;

  if (loading || !state) {
    return <PageLoading variant="form" />;
  }

  const config = (
    <Card className="space-y-4 p-4">
      <h2 className="font-semibold">Calendario Google</h2>
      <p className="text-sm text-muted">
        La key se entrega al widget y Google la valida por referrer (
        <code className="text-xs">dev.mali.pe</code>,{' '}
        <code className="text-xs">educacion.mali.pe</code>). Debe tener la{' '}
        <strong>Calendar API</strong> habilitada en Google Cloud.
      </p>
      <div>
        <label htmlFor="googleCalendarId" className="mb-1 block text-sm text-muted">
          ID del calendario
        </label>
        <Input
          id="googleCalendarId"
          placeholder="talleresmali@mali.pe"
          value={state.settings.googleCalendarId ?? ''}
          onChange={(e) =>
            setState({
              ...state,
              settings: { ...state.settings, googleCalendarId: e.target.value },
            })
          }
        />
      </div>
      <WidgetSaveButton onClick={() => void saveSettings()} disabled={saving}>
        Guardar calendario
      </WidgetSaveButton>
    </Card>
  );

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Calendario"
      description="Widget para educacion.mali.pe — eventos desde Google Calendar"
      config={config}
      preview={<WidgetPreviewFrame tabs={CALENDARIO_PREVIEW} />}
    />
  );
}
