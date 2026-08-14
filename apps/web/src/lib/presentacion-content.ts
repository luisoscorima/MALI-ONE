import type { ModuleCardAccent } from '@/lib/module-card-accents';

/** Base path for isometric assets under `public/presentacion-assets/`. */
export const PRESENTACION_ASSETS = '/presentacion-assets';

export type PresentacionModule = {
  id: string;
  title: string;
  /** Qué resuelve / por qué existe (lenguaje gerencia). */
  description: string;
  /** Filename under `public/presentacion-assets/` (opcional). */
  image?: string;
  accent: ModuleCardAccent;
};

export type PresentacionGroup = {
  id: string;
  label: string;
  summary?: string;
  image?: string;
  modules: PresentacionModule[];
};

export type PresentacionDiagram = {
  id: string;
  title: string;
  caption: string;
  image: string;
};

export const presentacionHero = {
  title: 'MALI ONE',
  subtitle: 'Centralizar el control de las operaciones digitales del MALI',
  lead: 'Hoy el museo opera con muchos sistemas dispersos que no conversan entre sí. MALI ONE conecta esas piezas en un solo lugar: menos herramientas externas, menos costos y más control sobre el contenido y los procesos.',
  image: 'infra-antes-vs-ahora.png',
};

export const presentacionValueProps = [
  {
    title: 'De lo disperso a lo centralizado',
    description:
      'Bitly, WaLink, QRCodeMonkey, Mailchimp, MagicInfo y otras herramientas sueltas dejan de ser islas. MALI ONE las reemplaza o las articula desde un panel único.',
  },
  {
    title: 'Acceso seguro @mali.pe',
    description:
      'Auth con Google Workspace: solo el dominio mali.pe, seguridad heredada de Google y permisos por módulo según cada persona.',
  },
  {
    title: 'Un almacenamiento para el museo',
    description:
      'S3 concentra backups, multimedia y assets actuales e históricos; a futuro, imágenes en alta calidad para TMS, Historias, Archi y más.',
  },
  {
    title: 'Menos costo, más velocidad',
    description:
      'Menos suscripciones externas y menos dependencias frágiles. Cambios de contenido y reportes en minutos, no en días o semanas.',
  },
] as const;

/** Diagramas isométricos para la narrativa “antes → centralización”. */
export const presentacionDiagrams: PresentacionDiagram[] = [
  {
    id: 'sistemas',
    title: 'Sistemas actuales por área',
    caption:
      'Contables, planilla y ventas viven en plataformas distintas (BDO, Consorcio, AWS, Shopify, Bsale…) conectadas al cloud, pero sin un control operativo unificado.',
    image: 'sistemas-dispersos.png',
  },
  {
    id: 'red',
    title: 'Red y áreas del MALI',
    caption:
      'Administración, taller, gerencia y aulas ya comparten infraestructura. MALI ONE aprovecha esa base para centralizar herramientas y contenidos.',
    image: 'red-areas.png',
  },
  {
    id: 'infra',
    title: 'Infraestructura: antes vs ahora',
    caption:
      'De servidores sueltos y costos fragmentados a contenedores en EC2 y bases en RDS: una base técnica para operar MALI ONE con control y menor fricción.',
    image: 'infra-antes-vs-ahora.png',
  },
];

