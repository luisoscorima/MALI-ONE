import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
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
  const area = WIDGET_AREAS.educacion;

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Calendario"
      description="Widget estático para educacion.mali.pe — sin configuración en MALI ONE"
      preview={<WidgetPreviewFrame tabs={CALENDARIO_PREVIEW} />}
      previewOnly
    />
  );
}
