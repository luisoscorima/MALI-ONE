import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import grapesjs, { type Editor } from 'grapesjs';
import newsletterPlugin from 'grapesjs-preset-newsletter';
import es from 'grapesjs/locale/es';
import type { NewsletterBrand } from '@mali-one/shared';
import {
  NEWSLETTER_BRAND_LABELS,
  buildNewsletterBrandFooter,
  buildNewsletterBrandHeader,
  newsletterCopyrightLine,
  wrapNewsletterWithBrandChrome,
} from '@mali-one/shared';
import 'grapesjs/dist/css/grapes.min.css';

export type NewsletterEditorExport = {
  htmlBody: string;
  designJson: string;
};

export type NewsletterEditorHandle = {
  getExport: () => NewsletterEditorExport;
};

/**
 * Brand chrome logos (absolute: required inside email HTML).
 * Served from the web origin because mali-one-files blocks anonymous GetObject
 * despite S3_PUBLIC_READ. Copies also live under s3://mali-one-files/newsletters/brands/.
 */
const BRAND_LOGO_ORIGIN =
  (typeof window !== 'undefined' && window.location?.origin) ||
  'https://dev.mali.pe';

export const NEWSLETTER_BRAND_LOGO_URLS: Record<NewsletterBrand, string> = {
  cursos_arte: `${BRAND_LOGO_ORIGIN}/newsletter-brands/cursos_arte-logo.png`,
  extension_profesional: `${BRAND_LOGO_ORIGIN}/newsletter-brands/extension_profesional-logo.png`,
  museo: `${BRAND_LOGO_ORIGIN}/newsletter-brands/museo-logo.png`,
};

type NewsletterEditorProps = {
  initialDesignJson?: string | null;
  initialHtml?: string | null;
  brand?: NewsletterBrand | null;
  /** Used for “Ver este correo…” when brand chrome is inserted. */
  slug?: string;
  className?: string;
};

function brandAssetsFor(
  brand: NewsletterBrand,
  slug?: string,
): { logoUrl: string; viewInBrowserUrl: string } {
  const logoUrl = NEWSLETTER_BRAND_LOGO_URLS[brand];
  const trimmed = slug?.trim();
  return {
    logoUrl,
    viewInBrowserUrl: trimmed
      ? `${BRAND_LOGO_ORIGIN}/n/${trimmed}`
      : 'https://mali.pe',
  };
}

/** Accents from Mailchimp MALI templates / brand chrome. */
const MALI_PINK = '#e2187d';
const MALI_BLACK = '#111111';
const MALI_BLUE = '#0084ca';
const MALI_TEAL = '#2f9e8f';
const MALI_NAVY = '#1a3d8f';
const IMG_SQ =
  'https://placehold.co/520x520/e8e8e8/999999?text=Imagen';
const IMG_WIDE =
  'https://placehold.co/560x320/e8e8e8/999999?text=Imagen';

const FONT =
  "Arial, Helvetica, 'Helvetica Neue', sans-serif";

function socialSrc(file: string): string {
  return `${BRAND_LOGO_ORIGIN}/newsletter-brands/social/${file}`;
}

function socialLink(href: string, file: string, label: string): string {
  return `<a href="${href}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 5px;text-decoration:none"><img src="${socialSrc(file)}" alt="${label}" width="28" height="28" style="display:block;width:28px;height:28px;border:0" /></a>`;
}

function textCol(title: string, body: string): string {
  return `
<td style="width:50%;padding:14px 18px;vertical-align:top;font-family:${FONT}" width="50%">
  <h2 style="margin:0 0 8px;color:${MALI_BLACK};font-size:17px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;line-height:1.25">${title}</h2>
  <div style="height:2px;width:48px;background:${MALI_PINK};margin:0 0 14px"></div>
  <p style="margin:0 0 16px;color:${MALI_BLACK};font-size:14px;line-height:1.55">${body}</p>
  <p style="margin:0">
    <a href="https://mali.pe" style="color:${MALI_PINK};font-size:13px;font-weight:700;text-decoration:underline;text-transform:uppercase;letter-spacing:0.03em">→ Conoce más aquí</a>
  </p>
</td>`.trim();
}

function imageCol(src: string): string {
  return `
<td style="width:50%;padding:14px 18px;vertical-align:top" width="50%">
  <img src="${src}" alt="" width="260" style="display:block;width:100%;max-width:260px;height:auto;border:0" />
</td>`.trim();
}