export const presentacionGroups: PresentacionGroup[] = [
  {
    id: 'operaciones',
    label: 'Operaciones',
    summary:
      'Reemplazan o reducen dependencias externas costosas o frágiles, con control propio del museo.',
    modules: [
      {
        id: 'links',
        title: 'Enlaces y QR',
        description:
          'Nace del uso y el pago a Bitly, WaLink y QRCodeMonkey. Reduce costos y recupera el control sobre enlaces, WhatsApp, archivos y QR con estadísticas propias.',
        accent: 'blue',
      },
      {
        id: 'workspace_users',
        title: 'Usuarios Workspace y Auth Google',
        description:
          'Control centralizado y seguro de usuarios: se hereda la seguridad de Google y el acceso es solo para cuentas @mali.pe, con módulos asignables por persona.',
        accent: 'violet',
      },
      {
        id: 's3_manager',
        title: 'Gestor S3',
        description:
          'Almacenamiento centralizado de contenido actual e histórico: backups, multimedia y assets. En desarrollo cercano: imágenes en alta calidad para TMS, Historias, Archi y otros proyectos.',
        accent: 'emerald',
      },
      {
        id: 'screen_cast',
        title: 'Transmisión a pantallas',
        description:
          'Respuesta a fallas y complejidad de MagicInfo (conexión por IPs, servidor local encendido). Solo requiere internet, mantiene caché si se pierde la red y se controla desde PC o celular.',
        accent: 'cyan',
      },
      {
        id: 'bsale_reports',
        title: 'Reportes Bsale',
        description:
          'El kardex propio de Bsale podía tomar hasta una semana en armarse en Contabilidad. Ahora el kardex consolidado sale en tiempo real en un par de clics.',
        accent: 'emerald',
      },
    ],
  },
  {
    id: 'crms',
    label: 'CRM y comunicación',
    summary:
      'Sustituye el uso costoso de Mailchimp como CRM, editor de boletines y mailing, y centraliza contactos con MALI WhatsApp.',
    modules: [
      {
        id: 'newsletters',
        title: 'Boletines',
        description:
          'Editor y URLs públicas de boletines desde MALI ONE, sin depender de Mailchimp para crear y publicar piezas de comunicación.',
        accent: 'blue',
      },
      {
        id: 'crm_pam',
        title: 'CRM PAM',
        description:
          'Contactos, ledger de pagos y envío de boletines en un mismo lugar. Los contactos se centralizan vía MALI WhatsApp para evitar múltiples bases de datos de campañas y comunicaciones.',
        accent: 'violet',
      },
    ],
  },
  {
    id: 'widgets',
    label: 'Widgets y sitios públicos',
    summary:
      'Soluciones para WordPress y Koha: cambios de color, enlace o imagen sin la curva tediosa (y a veces desarrollo) de WordPress.',
    modules: [
      {
        id: 'widget_educacion',
        title: 'Widgets Educación',
        description:
          'Mapa, selector, calendario, aliados y formulario de leads para educacion.mali.pe, gestionados de forma intuitiva desde MALI ONE.',
        accent: 'cyan',
      },
      {
        id: 'widget_biblioteca',
        title: 'Widgets Biblioteca',
        description:
          'Carrusel y piezas embebibles para biblioteca.mali.pe (Koha), sin tocar el CMS para cada ajuste visual.',
        accent: 'blue',
      },
      {
        id: 'widget_museo',
        title: 'Widgets Museo',
        description:
          'Popup e interfaz embebible en mali.pe: cambios rápidos de contenido desde el panel, no desde configuraciones pesadas de WordPress.',
        accent: 'violet',
      },
      {
        id: 'widget_pam',
        title: 'Widget PAM',
        description:
          'Vitrina de planes y beneficios del Programa de Amigos. La gestión de contenido queda en MALI ONE; los pagos se articulan con el CRM PAM.',
        accent: 'rose',
      },
    ],
  },
  {
    id: 'herramientas',
    label: 'Herramientas',
    summary: 'Infraestructura ya instalada; el siguiente paso es la adopción del equipo.',
    modules: [
      {
        id: 'password_vault',
        title: 'Bóveda de contraseñas',
        description:
          'Enlace a Vaultwarden, ya instalado y configurado. Centraliza credenciales del equipo; falta principalmente la adopción interna.',
        accent: 'amber',
      },
    ],
  },
];

export const presentacionRoadmap = {
  title: 'Integraciones a futuro',
  items: [
    {
      title: 'SIGE — matrículas y gestión',
      description:
        'Conectar el sistema de matrículas y gestión educativa (SIGE) con el ecosistema MALI ONE.',
    },
    {
      title: 'Mercado Pago en CRM PAM',
      description:
        'Pasarela de pagos Mercado Pago para el CRM PAM (hoy el ledger de pagos opera de forma manual).',
    },
  ],
};

export const presentacionClosing = {
  title: 'Un solo lugar para operar',
  description:
    'MALI ONE no es otra herramienta suelta: es la capa que concentra control, reduce costos de terceros y hace que los sistemas del museo conversen entre sí.',
};
