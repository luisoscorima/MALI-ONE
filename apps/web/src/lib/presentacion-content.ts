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
  filezilla: {
    id: 'filezilla',
    name: 'FileZilla',
    file: 'filezilla.png',
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
  logos.filezilla,
];

export const presentacionHero = {
  title: 'MALI ONE',
  subtitle: 'Centralizar el control de las operaciones digitales del MALI',
  lead: 'De servicios dispersos en varios proveedores a una infraestructura consolidada en AWS, con MALI ONE como capa operativa: menos costo recurrente, menos islas y más control.',
};

/** Formatea montos USD de la presentación (siempre con 2 decimales). */
export function formatPresentacionUsd(amount: number): string {
  return `US$ ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type InfraCostRowAntes = {
  provider: string;
  service: string;
  systems: string;
  /** null = misma fila de bloque, sin repetir costo */
  cost: number | null;
  result: string;
};

export type InfraCostRowAhora = {
  status: string;
  provider: string;
  service: string;
  systems: string;
  costCurrent: number;
  action: string;
  costTarget: number;
};

export type InfraCostRowFuturo = {
  provider: string;
  service: string;
  systems: string;
  /** null = incluido en el bloque anterior */
  cost: number | null;
};

export const presentacionCostNote =
  'Los costos corresponden al bloque Infraestructura + Servicio, no a cada sistema por separado. Los US$ 55.76 de MALI ONE WhatsApp son consumo de la API de WhatsApp, no parte del costo de EC2.';

export const presentacionJourney = {
  eyebrow: 'Infraestructura',
  title: 'De lo disperso a lo consolidado',
  body: 'Tres momentos de la misma historia: dónde estábamos, dónde estamos y hacia dónde vamos.',
  stages: [
    {
      id: 'antes',
      label: 'Antes',
      title: 'Servicios dispersos',
      description: 'Varios proveedores, costos fragmentados y poca visibilidad.',
      totalUsd: 3238.84,
    },
    {
      id: 'ahora',
      label: 'Ahora',
      title: 'Migración y consolidación',
      description: 'Transición activa: lo migrado, lo pendiente y lo permanente.',
      totalUsd: 2889.46,
    },
    {
      id: 'futuro',
      label: 'Futuro',
      title: 'AWS + servicios esenciales',
      description: 'Arquitectura objetivo: AWS, Meta WhatsApp API, Shopify y Bsale.',
      totalUsd: 840.2,
    },
  ],
} as const;

/** Tabla condensada: infraestructura descentralizada. */
export const presentacionInfraAntes: InfraCostRowAntes[] = [
  {
    provider: 'AWS',
    service: 'Lightsail',
    systems: 'SIGE 2 + DreamFactory',
    cost: 520.91,
    result: 'Migrado a EC2',
  },
  {
    provider: '',
    service: '',
    systems: 'Web Educación Antigua',
    cost: null,
    result: 'Respaldo y baja',
  },
  {
    provider: '',
    service: '',
    systems: 'Proxy SIGE 2',
    cost: null,
    result: 'Migrado a EC2',
  },
  {
    provider: '',
    service: '',
    systems: 'TMS',
    cost: null,
    result: 'Continúa temporalmente',
  },
  {
    provider: '',
    service: '',
    systems: 'eMuseum / eMuseum2',
    cost: null,
    result: 'Continúa temporalmente',
  },
  {
    provider: 'Google Cloud',
    service: 'App Engine, Cloud SQL y Storage',
    systems: 'Ecosistema Historias',
    cost: 458.0,
    result: 'Migración pendiente',
  },
  {
    provider: 'Linode',
    service: 'Essential Compute',
    systems: 'Koha Antiguo',
    cost: 96.0,
    result: 'Respaldo y baja',
  },
  {
    provider: '',
    service: '',
    systems: 'Koha Biblioteca',
    cost: null,
    result: 'Migrado a AWS',
  },
  {
    provider: '',
    service: '',
    systems: 'Web MALI Antigua',
    cost: null,
    result: 'Respaldo y baja',
  },
  {
    provider: '',
    service: '',
    systems: 'Todos los Faros',
    cost: null,
    result: 'Migrados a AWS',
  },
  {
    provider: 'DreamHost',
    service: 'Hosting, VPS y MySQL',
    systems: 'ARCHI y componentes',
    cost: 59.98,
    result: 'Migración pendiente',
  },
  {
    provider: 'DigitalOcean',
    service: 'VPS',
    systems: 'Archivo MALI y ePPA',
    cost: 48.0,
    result: 'Migración pendiente',
  },
  {
    provider: 'Mailchimp',
    service: 'Plan Premium',
    systems: 'Boletines y mailing',
    cost: 1025.0,
    result: 'Reemplazo en desarrollo',
  },
  {
    provider: 'WhatsApp Business',
    service: 'Difusión tradicional',
    systems: 'PAT',
    cost: 38.07,
    result: 'Reemplazado por MALI ONE',
  },
  {
    provider: 'Bitly',
    service: 'Plan Core',
    systems: 'Enlaces y códigos QR',
    cost: 10.0,
    result: 'Reemplazado por MALI ONE',
  },
  {
    provider: 'MagicInfo',
    service: 'Configuración',
    systems: 'Pantallas de Comunicaciones',
    cost: 299.0,
    result: 'Reemplazado por MALI ONE',
  },
  {
    provider: 'Dropbox',
    service: 'Plan empresarial',
    systems: 'Contenido histórico 2020',
    cost: 290.0,
    result: 'Pendiente de baja',
  },
  {
    provider: 'Shopify',
    service: 'Plan Basic',
    systems: 'Tienda Web',
    cost: 29.0,
    result: 'Se mantiene',
  },
  {
    provider: 'Bsale',
    service: 'Plan Standard',
    systems: 'Tienda Física',
    cost: 76.28,
    result: 'Se mantiene',
  },
  {
    provider: 'Eccom and More',
    service: 'Integración',
    systems: 'Integración Shopify–Bsale',
    cost: 288.6,
    result: 'Implementación concluida',
  },
];

/** Solo servicios que generan costo hoy. */
export const presentacionInfraAhora: InfraCostRowAhora[] = [
  {
    status: 'Optimización',
    provider: 'AWS',
    service: 'Lightsail',
    systems: 'TMS, eMuseum y eMuseum2',
    costCurrent: 478.28,
    action: 'Optimizar y migrar almacenamiento',
    costTarget: 300.0,
  },
  {
    status: 'Migración',
    provider: 'Google Cloud',
    service: 'App Engine, SQL y Storage',
    systems: 'Ecosistema Historias',
    costCurrent: 458.0,
    action: 'Actualizar y migrar a AWS',
    costTarget: 0,
  },
  {
    status: 'Migración',
    provider: 'DreamHost',
    service: 'Hosting, VPS y MySQL',
    systems: 'ARCHI, API, Demo, Test y BD',
    costCurrent: 59.98,
    action: 'Validar y migrar a AWS',
    costTarget: 0,
  },
  {
    status: 'Migración',
    provider: 'DigitalOcean',
    service: 'VPS',
    systems: 'Archivo MALI y ePPA',
    costCurrent: 48.0,
    action: 'Migrar a AWS EC2',
    costTarget: 0,
  },
  {
    status: 'Reemplazo',
    provider: 'Mailchimp',
    service: 'Plan Premium',
    systems: 'Base global, boletines y mailing',
    costCurrent: 1025.0,
    action: 'Migrar a MALI ONE',
    costTarget: 0,
  },
  {
    status: 'Validación',
    provider: 'Dropbox',
    service: 'Plan empresarial',
    systems: 'Contenido histórico 2020',
    costCurrent: 290.0,
    action: 'Validar migración y dar de baja',
    costTarget: 0,
  },
  {
    status: 'Permanente',
    provider: 'Shopify',
    service: 'Plan Basic',
    systems: 'Tienda Web',
    costCurrent: 29.0,
    action: 'Mantener',
    costTarget: 29.0,
  },
  {
    status: 'Permanente',
    provider: 'Bsale',
    service: 'Plan Standard',
    systems: 'Tienda Física',
    costCurrent: 76.28,
    action: 'Mantener',
    costTarget: 76.28,
  },
  {
    status: 'Consolidado',
    provider: 'AWS',
    service: 'EC2',
    systems: 'Aplicaciones institucionales + MALI ONE',
    costCurrent: 298.6,
    action: 'Mantener y monitorear',
    costTarget: 298.6,
  },
  {
    status: 'Permanente',
    provider: 'Meta',
    service: 'WhatsApp Business API',
    systems: 'Consumo API MALI ONE WhatsApp',
    costCurrent: 55.76,
    action: 'Mantener y monitorear',
    costTarget: 55.76,
  },
  {
    status: 'Consolidado',
    provider: 'AWS',
    service: 'RDS',
    systems: 'Bases institucionales',
    costCurrent: 62.06,
    action: 'Mantener y monitorear',
    costTarget: 62.06,
  },
  {
    status: 'Consolidado',
    provider: 'AWS',
    service: 'S3',
    systems: 'Media y respaldos',
    costCurrent: 8.5,
    action: 'Ampliar almacenamiento',
    costTarget: 18.5,
  },
];

/** Arquitectura objetivo (sin servicios que desaparecen). */
export const presentacionInfraFuturo: InfraCostRowFuturo[] = [
  {
    provider: 'AWS',
    service: 'Lightsail',
    systems: 'TMS, eMuseum y eMuseum2 (mientras permanezcan)',
    cost: 300.0,
  },
  {
    provider: 'AWS',
    service: 'EC2',
    systems:
      'SIGE 2, webs, Koha, Faros, MALI ONE (WhatsApp, Links, Pantallas, CRM, etc.)',
    cost: 298.6,
  },
  {
    provider: 'AWS',
    service: 'RDS',
    systems: 'Bases de SIGE, webs, Koha y MALI ONE',
    cost: 62.06,
  },
  {
    provider: 'AWS',
    service: 'S3',
    systems: 'Media, respaldos y almacenamiento migrado',
    cost: 18.5,
  },
  {
    provider: 'Meta',
    service: 'WhatsApp Business API',
    systems: 'Consumo de mensajería MALI ONE WhatsApp',
    cost: 55.76,
  },
  {
    provider: 'Shopify',
    service: 'Plan Basic',
    systems: 'Tienda Web',
    cost: 29.0,
  },
  {
    provider: 'Bsale',
    service: 'Plan Standard',
    systems: 'Tienda Física',
    cost: 76.28,
  },
];

export const presentacionInfraTables = {
  antes: {
    eyebrow: 'Antes',
    title: 'Infraestructura descentralizada',
    body: 'Qué existía, cuánto costaba cada bloque y qué ocurrió con él.',
    totalUsd: 3238.84,
  },
  ahora: {
    eyebrow: 'Ahora',
    title: 'Infraestructura en transición',
    body: 'Solo servicios que generan costo hoy: dónde se gasta y qué falta hacer.',
    totalUsd: 2889.46,
  },
  futuro: {
    eyebrow: 'Futuro',
    title: 'Arquitectura objetivo',
    body: 'Lo que debería quedar: AWS consolidado más los servicios esenciales que se mantienen.',
    totalUsd: 840.2,
  },
} as const;

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
      {
        id: 'files_tms',
        title: 'Archivos TMS',
        description:
          'Solución a FileZilla: los usuarios finales deben cargar archivos al disco de TMS, pero FileZilla es complejo de usar y configurar, y al conectarse por Remote Desktop 3 o 4 usuarios cuelgan el servidor. Archivos TMS nace como gestor web para subir y explorar sin saturar el servidor.',
        accent: 'amber',
        replaces: [logos.filezilla],
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
    'Consolidar en AWS y operar con MALI ONE reduce el costo recurrente, apaga islas de proveedores y deja al museo con control propio sobre contenido, comunicaciones e infraestructura.',
};
