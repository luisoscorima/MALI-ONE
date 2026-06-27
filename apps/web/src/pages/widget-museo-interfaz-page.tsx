import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { WIDGET_AREAS } from '@/lib/widget-catalog';

const INTERFAZ_PREVIEW = [
  {
    id: 'sistemas',
    label: 'Interfaz sistemas',
    src: '/widgets/museo/interfaz-sistemas.html',
    height: 'min(90vh, 900px)',
  },
];

export function WidgetMuseoInterfazPage() {
  const area = WIDGET_AREAS.museo;

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Interfaz de sistemas"
      description="Widget estático para mali.pe/es — slideshow de plataformas MALI"
      preview={<WidgetPreviewFrame tabs={INTERFAZ_PREVIEW} />}
      previewOnly
    />
  );
}
