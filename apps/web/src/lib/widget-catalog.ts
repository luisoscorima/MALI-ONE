import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  Heart,
  Images,
  LayoutGrid,
  MapPin,
  MousePointerClick,
} from 'lucide-react';

export type WidgetAreaId = 'educacion' | 'biblioteca' | 'museo';

export type WidgetCatalogEntry = {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  /** Sin editor de datos — solo vista previa */
  previewOnly?: boolean;
  embedHost: string;
};

export type WidgetAreaCatalog = {
  id: WidgetAreaId;
  title: string;
  description: string;
  basePath: string;
  widgets: WidgetCatalogEntry[];
};

export const WIDGET_AREAS: Record<WidgetAreaId, WidgetAreaCatalog> = {
  educacion: {
    id: 'educacion',
    title: 'Widgets Educación',
    description: 'Herramientas embebibles en educacion.mali.pe',
    basePath: '/admin/widgets/educacion',
    widgets: [
      {
        id: 'calendario',
        label: 'Calendario',
        description: 'Eventos desde Google Calendar (vía MALI ONE).',
        path: 'calendario',
        icon: Calendar,
        embedHost: 'educacion.mali.pe',
      },
      {
        id: 'mapa',
        label: 'Mapa de sedes',
        description: 'Contactos, imágenes y ubicaciones en Google Maps.',
        path: 'mapa',
        icon: MapPin,
        embedHost: 'educacion.mali.pe',
      },
      {
        id: 'selector',
        label: 'Selector de sedes',
        description: 'Botón flotante con brochures por sede.',
        path: 'selector',
        icon: MousePointerClick,
        embedHost: 'educacion.mali.pe',
      },
    ],
  },
  biblioteca: {
    id: 'biblioteca',
    title: 'Widgets Biblioteca',
    description: 'Herramientas embebibles en biblioteca.mali.pe',
    basePath: '/admin/widgets/biblioteca',
    widgets: [
      {
        id: 'carrusel',
        label: 'Carrusel Koha',
        description: 'Novedades bibliográficas desde el OPAC.',
        path: 'carrusel',
        icon: Images,
        embedHost: 'biblioteca.mali.pe',
      },
    ],
  },
  museo: {
    id: 'museo',
    title: 'Widgets Museo',
    description: 'Herramientas embebibles en mali.pe/es',
    basePath: '/admin/widgets/museo',
    widgets: [
      {
        id: 'interfaz-sistemas',
        label: 'Interfaz de sistemas',
        description: 'Slideshow de plataformas MALI (contenido estático).',
        path: 'interfaz-sistemas',
        icon: LayoutGrid,
        previewOnly: true,
        embedHost: 'mali.pe/es',
      },
      {
        id: 'membership',
        label: 'Membresías PAM',
        description: 'Planes, beneficios y registros del Programa Amigos del MALI.',
        path: 'membership',
        icon: Heart,
        embedHost: 'mali.pe/es',
      },
    ],
  },
};

export function widgetPath(area: WidgetAreaId, widgetPath: string): string {
  return `${WIDGET_AREAS[area].basePath}/${widgetPath}`;
}