function twoCol(left: string, right: string): string {
  return `
<table data-gjs-highlightable="true" style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      ${left}
      ${right}
    </tr>
  </tbody>
</table>`.trim();
}

function colorBanner(opts: {
  bg: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref?: string;
}): string {
  const href = opts.ctaHref ?? 'https://mali.pe';
  return `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:${opts.bg};padding:36px 28px;color:#ffffff">
        <h2 style="margin:0 0 14px;font-size:26px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:#ffffff;line-height:1.2">${opts.title}</h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#ffffff">${opts.body}</p>
        <p style="margin:0">
          <a href="${href}" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">${opts.ctaLabel}</a>
        </p>
      </td>
    </tr>
  </tbody>
</table>`.trim();
}

function ctaBar(opts: {
  bg: string;
  label: string;
  href?: string;
  color?: string;
}): string {
  const href = opts.href ?? 'https://mali.pe';
  const color = opts.color ?? '#ffffff';
  return `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:${opts.bg};padding:16px 20px;text-align:center">
        <a href="${href}" style="color:${color};font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.06em;text-transform:uppercase">${opts.label}</a>
      </td>
    </tr>
  </tbody>
</table>`.trim();
}

const BLOCK_TEXT_LEFT = twoCol(
  textCol(
    'Álbumes de juventud',
    'Texto del bloque. Edita el título, el párrafo y el enlace rosa. Ajusta colores en el panel de estilos.',
  ),
  imageCol(IMG_SQ),
);

const BLOCK_IMAGE_LEFT = twoCol(
  imageCol(IMG_SQ),
  textCol(
    'Colección virtual',
    'Texto del bloque. Puedes invertir imagen y texto arrastrando este u otro bloque.',
  ),
);

const BLOCK_HERO = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="padding:8px 16px 12px">
        <img src="${IMG_WIDE}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0" />
      </td>
    </tr>
    <tr>
      <td style="padding:4px 18px 8px;color:${MALI_BLACK};font-family:${FONT}">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;line-height:1.25">Título de la nota</h2>
        <div style="height:2px;width:48px;background:${MALI_PINK};margin:0 0 12px"></div>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.55">Párrafo bajo la imagen a ancho completo. Edítalo aquí.</p>
        <p style="margin:0 0 12px">
          <a href="https://mali.pe" style="color:${MALI_PINK};font-size:13px;font-weight:700;text-decoration:underline;text-transform:uppercase;letter-spacing:0.03em">→ Conoce más aquí</a>
        </p>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_HEADER = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="padding:10px 16px;text-align:center;font-size:11px;color:#888888;background:#ffffff">
        <a href="https://mali.pe" style="color:#888888;text-decoration:underline">Ver este correo en el navegador</a>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 16px 10px;text-align:left;background:#ffffff">
        <img src="${NEWSLETTER_BRAND_LOGO_URLS.museo}" alt="MALI" width="120" style="display:block;width:120px;max-width:100%;height:auto;border:0" />
      </td>
    </tr>
    <tr>
      <td style="padding:6px 16px 22px;background:#ffffff">
        <h1 style="margin:0;color:${MALI_BLACK};font-size:24px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;line-height:1.2">Edición especial</h1>
        <div style="height:2px;width:56px;background:${MALI_PINK};margin:12px 0 0"></div>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_COLOR_MUSEO = colorBanner({
  bg: MALI_BLUE,
  title: 'Dona al MALI',
  body: 'Tu apoyo sostiene las exposiciones, la biblioteca y los programas educativos del museo.',
  ctaLabel: 'Donar',
  ctaHref: 'https://mali.pe',
});

const BLOCK_COLOR_CURSOS = colorBanner({
  bg: MALI_TEAL,
  title: 'Cursos de Arte',
  body: 'Vive el arte en el MALI. Inicios todos los meses. Vacantes limitadas.',
  ctaLabel: 'Más información',
  ctaHref: 'https://educacion.mali.pe',
});

const BLOCK_COLOR_EP = colorBanner({
  bg: MALI_NAVY,
  title: 'Extensión Profesional',
  body: 'Programas de formación continua para profesionales de la cultura y las artes.',
  ctaLabel: 'Más información',
  ctaHref: 'https://educacion.mali.pe',
});

const BLOCK_CTA_PINK = ctaBar({
  bg: MALI_PINK,
  label: 'Compra tus entradas aquí',
  href: 'https://mali.pe',
});

