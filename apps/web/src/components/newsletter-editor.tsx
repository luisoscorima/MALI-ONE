import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import grapesjs, { type Component, type Editor } from 'grapesjs';
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
import { toast } from 'sonner';
import { ApiRequestError, api } from '@/lib/api';
import { Button, Input, Label } from '@/components/ui';
import { normalizeNewsletterLink, type NewsletterEditorExport } from '@/lib/newsletter-content';
import 'grapesjs/dist/css/grapes.min.css';

export const NEWSLETTER_FIRST_NAME_MERGE_TAG = '{{first_name}}';
export const NEWSLETTER_LAST_NAME_MERGE_TAG = '{{last_name}}';

export type NewsletterEditorHandle = {
  getExport: () => NewsletterEditorExport;
  hasPendingUploads: () => boolean;
  /** Inserts {{first_name}} at the caret, into the selection, or as a greeting block. */
  insertFirstNameMergeTag: () => boolean;
  insertNameMergeTag: (tag: string) => boolean;
};

function componentTag(component: Component): string {
  return String(component.get('tagName') ?? '').toLowerCase();
}

function isTextLikeComponent(component: Component): boolean {
  const type = String(component.get('type') ?? '');
  if (type === 'text' || type === 'textnode' || type === 'link') return true;
  const tag = componentTag(component);
  if (['img', 'table', 'tbody', 'thead', 'tr', 'colgroup', 'col', 'br', 'hr'].includes(tag)) {
    return false;
  }
  return ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'li', 'label', 'td', 'th'].includes(tag)
    || Boolean(component.get('editable'));
}

function findTextInsertTarget(component: Component): Component | undefined {
  if (isTextLikeComponent(component)) return component;
  const byType = component.findType('text');
  if (byType.length) return byType[0];
  for (const selector of ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'a', 'td'] as const) {
    const matches = component.find(selector);
    const hit = matches.find((item) => isTextLikeComponent(item));
    if (hit) return hit;
  }
  return undefined;
}

function insertNameMergeTag(editor: Editor, tag = NEWSLETTER_FIRST_NAME_MERGE_TAG): boolean {
  const frame = editor.Canvas.getFrameEl();
  const doc = frame?.contentDocument;
  if (doc) {
    const active = doc.activeElement as HTMLElement | null;
    if (active?.isContentEditable) {
      const ok = doc.execCommand('insertText', false, tag);
      if (ok) return true;
    }
  }

  const selected = editor.getSelected();
  if (selected) {
    const target = findTextInsertTarget(selected);
    if (target) {
      target.append(`<span>${tag}</span>`);
      return true;
    }
  }

  const wrapper = editor.getWrapper();
  if (!wrapper) return false;
  const fallback = findTextInsertTarget(wrapper);
  if (fallback) {
    fallback.append(`<span>${tag}</span>`);
    return true;
  }
  return false;
}

/**
 * Brand chrome logos (absolute: required inside email HTML).
 * These bundled files keep a stable web URL. Copies also live in the newsletter S3 prefix.
 */
const BRAND_LOGO_ORIGIN =
  (typeof window !== 'undefined' && window.location?.origin) ||
  'https://dev.mali.pe';

/** Bump when replacing files under /newsletter-brands/ so email HTML and the canvas skip stale CDN/browser caches. */
const BRAND_ASSET_VERSION = '20261118-cursos-lila';

export const NEWSLETTER_BRAND_LOGO_URLS: Record<NewsletterBrand, string> = {
  cursos_arte: `${BRAND_LOGO_ORIGIN}/newsletter-brands/cursos_arte-logo.png?v=${BRAND_ASSET_VERSION}`,
  extension_profesional: `${BRAND_LOGO_ORIGIN}/newsletter-brands/extension_profesional-logo.png?v=${BRAND_ASSET_VERSION}`,
  museo: `${BRAND_LOGO_ORIGIN}/newsletter-brands/museo-logo.png?v=${BRAND_ASSET_VERSION}`,
};

