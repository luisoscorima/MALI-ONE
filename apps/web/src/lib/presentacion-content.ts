import type { ModuleCardAccent } from '@/lib/module-card-accents';

/** Base path for isometric assets under `public/presentacion-assets/`. */
export const PRESENTACION_ASSETS = '/presentacion-assets';
export const PRESENTACION_LOGOS = `${PRESENTACION_ASSETS}/logos`;

export type PresentacionLogo = {
  id: string;
  name: string;
  /** Path under `/presentacion-assets/logos/`. */
  file: string;
  /** Fondo oscuro del asset (mejor sobre chip negro). */
  darkBg?: boolean;
};

export type PresentacionModule = {
  id: string;
  title: string;
  /** Qué resuelve / por qué existe (lenguaje gerencia). */
  description: string;
  /** Filename under `public/presentacion-assets/` (opcional). */
  image?: string;
  accent: ModuleCardAccent;
  /** Herramientas que este módulo reemplaza o articula. */
  replaces?: PresentacionLogo[];
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

const logos = {
  bitly: {
    id: 'bitly',
    name: 'Bitly',
    file: 'bitly.png',
    darkBg: true,
  },
  walink: {
    id: 'walink',
    name: 'WaLink',
    file: 'walink.png',
    darkBg: true,
  },
  qrcodemonkey: {
    id: 'qrcodemonkey',
    name: 'QRCode Monkey',
    file: 'qrcodemonkey.png',
  },
  googleWorkspace: {
    id: 'google-workspace',
    name: 'Google Workspace',
    file: 'google-workspace.jpg',
  },
  awsS3: {
    id: 'aws-s3',
    name: 'Amazon S3',
    file: 'aws-s3.jpg',
  },
  magicInfo: {
    id: 'magic-info',
    name: 'MagicInfo',
    file: 'magic-info.png',
    darkBg: true,
  },
  bsale: {
    id: 'bsale',
    name: 'Bsale',
    file: 'bsale.png',
    darkBg: true,
  },
  mailchimp: {
    id: 'mailchimp',
    name: 'Mailchimp',
    file: 'mailchimp.jpg',
  },
  wordpress: {
    id: 'wordpress',
    name: 'WordPress',
    file: 'wordpress.png',
    darkBg: true,
  },
  koha: {
    id: 'koha',
    name: 'Koha',
    file: 'koha.png',
  },
  vaultwarden: {
    id: 'vaultwarden',
    name: 'Vaultwarden',
    file: 'vaultwarden.jpg',
  },
  maliWhatsapp: {
    id: 'mali-whatsapp',
    name: 'MALI WhatsApp',
    file: 'mali-whatsapp.png',
    darkBg: true,
  },
} as const satisfies Record<string, PresentacionLogo>;

/** Franja visual: herramientas externas que MALI ONE suplanta o centraliza. */
export const presentacionReplacedTools: PresentacionLogo[] = [
  logos.bitly,
  logos.walink,
  logos.qrcodemonkey,
  logos.googleWorkspace,
  logos.awsS3,
  logos.magicInfo,
  logos.bsale,
  logos.mailchimp,
  logos.wordpress,
  logos.koha,
  logos.vaultwarden,
  logos.maliWhatsapp,
];

export const presentacionHero = {
  title: 'MALI ONE',
  subtitle: 'Centralizar el control de las operaciones digitales del MALI',
  lead: 'Hoy el museo opera con muchos sistemas dispersos que no conversan entre sí. MALI ONE conecta esas piezas en un solo lugar: menos herramientas externas, menos costos y más control sobre el contenido y los procesos.',
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

/** Un solo slide de contexto (reemplaza los 3 diagramas anteriores). */
export const presentacionContext = {
  eyebrow: 'Contexto',
  title: 'El ecosistema digital del MALI',
  body: 'Hoy conviven redes, sistemas por área e infraestructura en la nube pero sin una capa operativa única. MALI ONE es esa capa.',
  /** Sustituir por tu imagen consolidada cuando la tengas. */
  image: 'contexto.png',
  points: [
    {
      title: 'Sistemas por área',
      description:
        'Contables, planilla y ventas en plataformas distintas (BDO, Consorcio, AWS, Shopify, Bsale…) sin control operativo unificado.',
    },
    {
      title: 'Red y áreas',
      description:
        'Administración, taller, gerencia y aulas ya comparten infraestructura; MALI ONE aprovecha esa base para centralizar herramientas.',
    },
    {
      title: 'Infraestructura',
      description:
        'De servidores sueltos a contenedores en EC2 y bases en RDS: la base técnica para operar con menos fricción y más control.',
    },
  ],
};

/** @deprecated Conservados por si reutilizas las imágenes sueltas. */
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
        replaces: [logos.bitly, logos.walink, logos.qrcodemonkey],
      },
      {
        id: 'workspace_users',
        title: 'Usuarios Workspace y Auth Google',
        description:
          'Control centralizado y seguro de usuarios: se hereda la seguridad de Google y el acceso es solo para cuentas @mali.pe, con módulos asignables por persona.',
        accent: 'violet',
        replaces: [logos.googleWorkspace],
      },
      {
        id: 's3_manager',
        title: 'Gestor S3',
        description:
          'Almacenamiento centralizado de contenido actual e histórico: backups, multimedia y assets. En desarrollo cercano: imágenes en alta calidad para TMS, Historias, Archi y otros proyectos.',
        accent: 'emerald',
        replaces: [logos.awsS3],
      },
      {
        id: 'screen_cast',
        title: 'Transmisión a pantallas',
        description:
          'Respuesta a fallas y complejidad de MagicInfo (conexión por IPs, servidor local encendido). Solo requiere internet, mantiene caché si se pierde la red y se controla desde PC o celular.',
        accent: 'cyan',
        replaces: [logos.magicInfo],
      },
      {
        id: 'bsale_reports',
        title: 'Reportes Bsale',
        description:
          'El kardex propio de Bsale podía tomar hasta una semana en armarse en Contabilidad. Ahora el kardex consolidado sale en tiempo real en un par de clics.',
        accent: 'emerald',
        replaces: [logos.bsale],
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
        replaces: [logos.mailchimp],
      },
      {
        id: 'crm_pam',
        title: 'CRM PAM',
        description:
          'Contactos, ledger de pagos y envío de boletines en un mismo lugar. Los contactos se centralizan vía MALI WhatsApp para evitar múltiples bases de datos de campañas y comunicaciones.',
        accent: 'violet',
        replaces: [logos.mailchimp, logos.maliWhatsapp],
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
        replaces: [logos.wordpress],
      },
      {
        id: 'widget_biblioteca',
        title: 'Widgets Biblioteca',
        description:
          'Carrusel y piezas embebibles para biblioteca.mali.pe (Koha), sin tocar el CMS para cada ajuste visual.',
        accent: 'blue',
        replaces: [logos.wordpress, logos.koha],
      },
      {
        id: 'widget_museo',
        title: 'Widgets Museo',
        description:
          'Popup e interfaz embebible en mali.pe: cambios rápidos de contenido desde el panel, no desde configuraciones pesadas de WordPress.',
        accent: 'violet',
        replaces: [logos.wordpress],
      },
      {
        id: 'widget_pam',
        title: 'Widget PAM',
        description:
          'Vitrina de planes y beneficios del Programa de Amigos. La gestión de contenido queda en MALI ONE; los pagos se articulan con el CRM PAM.',
        accent: 'rose',
        replaces: [logos.wordpress],
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
        replaces: [logos.vaultwarden],
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