const BLOCK_CTA_OUTLINE = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:${MALI_BLUE};padding:28px 24px;text-align:center">
        <a href="https://educacion.mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase">Más información</a>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_SOCIAL = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="padding:8px 20px 4px;text-align:center;background:#ffffff;color:${MALI_BLACK};font-size:13px">
        ¡Cuéntanos tu experiencia!
      </td>
    </tr>
    <tr>
      <td style="padding:10px 20px 18px;text-align:center;background:#ffffff">
        ${socialLink('https://www.facebook.com/museodeartedelima', 'facebook.png', 'Facebook')}
        ${socialLink('https://x.com/mali_lima', 'twitter.png', 'X')}
        ${socialLink('https://www.instagram.com/museodeartedelima', 'instagram.png', 'Instagram')}
        ${socialLink('https://www.youtube.com/@museodeartedelima', 'youtube.png', 'YouTube')}
        ${socialLink('https://open.spotify.com', 'spotify.png', 'Spotify')}
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_FOOTER = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="padding:14px 20px;text-align:center;font-size:12px;color:${MALI_BLACK};background:#ffffff;letter-spacing:0.04em">
        <div style="margin:0 0 6px">EXPOSICIONES | BIBLIOTECA | CURSOS | PAM | TIENDA</div>
        <div>ARCHI | VISÍTANOS</div>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 20px 4px;text-align:center;background:#ffffff;color:${MALI_BLACK};font-size:13px">
        ¡Cuéntanos tu experiencia!
      </td>
    </tr>
    <tr>
      <td style="padding:10px 20px 16px;text-align:center;background:#ffffff">
        ${socialLink('https://www.facebook.com/museodeartedelima', 'facebook.png', 'Facebook')}
        ${socialLink('https://x.com/mali_lima', 'twitter.png', 'X')}
        ${socialLink('https://www.instagram.com/museodeartedelima', 'instagram.png', 'Instagram')}
        ${socialLink('https://www.youtube.com/@museodeartedelima', 'youtube.png', 'YouTube')}
        ${socialLink('https://open.spotify.com', 'spotify.png', 'Spotify')}
      </td>
    </tr>
    <tr>
      <td style="padding:0 16px 16px;background:#ffffff">
        <a href="https://mali.pe" style="display:block;background:${MALI_PINK};color:#ffffff;text-decoration:none;text-align:center;padding:14px 18px;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Compra tus entradas aquí</a>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 16px 20px;text-align:center;font-size:11px;color:#888888;background:#ffffff">
        ${newsletterCopyrightLine()}
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_DIVIDER = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="padding:12px 16px">
        <div style="height:1px;background:#dddddd;width:100%"></div>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const MALI_STARTER_HTML = `
<table style="width:100%;background-color:#ffffff;margin:0;padding:0;border-collapse:collapse" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td align="center" style="padding:0">
        <table style="width:600px;max-width:100%;background-color:#ffffff;font-family:${FONT}" width="600" cellspacing="0" cellpadding="0">
          <tbody>
            <tr><td>${BLOCK_HEADER}</td></tr>
            <tr><td>${BLOCK_HERO}</td></tr>
            <tr><td>${BLOCK_TEXT_LEFT}</td></tr>
            <tr><td>${BLOCK_IMAGE_LEFT}</td></tr>
            <tr><td>${BLOCK_CTA_PINK}</td></tr>
            <tr><td>${BLOCK_FOOTER}</td></tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
`.trim();

