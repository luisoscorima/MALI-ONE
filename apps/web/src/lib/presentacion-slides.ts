import type { ModuleCardAccent } from '@/lib/module-card-accents';
import {
  presentacionClosing,
  presentacionDiagrams,
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
  | 'diagram'
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
    eyebrow: 'Presentación a gerencia',
    title: presentacionHero.title,
    subtitle: presentacionHero.subtitle,
    body: presentacionHero.lead,
  },
  {
    id: 'tools',
    kind: 'tools',
    navLabel: 'Herramientas',
    eyebrow: 'Antes',
    title: 'Herramientas que MALI ONE suplanta o centraliza',
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
  ...presentacionDiagrams.map(
    (diagram): PresentacionSlide => ({
      id: `diagram-${diagram.id}`,
      kind: 'diagram',
      navLabel: diagram.title,
      eyebrow: 'Contexto',
      title: diagram.title,
      caption: diagram.caption,
      image: diagram.image,
    }),
  ),
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
