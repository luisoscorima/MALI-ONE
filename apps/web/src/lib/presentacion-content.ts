import type { ModuleCardAccent } from '@/lib/module-card-accents';

/** Base path for isometric assets under `public/presentacion-assets/`. */
export const PRESENTACION_ASSETS = '/presentacion-assets';

export type PresentacionModule = {
  id: string;
  title: string;
  description: string;
  /** Filename under `public/presentacion-assets/` (e.g. `links.png`). */
  image?: string;
  accent: ModuleCardAccent;
};

export type PresentacionGroup = {
  id: string;
  label: string;
  /** Optional group-level isometric (e.g. `widgets.png`). */
  image?: string;
  modules: PresentacionModule[];
};

export const presentacionHero = {
  title: 'MALI ONE',
  subtitle: 'Sistema de operaciones internas para mali.pe',
  lead: 'Una plataforma centralizada para que el equipo del museo gestione enlaces, contenidos embebidos, CRM, pantallas y herramientas operativas con acceso seguro.',
  /** Optional hero isometric: place as `public/presentacion-assets/hero.png` (or .webp). */
  image: 'hero.png',
};

export const presentacionValueProps = [
  {
    title: 'Operaciones en un solo lugar',
    description:
      'Enlaces, archivos, widgets de sitios públicos, boletines y reportes dejan de estar dispersos en herramientas sueltas.',
  },
  {
    title: 'Acceso con Google Workspace',
    description:
      'Solo cuentas @mali.pe. Cada persona ve únicamente los módulos que la gerencia o el administrador le habilitan.',
  },
  {
    title: 'Presencia digital del museo',
    description:
      'Configuradores para educación, biblioteca, museo y PAM que alimentan los sitios públicos sin tocar código.',
  },
  {
    title: 'Control y trazabilidad',
    description:
      'Estadísticas de enlaces y QR, contactos y envíos, playlists en pantallas y gestión de accesos por módulo.',
  },
] as const;

export const presentacionGroups: PresentacionGroup[] = [
  {
    id: 'operaciones',
    label: 'Operaciones',
    image: 'operaciones.png',
    modules: [
      {
        id: 'links',
        title: 'Enlaces y QR',
        description:
          'Acortar URLs, WhatsApp y archivos; QR personalizable; carga masiva y estadísticas de clics y escaneos.',
        image: 'links.png',
        accent: 'blue',
      },
      {
        id: 'workspace_users',
        title: 'Usuarios Workspace',
        description:
          'Gestión de cuentas Google Workspace del dominio mali.pe desde un panel interno.',
        image: 'workspace-users.png',
        accent: 'violet',
      },
      {
        id: 's3_manager',
        title: 'Gestor S3',
        description:
          'Explorar y administrar archivos en buckets AWS usados por el museo y MALI ONE.',
        image: 's3-manager.png',
        accent: 'emerald',
      },
      {
        id: 'screen_cast',
        title: 'Transmisión a pantallas',
        description:
          'Playlists y monitores para tótems y quioscos en salas y espacios del museo.',
        image: 'screen-cast.png',
        accent: 'cyan',
      },
      {
        id: 'bsale_reports',
        title: 'Reportes Bsale',
        description:
          'Kardex consolidado de stock por almacén y período para seguimiento operativo.',
        image: 'bsale-reports.png',
        accent: 'emerald',
      },
    ],
  },
  {
    id: 'crms',
    label: 'CRM y comunicación',
    image: 'crm.png',
    modules: [
      {
        id: 'newsletters',
        title: 'Boletines',
        description:
          'Editor visual de boletines con URL pública compartible para campañas y novedades.',
        image: 'newsletters.png',
        accent: 'blue',
      },
      {
        id: 'crm_pam',
        title: 'CRM PAM',
        description:
          'Contactos desde WhatsApp, registro de pagos y envío de boletines al programa de amigos.',
        image: 'crm-pam.png',
        accent: 'violet',
      },
    ],
  },
  {
    id: 'widgets',
    label: 'Widgets y sitios públicos',
    image: 'widgets.png',
    modules: [
      {
        id: 'widget_educacion',
        title: 'Widgets Educación',
        description:
          'Mapa, selector de sedes, calendario, aliados y formulario de leads para educacion.mali.pe.',
        image: 'widget-educacion.png',
        accent: 'cyan',
      },
      {
        id: 'widget_biblioteca',
        title: 'Widgets Biblioteca',
        description:
          'Carrusel y piezas embebibles para biblioteca.mali.pe (catálogo Koha).',
        image: 'widget-biblioteca.png',
        accent: 'blue',
      },
      {
        id: 'widget_museo',
        title: 'Widgets Museo',
        description:
          'Popup e interfaz embebible en el sitio principal mali.pe.',
        image: 'widget-museo.png',
        accent: 'violet',
      },
      {
        id: 'widget_pam',
        title: 'Widget PAM',
        description:
          'Vitrina de planes y beneficios del Programa de Amigos del Museo.',
        image: 'widget-pam.png',
        accent: 'rose',
      },
    ],
  },
  {
    id: 'herramientas',
    label: 'Herramientas',
    image: 'herramientas.png',
    modules: [
      {
        id: 'password_vault',
        title: 'Bóveda de contraseñas',
        description:
          'Acceso centralizado a Vaultwarden para credenciales del equipo.',
        image: 'password-vault.png',
        accent: 'amber',
      },
    ],
  },
];

export const presentacionClosing = {
  title: 'Hecho para el equipo MALI',
  description:
    'MALI ONE concentra las operaciones digitales del museo: menos fricción entre áreas, más control sobre lo que se publica y se mide.',
};