type NewsletterEditorProps = {
  initialDesignJson?: string | null;
  initialHtml?: string | null;
  brand?: NewsletterBrand | null;
  /** S3 key scope under newsletters/{scope}/… (content id, slug, or library). */
  assetScope?: string;
  /** When true (default), show the URL field for the selected button/link. */
  editLinks?: boolean;
  className?: string;
};

const PRESET_BLOCK_LABELS: Record<string, string> = {
  sect100: 'Sección 1',
  sect50: 'Sección 1/2',
  text: 'Texto',
  image: 'Imagen',
  link: 'Enlace',
  divider: 'Separador básico',
};

function getSelectedLink(editor: Editor): Component | undefined {
  const selected = editor.getSelected();
  if (!selected || selected === editor.getWrapper()) return;
  for (let parent: Component | undefined = selected; parent; parent = parent.parent()) {
    if (parent.get('tagName') === 'a') return parent;
  }
  const links = selected.find('a');
  if (links.length === 1) return links[0];
}

function linkDestination(component: Component): string {
  const href = component.getAttributes().href;
  return typeof href === 'string' && href !== '#' ? href : '';
}

function brandAssetsFor(brand: NewsletterBrand): { logoUrl: string } {
  return { logoUrl: NEWSLETTER_BRAND_LOGO_URLS[brand] };
}

/** Accents from Mailchimp MALI templates / brand chrome. */
const MALI_PINK = '#e2187d';
const MALI_BLACK = '#111111';
const MALI_BLUE = '#0084ca';
const MALI_TEAL = '#63277f';
const MALI_NAVY = '#1a3d8f';
const IMG_SQ =
  'https://placehold.co/520x520/e8e8e8/999999?text=Imagen';
const IMG_WIDE =
  'https://placehold.co/560x320/e8e8e8/999999?text=Imagen';

const FONT =
  "Arial, Helvetica, 'Helvetica Neue', sans-serif";

const TYPOGRAPHY_SECTOR = 'mali-typography';

type LocaleTree = { [key: string]: string | LocaleTree };

function mergeLocale(base: LocaleTree, extra: LocaleTree): LocaleTree {
  const out: LocaleTree = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    out[key] = typeof value === 'object' && typeof current === 'object'
      ? mergeLocale(current, value)
      : value;
  }
  return out;
}

const SIDES = { top: 'Arriba', right: 'Derecha', bottom: 'Abajo', left: 'Izquierda' } as const;

/**
 * GrapesJS resolves labels/titles from i18n before `name`/`attributes.title`,
 * so every visible string must live here.
 */
