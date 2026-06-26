import type { WidgetPreviewTab } from '@/components/widget-preview-frame';

export const EDUCACION_PREVIEW_TABS: WidgetPreviewTab[] = [
  {
    id: 'calendario',
    label: 'Calendario',
    src: '/widgets/educacion/calendario.html',
    height: '800px',
  },
  {
    id: 'mapa',
    label: 'Mapa',
    src: '/widgets/educacion/mapa.html',
    height: '680px',
  },
  {
    id: 'selector',
    label: 'Selector sedes',
    src: '/widgets/educacion/selector-sedes.html',
    height: '200px',
  },
];

export const BIBLIOTECA_PREVIEW_TABS: WidgetPreviewTab[] = [
  {
    id: 'carrusel',
    label: 'Carrusel Koha',
    src: '/widgets/biblioteca/carrusel-biblioteca.html',
    height: '720px',
  },
  {
    id: 'sistemas',
    label: 'Interfaz sistemas',
    src: '/widgets/biblioteca/interfaz-sistemas.html',
    height: 'min(90vh, 900px)',
  },
];

export const PAM_PREVIEW_TABS: WidgetPreviewTab[] = [
  {
    id: 'membership',
    label: 'Membresías',
    src: '/widgets/pam/membership.html',
    height: '900px',
    pamEmbed: true,
  },
];
