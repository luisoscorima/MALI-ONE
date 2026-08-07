import { WidgetBackLink } from '@/components/widget-area-hub';
import { WidgetPreviewFrame } from '@/components/widget-preview-frame';
import { WidgetToolLayout } from '@/components/widget-tool-layout';
import { WIDGET_AREAS } from '@/lib/widget-catalog';

const LEAD_PREVIEW = [
  {
    id: 'lead-form',
    label: 'Conversemos',
    src: '/widgets/educacion/lead-form.html?titulo=Curso%20de%20ejemplo&curso=ejemplo&area=educacion_ep&bg=%23b4b3ff',
    height: '720px',
  },
];

export function WidgetEducacionLeadFormPage() {
  const area = WIDGET_AREAS.educacion;

  return (
    <WidgetToolLayout
      backLink={<WidgetBackLink area={area} />}
      title="Formulario Conversemos"
      description="Captura de leads embebible en fichas de curso (WhatsApp CRM + espejo Sheet transitorio)."
      preview={<WidgetPreviewFrame tabs={LEAD_PREVIEW} />}
      previewOnly
    />
  );
}
