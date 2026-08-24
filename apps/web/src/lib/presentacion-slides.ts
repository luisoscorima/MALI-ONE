import type { ModuleCardAccent } from '@/lib/module-card-accents';
import {
  presentacionClosing,
  presentacionGroups,
  presentacionHero,
  presentacionInfraAhora,
  presentacionInfraAntes,
  presentacionInfraFuturo,
  presentacionInfraTables,
  presentacionJourney,
  presentacionReplacedTools,
  presentacionRoadmap,
  type InfraCostRowAhora,
  type InfraCostRowAntes,
  type InfraCostRowFuturo,
  type PresentacionLogo,
  type PresentacionModule,
} from '@/lib/presentacion-content';

export type SlideKind =
  | 'title'
  | 'tools'
  | 'journey'
  | 'costTable'
  | 'group'
  | 'roadmap'
  | 'closing';

export type CostTableVariant = 'antes' | 'ahora' | 'futuro';

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
  costTableVariant?: CostTableVariant;
  costRowsAntes?: InfraCostRowAntes[];
  costRowsAhora?: InfraCostRowAhora[];
  costRowsFuturo?: InfraCostRowFuturo[];
  costTotalUsd?: number;
};

const operaciones = presentacionGroups.find((g) => g.id === 'operaciones')!;
const crms = presentacionGroups.find((g) => g.id === 'crms')!;
const widgets = presentacionGroups.find((g) => g.id === 'widgets')!;
const herramientas = presentacionGroups.find((g) => g.id === 'herramientas')!;

const modulesRest: PresentacionModule[] = [
  ...crms.modules,
  ...widgets.modules,
  ...herramientas.modules,
];

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
    id: 'journey',
    kind: 'journey',
    navLabel: 'Viaje',
    eyebrow: presentacionJourney.eyebrow,
    title: presentacionJourney.title,
    body: presentacionJourney.body,
  },
  {
    id: 'infra-antes',
    kind: 'costTable',
    navLabel: 'Antes',
    eyebrow: presentacionInfraTables.antes.eyebrow,
    title: presentacionInfraTables.antes.title,
    body: presentacionInfraTables.antes.body,
    costTableVariant: 'antes',
    costRowsAntes: presentacionInfraAntes,
    costTotalUsd: presentacionInfraTables.antes.totalUsd,
  },
  {
    id: 'infra-ahora',
    kind: 'costTable',
    navLabel: 'Ahora',
    eyebrow: presentacionInfraTables.ahora.eyebrow,
    title: presentacionInfraTables.ahora.title,
    body: presentacionInfraTables.ahora.body,
    costTableVariant: 'ahora',
    costRowsAhora: presentacionInfraAhora,
    costTotalUsd: presentacionInfraTables.ahora.totalUsd,
  },
  {
    id: 'infra-futuro',
    kind: 'costTable',
    navLabel: 'Futuro',
    eyebrow: presentacionInfraTables.futuro.eyebrow,
    title: presentacionInfraTables.futuro.title,
    body: presentacionInfraTables.futuro.body,
    costTableVariant: 'futuro',
    costRowsFuturo: presentacionInfraFuturo,
    costTotalUsd: presentacionInfraTables.futuro.totalUsd,
  },
  {
    id: 'tools',
    kind: 'tools',
    navLabel: 'Herramientas',
    eyebrow: 'Producto',
    title: 'Herramientas que MALI ONE reemplaza o centraliza',
    body: 'Suscripciones y plataformas sueltas. El objetivo: un solo panel, menos costo y más control.',
    logos: presentacionReplacedTools,
  },
  {
    id: 'group-operaciones',
    kind: 'group',
    navLabel: operaciones.label,
    eyebrow: 'Módulos',
    title: operaciones.label,
    groupSummary: operaciones.summary,
    modules: operaciones.modules,
  },
  {
    id: 'group-resto',
    kind: 'group',
    navLabel: 'CRM y más',
    eyebrow: 'Módulos',
    title: 'CRM, widgets y herramientas',
    groupSummary:
      'Comunicación, sitios públicos y adopción interna: lo que completa el panel operativo.',
    modules: modulesRest,
  },
  {
    id: 'roadmap',
    kind: 'roadmap',
    navLabel: 'Roadmap',
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
