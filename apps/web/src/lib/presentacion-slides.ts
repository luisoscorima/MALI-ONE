import type { ModuleCardAccent } from '@/lib/module-card-accents';
import {
  presentacionClosing,
  presentacionContext,
  presentacionGroups,
  presentacionHero,
  presentacionReplacedTools,
  presentacionRoadmap,
  presentacionValueProps,
  type PresentacionLogo,
  type PresentacionModule,
} from '@/lib/presentacion-content';

export type SlideKind =
  | 'title'
  | 'tools'
  | 'values'
  | 'context'
  | 'group'
  | 'roadmap'
  | 'closing';

export type PresentacionSlide = {
  id: string;
  kind: SlideKind;
  /** Título corto para el índice / aria. */
  navLabel: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  body?: string;
  caption?: string;
  image?: string;
  values?: readonly { title: string; description: string }[];
  points?: readonly { title: string; description: string }[];
  logos?: PresentacionLogo[];
  modules?: PresentacionModule[];
  groupSummary?: string;
  roadmapItems?: { title: string; description: string }[];
  accent?: ModuleCardAccent;
};

export const presentacionSlides: PresentacionSlide[] = [
  {
    id: 'title',
    kind: 'title',
    navLabel: 'Portada',
    eyebrow: 'Todo en un solo lugar',
    title: presentacionHero.title,
    subtitle: presentacionHero.subtitle,
    body: presentacionHero.lead,
  },
  {
    id: 'tools',
    kind: 'tools',
    navLabel: 'Herramientas',
    eyebrow: 'Antes',
    title: 'Herramientas que MALI ONE reemplaza o centraliza',
    body: 'Suscripciones y plataformas sueltas. El objetivo: un solo panel, menos costo y más control.',
    logos: presentacionReplacedTools,
  },
  {
    id: 'values',
    kind: 'values',
    navLabel: 'Por qué',
    eyebrow: 'El problema y la respuesta',
    title: 'Por qué centralizar con MALI ONE',
    values: presentacionValueProps,
  },
  {
    id: 'context',
    kind: 'context',
    navLabel: 'Contexto',
    eyebrow: presentacionContext.eyebrow,
    title: presentacionContext.title,
    body: presentacionContext.body,
    image: presentacionContext.image,
    points: presentacionContext.points,
  },
  ...presentacionGroups.map(
    (group): PresentacionSlide => ({
      id: `group-${group.id}`,
      kind: 'group',
      navLabel: group.label,
      eyebrow: 'Módulos',
      title: group.label,
      groupSummary: group.summary,
      modules: group.modules,
    }),
  ),
  {
    id: 'roadmap',
    kind: 'roadmap',
    navLabel: 'Futuro',
    eyebrow: 'Próximos pasos',
    title: presentacionRoadmap.title,
    roadmapItems: presentacionRoadmap.items,
  },
  {
    id: 'closing',
    kind: 'closing',
    navLabel: 'Cierre',
    title: presentacionClosing.title,
    body: presentacionClosing.description,
  },
];