const MALI_EDITOR_LOCALE = mergeLocale(es as LocaleTree, {
  panels: {
    buttons: {
      titles: {
        'set-device-desktop': 'Escritorio',
        'set-device-mobile': 'Móvil',
        undo: 'Deshacer',
        redo: 'Rehacer',
        'sw-visibility': 'Ver bordes',
        preview: 'Vista previa',
        fullscreen: 'Pantalla completa',
        'export-template': 'Ver código HTML',
        'gjs-open-import-template': 'Importar HTML (reemplaza todo el boletín)',
        'insert-merge-first-name': `Insertar ${NEWSLETTER_FIRST_NAME_MERGE_TAG} (nombre del contacto)`,
        'insert-merge-last-name': `Insertar ${NEWSLETTER_LAST_NAME_MERGE_TAG} (apellidos del contacto)`,
        'open-sm': 'Estilos',
        'open-tm': 'Ajustes',
        'open-layers': 'Capas',
        'open-blocks': 'Bloques',
      },
    },
  },
  styleManager: {
    properties: {
      width: 'Ancho',
      height: 'Alto',
      'max-width': 'Ancho máximo',
      'min-height': 'Alto mínimo',
      margin: 'Margen',
      ...Object.fromEntries(Object.entries(SIDES).map(([side, label]) => [`margin-${side}`, label])),
      padding: 'Relleno',
      ...Object.fromEntries(Object.entries(SIDES).map(([side, label]) => [`padding-${side}`, label])),
      'font-family': 'Fuente',
      'font-size': 'Tamaño',
      'font-weight': 'Peso',
      'letter-spacing': 'Espaciado',
      color: 'Color de texto',
      'line-height': 'Interlineado',
      'text-align': 'Alineación',
      'text-decoration': 'Decoración',
      'font-style': 'Estilo',
      'background-color': 'Fondo',
      'border-radius': 'Esquinas redondeadas',
      'border-top-left-radius': 'Sup. izquierda',
      'border-top-right-radius': 'Sup. derecha',
      'border-bottom-right-radius': 'Inf. derecha',
      'border-bottom-left-radius': 'Inf. izquierda',
      border: 'Borde',
      'border-width': 'Grosor',
      'border-style': 'Estilo de borde',
      'border-color': 'Color de borde',
    },
    options: {
      'font-weight': {
        100: 'Fina',
        200: 'Extra fina',
        300: 'Ligera',
        400: 'Normal',
        500: 'Media',
        600: 'Seminegrita',
        700: 'Negrita',
        800: 'Extra negrita',
        900: 'Ultra negrita',
      },
      'border-style': {
        none: 'Ninguno',
        solid: 'Sólido',
        dotted: 'Punteado',
        dashed: 'Discontinuo',
        double: 'Doble',
        groove: 'Ranurado',
        ridge: 'Relieve',
        inset: 'Hundido',
        outset: 'Resaltado',
      },
      'text-align': { left: 'Izq.', center: 'Centro', right: 'Der.', justify: 'Justificar' },
      'text-decoration': { none: 'Ninguna', underline: 'Subrayado', 'line-through': 'Tachado' },
      'font-style': { normal: 'Normal', italic: 'Cursiva' },
    },
  },
});