function registerMaliBlocks(
  editor: Editor,
  brand?: NewsletterBrand | null,
  slug?: string,
) {
  const bm = editor.BlockManager;
  const cat = 'MALI';

  const items: Array<{
    id: string;
    label: string;
    content: string;
    media?: string;
  }> = [
    {
      id: 'mali-header',
      label: 'Cabecera MALI',
      content: BLOCK_HEADER,
      media: `<svg viewBox="0 0 48 24" width="48" height="24"><text x="24" y="16" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">MALI</text></svg>`,
    },
    {
      id: 'mali-hero',
      label: 'Imagen + texto',
      content: BLOCK_HERO,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="18" fill="#ccc"/><rect y="22" width="40" height="3" fill="#999"/><rect y="27" width="28" height="3" fill="#bbb"/></svg>`,
    },
    {
      id: 'mali-text-left',
      label: 'Texto | Imagen',
      content: BLOCK_TEXT_LEFT,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="22" height="28" y="2" fill="#eee" stroke="#999"/><rect x="26" y="2" width="20" height="28" fill="#ccc"/></svg>`,
    },
    {
      id: 'mali-image-left',
      label: 'Imagen | Texto',
      content: BLOCK_IMAGE_LEFT,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="20" height="28" y="2" fill="#ccc"/><rect x="24" y="2" width="22" height="28" fill="#eee" stroke="#999"/></svg>`,
    },
    {
      id: 'mali-color-museo',
      label: 'Color Museo',
      content: BLOCK_COLOR_MUSEO,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="32" fill="${MALI_BLUE}"/><rect x="6" y="10" width="24" height="3" fill="#fff"/><rect x="6" y="16" width="18" height="10" fill="none" stroke="#fff"/></svg>`,
    },
    {
      id: 'mali-color-cursos',
      label: 'Color Cursos',
      content: BLOCK_COLOR_CURSOS,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="32" fill="${MALI_TEAL}"/><rect x="6" y="10" width="24" height="3" fill="#fff"/><rect x="6" y="16" width="18" height="10" fill="none" stroke="#fff"/></svg>`,
    },
    {
      id: 'mali-color-ep',
      label: 'Color Extensión',
      content: BLOCK_COLOR_EP,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="32" fill="${MALI_NAVY}"/><rect x="6" y="10" width="24" height="3" fill="#fff"/><rect x="6" y="16" width="18" height="10" fill="none" stroke="#fff"/></svg>`,
    },
    {
      id: 'mali-cta-pink',
      label: 'CTA Entradas',
      content: BLOCK_CTA_PINK,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect y="10" width="48" height="12" fill="${MALI_PINK}"/><rect x="10" y="14" width="28" height="3" fill="#fff"/></svg>`,
    },
    {
      id: 'mali-cta-outline',
      label: 'CTA Outline',
      content: BLOCK_CTA_OUTLINE,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="32" fill="${MALI_BLUE}"/><rect x="10" y="11" width="28" height="10" fill="none" stroke="#fff"/></svg>`,
    },
    {
      id: 'mali-social',
      label: 'Redes sociales',
      content: BLOCK_SOCIAL,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><circle cx="12" cy="16" r="5" fill="#999"/><circle cx="24" cy="16" r="5" fill="#999"/><circle cx="36" cy="16" r="5" fill="#999"/></svg>`,
    },
    {
      id: 'mali-footer',
      label: 'Pie MALI',
      content: BLOCK_FOOTER,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="10" fill="#eee"/><rect y="12" width="48" height="10" fill="${MALI_PINK}"/><rect y="24" width="48" height="8" fill="#ddd"/></svg>`,
    },
    {
      id: 'mali-divider',
      label: 'Separador',
      content: BLOCK_DIVIDER,
    },
  ];

  if (brand) {
    const assets = brandAssetsFor(brand, slug);
    items.unshift(
      {
        id: `mali-brand-header-${brand}`,
        label: `Header ${NEWSLETTER_BRAND_LABELS[brand]}`,
        content: buildNewsletterBrandHeader(brand, assets),
      },
      {
        id: `mali-brand-footer-${brand}`,
        label: `Footer ${NEWSLETTER_BRAND_LABELS[brand]}`,
        content: buildNewsletterBrandFooter(brand, assets),
      },
    );
  }

  for (const item of items) {
    bm.add(item.id, {
      label: item.label,
      category: cat,
      content: item.content,
      media: item.media,
    });
  }
}

function loadInitialContent(
  editor: Editor,
  designJson?: string | null,
  html?: string | null,
  brand?: NewsletterBrand | null,
  slug?: string,
) {
  if (designJson?.trim()) {
    try {
      editor.loadProjectData(JSON.parse(designJson) as object);
      return;
    } catch {
      // fall through to HTML
    }
  }
  if (html?.trim()) {
    editor.setComponents(html);
    return;
  }
  if (brand) {
    editor.setComponents(
      wrapNewsletterWithBrandChrome(
        `<table style="width:100%;margin:0;padding:0;border-collapse:collapse" width="100%" cellspacing="0" cellpadding="0"><tbody><tr><td style="padding:24px 16px;font-family:${FONT};color:${MALI_BLACK};font-size:14px;line-height:1.55"><p style="margin:0">Escribe aquí el contenido del boletín.</p></td></tr></tbody></table>`,
        brand,
        brandAssetsFor(brand, slug),
      ),
    );
    return;
  }
  editor.setComponents(MALI_STARTER_HTML);
}