/** Compare CSS font stacks ignoring quote/spacing differences from computed styles. */
function normalizeFontFamily(value: string): string {
  return value
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function showEffectiveTypography(editor: Editor, container: HTMLElement) {
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const selected = editor.getSelected();
      const element = selected?.getEl();
      const view = element?.ownerDocument.defaultView;
      const computed = element && view?.getComputedStyle(element);
      const parent = element?.parentElement && view?.getComputedStyle(element.parentElement);
      const styles = selected?.getStyle();
      const controls = editor.StyleManager.getSector(TYPOGRAPHY_SECTOR)?.getProperties();

      for (const property of ['font-family', 'font-size'] as const) {
        const field = container.querySelector<HTMLElement>(`.gjs-sm-property__${property}`);
        if (!field) continue;
        let hint = field.querySelector<HTMLElement>('[data-mali-effective-style]');
        const value = computed?.getPropertyValue(property)?.trim();
        if (!value) {
          hint?.remove();
          continue;
        }
        const control = controls?.find((item) => item.getName() === property);
        const directStyle = styles?.[property];
        const own = Boolean(directStyle || control?.hasValue({ noParent: true }));
        const inherited = !own && parent?.getPropertyValue(property) === value;
        if (!hint) {
          hint = document.createElement('div');
          hint.dataset.maliEffectiveStyle = '';
          hint.className = 'mt-1 break-words text-[11px] leading-tight opacity-80';
          field.append(hint);
        }
        hint.textContent = `${value} · ${own ? 'Aplicado' : inherited ? 'Heredado' : 'Valor efectivo'}`;

        if (property === 'font-size') {
          const input = field.querySelector<HTMLInputElement>('input');
          if (input) input.placeholder = value;
          continue;
        }

        const select = field.querySelector<HTMLSelectElement>('select');
        if (!select) continue;
        select.querySelector('option[data-mali-effective-font]')?.remove();
        // Prefer the authored stack when present; otherwise show the computed/effective one.
        const target = directStyle || control?.getValue({ noDefault: true });
        const display = own && typeof target === 'string' && target ? target : value;
        const normalizedDisplay = normalizeFontFamily(display);
        const matched = [...select.options].find(
          (option) => normalizeFontFamily(option.value) === normalizedDisplay,
        );
        if (matched) {
          select.value = matched.value;
        } else {
          const option = new Option(display, display);
          option.dataset.maliEffectiveFont = '';
          select.add(option);
          select.value = display;
        }
      }
    });
  };
  const events = 'component:selected component:deselected component:styleUpdate style:target style:property:update device:select run:open-sm canvas:frame:load:body';
  editor.on(events, update);
  update();
  return () => {
    cancelAnimationFrame(frame);
    editor.off(events, update);
  };
}

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
    const assets = brandAssetsFor(brand);
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
        brandAssetsFor(brand),
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
  {
    initialDesignJson,
    initialHtml,
    brand = null,
    assetScope = 'library',
    editLinks = true,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const assetScopeRef = useRef(assetScope);
  const [assetLimit, setAssetLimit] = useState<number | null>(null);
  const assetLimitRef = useRef<number | null>(null);
  const pendingUploads = useRef(0);
  const [uploading, setUploading] = useState(false);
  const linkInputId = useId();
  const [linkComponent, setLinkComponent] = useState<Component>();
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  assetScopeRef.current = assetScope;

  useEffect(() => {
    let active = true;
    void api.getNewsletterAssetLimits().then(({ maxBytes }) => {
      if (!active) return;
      assetLimitRef.current = maxBytes;
      setAssetLimit(maxBytes);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function applyLink(): boolean {
    if (!linkComponent) return true;
    const destination = normalizeNewsletterLink(linkValue);
    if (!destination) {
      setLinkError('Escribe una URL, un enlace mailto: o un enlace tel: válido.');
      return false;
    }
    linkComponent.addAttributes({ href: destination });
    setLinkValue(destination);
    setLinkError('');
    return true;
  }

  useImperativeHandle(ref, () => ({
    hasPendingUploads: () => pendingUploads.current > 0,
    getExport: () => {
      const editor = editorRef.current;
      if (!editor) {
        return { htmlBody: '', designJson: '{}' };
      }
      if (linkComponent && linkValue !== linkDestination(linkComponent) && !applyLink()) {
        throw new Error('Corrige la URL del botón antes de guardar.');
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
    insertFirstNameMergeTag: () => {
      const editor = editorRef.current;
      if (!editor) return false;
      return insertNameMergeTag(editor);
    },
    insertNameMergeTag: (tag) => Boolean(editorRef.current && insertNameMergeTag(editorRef.current, tag)),
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    let active = true;
    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      i18n: {
        locale: 'es',
        localeFallback: 'es',
        detectLocale: false,
        messages: { es: MALI_EDITOR_LOCALE },
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
      assetManager: {
        embedAsBase64: false,
        upload: false,
        autoAdd: true,
        uploadFile: async function uploadNewsletterFiles(
          ev: {
            dataTransfer?: DataTransfer | null;
            target?: EventTarget | null;
          },
          clb?: (response: { data: Array<string | { src: string }> }) => void,
        ) {
          const input = ev.target instanceof HTMLInputElement ? ev.target : null;
          const files = Array.from(ev.dataTransfer?.files ?? input?.files ?? []);
          if (input) input.value = '';
          if (!files.length) return;
          let firstSrc: string | undefined;
          pendingUploads.current++;
          setUploading(true);
          try {
            for (const file of files) {
              if (!active) return;
              try {
                const maxBytes = assetLimitRef.current;
                if (maxBytes && file.size > maxBytes) {
                  throw new Error(`Cada imagen admite hasta ${maxBytes / (1024 * 1024)} MB.`);
                }
                const uploaded = await api.uploadNewsletterAsset(file, assetScopeRef.current);
                if (!active) return;
                editor.AssetManager.add({
                  src: uploaded.url,
                  name: uploaded.fileName,
                  type: 'image',
                  width: uploaded.width ?? 0,
                  height: uploaded.height ?? 0,
                });
                firstSrc ??= uploaded.url;
              } catch (error) {
                if (!active) return;
                const message = error instanceof ApiRequestError && error.status === 413
                  ? 'La imagen supera el límite de carga del servidor.'
                  : error instanceof Error ? error.message : 'No se pudo subir la imagen.';
                toast.error(`${file.name} · ${message}`);
              }
            }

            if (firstSrc && typeof clb === 'function') {
              clb({ data: [firstSrc] });
            }

            // The picker still contains the uploaded assets if auto-selection is unavailable.
            try {
              const select = (
                editor.AssetManager as {
                  __getBehaviour?: () => {
                    select?: (asset: unknown, complete: boolean) => void;
                  };
                }
              ).__getBehaviour?.()?.select;
              if (typeof select === 'function' && firstSrc) {
                const match = editor.AssetManager.get(firstSrc);
                if (match) select(match, true);
              }
            } catch {
              // Selection is optional after the upload.
            }
          } finally {
            pendingUploads.current--;
            if (active && !pendingUploads.current) setUploading(false);
          }
        },
        // GrapesJS runtime supports this; typings omit it.
        ...({ disableUpload: false } as Record<string, unknown>),
      },
      plugins: [
        (ed) =>
          newsletterPlugin(ed, {
            updateStyleManager: false,
            blocks: ['sect100', 'sect50', 'text', 'image', 'link', 'divider'],
            block: (blockId) => ({
              label: PRESET_BLOCK_LABELS[blockId] ?? blockId,
              category: 'Básico',
              attributes: { title: PRESET_BLOCK_LABELS[blockId] ?? blockId },
            }),
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
            id: TYPOGRAPHY_SECTOR,
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
              'font-style',
            ],
            properties: [
              {
                property: 'font-family',
                name: 'Fuente',
                type: 'select',
                default: FONT,
                options: [
                  { id: FONT, label: 'Arial / Helvetica (MALI)' },
                  { id: 'Arial, Helvetica, sans-serif', label: 'Arial' },
                  { id: 'Helvetica, sans-serif', label: 'Helvetica' },
                  { id: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: 'Helvetica Neue' },
                  { id: 'Georgia, serif', label: 'Georgia' },
                  { id: 'Times New Roman, Times, serif', label: 'Times New Roman' },
                  { id: 'Courier New, Courier, monospace', label: 'Courier New' },
                  { id: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
                  { id: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
                  { id: 'Trebuchet MS, Helvetica, sans-serif', label: 'Trebuchet MS' },
                ],
              },
              {
                property: 'line-height',
                type: 'number',
                units: ['', 'px', 'em', '%'],
                unit: '',
                default: 'normal',
              },
              {
                property: 'text-align',
                type: 'radio',
                default: 'left',
                options: [
                  { id: 'left', label: 'Izq.' },
                  { id: 'center', label: 'Centro' },
                  { id: 'right', label: 'Der.' },
                  { id: 'justify', label: 'Justificar' },
                ],
              },
              {
                property: 'text-decoration',
                type: 'radio',
                default: 'none',
                options: [
                  { id: 'none', label: 'Ninguna' },
                  { id: 'underline', label: 'Subrayado' },
                  { id: 'line-through', label: 'Tachado' },
                ],
              },
              {
                property: 'font-style',
                type: 'radio',
                default: 'normal',
                options: [
                  { id: 'normal', label: 'Normal' },
                  { id: 'italic', label: 'Cursiva' },
                ],
              },
            ],
          },
          {
            name: 'Colores y fondo',
            open: true,
            buildProps: [
              'background-color',
              'border-radius',
              'border',
            ],
          },
        ],
      },
    });

    const panels = editor.Panels;
    // El preset llama setDevice('Desktop'|'Mobile portrait'); re-mapear a Escritorio/Móvil.
    // `stop` vacío evita que GrapesJS desactive el botón al instante (noStop).
    editor.Commands.add('set-device-desktop', {
      run: (ed) => ed.setDevice('Escritorio'),
      stop: () => undefined,
    });
    editor.Commands.add('set-device-mobile', {
      run: (ed) => ed.setDevice('Móvil'),
      stop: () => undefined,
    });
    editor.Commands.add('insert-merge-first-name', {
      run: (ed) => {
        insertNameMergeTag(ed, NEWSLETTER_FIRST_NAME_MERGE_TAG);
      },
    });
    editor.Commands.add('insert-merge-last-name', {
      run: (ed) => {
        insertNameMergeTag(ed, NEWSLETTER_LAST_NAME_MERGE_TAG);
      },
    });
    panels.removeButton('devices-c', 'set-device-tablet');
    for (const id of ['gjs-toggle-images', 'canvas-clear'] as const) {
      panels.removeButton('options', id);
    }
    panels.addButton('options', {
      id: 'insert-merge-first-name',
      className: 'gjs-pn-btn',
      command: 'insert-merge-first-name',
      label: '{{fn}}',
    });
    panels.addButton('options', {
      id: 'insert-merge-last-name',
      className: 'gjs-pn-btn',
      command: 'insert-merge-last-name',
      label: '{{ln}}',
    });

    registerMaliBlocks(editor, brand);
    loadInitialContent(editor, initialDesignJson, initialHtml, brand);
    editorRef.current = editor;
    const stopTypography = showEffectiveTypography(editor, containerRef.current);

    if (editLinks) {
      const syncLink = () => queueMicrotask(() => {
        if (!active) return;
        const selected = getSelectedLink(editor);
        setLinkComponent(selected);
        setLinkValue(selected ? linkDestination(selected) : '');
        setLinkError('');
      });
      editor.on('component:selected component:deselected component:update:attributes:href', syncLink);
    }

    return () => {
      active = false;
      stopTypography();
      editor.destroy();
      editorRef.current = null;
    };
    // Remount via `key` when opening another newsletter.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional once-per-mount init
  }, []);

  const appliedLink = linkComponent ? normalizeNewsletterLink(linkDestination(linkComponent)) : null;
  return (
    <>
      {editLinks ? (
        <div className="mb-3 space-y-2">
          <Label htmlFor={linkInputId}>URL del botón o enlace</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={linkInputId}
              className="min-w-48 flex-1"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={linkValue}
              placeholder="https://mali.pe/agenda"
              disabled={!linkComponent}
              aria-invalid={Boolean(linkError)}
              aria-describedby={`${linkInputId}-hint`}
              onChange={(event) => {
                setLinkValue(event.target.value);
                setLinkError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={() => applyLink()} disabled={!linkComponent}>
              Aplicar enlace
            </Button>
            {appliedLink ? (
              <Button variant="ghost" asChild>
                <a href={appliedLink} target="_blank" rel="noreferrer">
                  Probar enlace
                </a>
              </Button>
            ) : null}
          </div>
          <p id={`${linkInputId}-hint`} className={linkError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} role={linkError ? 'alert' : undefined}>
            {linkError || (linkComponent
              ? 'Pega la dirección y pulsa Aplicar enlace.'
              : 'Selecciona un botón o enlace en el boletín para editar su dirección.')}
          </p>
        </div>
      ) : null}
      {uploading ? <p role="status" className="mb-2 text-xs text-muted-foreground">Subiendo imágenes…</p> : null}
      {assetLimit ? (
        <p className="mb-2 text-xs text-muted-foreground">
          Imágenes de hasta {assetLimit / (1024 * 1024)} MB por archivo.
        </p>
      ) : null}
      <div
        className={
          className ??
          'newsletter-gjs overflow-hidden rounded-lg border border-border/60'
        }
        style={{ minHeight: 620, height: 'min(72vh, 820px)' }}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </>
  );
});