export const NewsletterEditor = forwardRef<
  NewsletterEditorHandle,
  NewsletterEditorProps
>(function NewsletterEditor(
  { initialDesignJson, initialHtml, brand = null, slug, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  useImperativeHandle(ref, () => ({
    getExport: () => {
      const editor = editorRef.current;
      if (!editor) {
        return { htmlBody: '', designJson: '{}' };
      }
      let htmlBody = '';
      try {
        const inlined = editor.runCommand('gjs-get-inlined-html');
        htmlBody =
          typeof inlined === 'string'
            ? inlined
            : `${editor.getHtml()}<style>${editor.getCss() ?? ''}</style>`;
      } catch {
        htmlBody = `${editor.getHtml()}<style>${editor.getCss() ?? ''}</style>`;
      }
      return {
        htmlBody,
        designJson: JSON.stringify(editor.getProjectData()),
      };
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      i18n: {
        locale: 'es',
        messages: { es },
      },
      canvas: {
        styles: [],
      },
      deviceManager: {
        devices: [
          { id: 'desktop', name: 'Escritorio', width: '' },
          {
            id: 'mobilePortrait',
            name: 'Móvil',
            width: '320px',
            widthMedia: '480px',
          },
        ],
      },
      plugins: [
        (ed) =>
          newsletterPlugin(ed, {
            modalTitleImport: 'Importar HTML',
            modalTitleExport: 'Exportar HTML',
            modalLabelImport:
              'Pega el HTML completo del boletín y haz clic en Importar (reemplaza todo el lienzo)',
            modalLabelExport: 'Copia el HTML para usarlo donde necesites',
            importPlaceholder: '<table>...</table>',
            cellStyle: {
              'font-size': '14px',
              'font-weight': '300',
              'vertical-align': 'top',
              color: '#333333',
              margin: '0',
              padding: '0',
            },
          }),
      ],
      styleManager: {
        sectors: [
          {
            name: 'Dimensión',
            open: false,
            buildProps: [
              'width',
              'height',
              'max-width',
              'min-height',
              'margin',
              'padding',
            ],
          },
          {
            name: 'Tipografía',
            open: true,
            buildProps: [
              'font-family',
              'font-size',
              'font-weight',
              'letter-spacing',
              'color',
              'line-height',
              'text-align',
              'text-decoration',
            ],
          },
          {
            name: 'Colores y fondo',
            open: true,
            buildProps: [
              'background-color',
              'color',
              'border-radius',
              'border',
              'background',
            ],
          },
        ],
      },
    });

    const panels = editor.Panels;
    // El preset llama setDevice('Desktop'|'Mobile portrait'); re-mapear a Escritorio/Móvil.
    editor.Commands.add('set-device-desktop', {
      run: (ed) => ed.setDevice('Escritorio'),
    });
    editor.Commands.add('set-device-mobile', {
      run: (ed) => ed.setDevice('Móvil'),
    });
    panels.removeButton('devices-c', 'set-device-tablet');
    for (const id of ['gjs-toggle-images', 'canvas-clear'] as const) {
      panels.removeButton('options', id);
    }
    for (const [panel, id, title] of [
      ['devices-c', 'set-device-desktop', 'Escritorio'],
      ['devices-c', 'set-device-mobile', 'Móvil'],
      ['options', 'undo', 'Deshacer'],
      ['options', 'redo', 'Rehacer'],
      ['options', 'sw-visibility', 'Ver bordes'],
      ['options', 'preview', 'Vista previa'],
      ['options', 'fullscreen', 'Pantalla completa'],
      ['options', 'export-template', 'Ver código HTML'],
      [
        'options',
        'gjs-open-import-template',
        'Importar HTML (reemplaza todo el boletín)',
      ],
    ] as const) {
      const btn = panels.getButton(panel, id);
      if (btn) {
        btn.set('attributes', { ...(btn.get('attributes') ?? {}), title });
      }
    }

    registerMaliBlocks(editor, brand, slug);
    loadInitialContent(editor, initialDesignJson, initialHtml, brand, slug);
    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // Remount via `key` when opening another newsletter.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once-per-mount init
  }, []);

  return (
    <div
      className={
        className ??
        'newsletter-gjs overflow-hidden rounded-lg border border-border/60'
      }
      style={{ minHeight: 620, height: 'min(72vh, 820px)' }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
});
