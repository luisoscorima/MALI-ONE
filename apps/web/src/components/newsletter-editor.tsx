import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import grapesjs, { type Editor } from 'grapesjs';
import newsletterPlugin from 'grapesjs-preset-newsletter';
import es from 'grapesjs/locale/es';
import 'grapesjs/dist/css/grapes.min.css';

export type NewsletterEditorExport = {
  htmlBody: string;
  designJson: string;
};

export type NewsletterEditorHandle = {
  getExport: () => NewsletterEditorExport;
};

type NewsletterEditorProps = {
  initialDesignJson?: string | null;
  initialHtml?: string | null;
  className?: string;
};

/** Accent used for CTAs in Mailchimp MALI templates. */
const MALI_PINK = '#e2187d';
const MALI_BLACK = '#111111';
const IMG_SQ =
  'https://placehold.co/520x520/e8e8e8/999999?text=Imagen';
const IMG_WIDE =
  'https://placehold.co/560x320/e8e8e8/999999?text=Imagen';

const FONT =
  "Arial, Helvetica, 'Helvetica Neue', sans-serif";

function textCol(title: string, body: string): string {
  return `
<td style="width:50%;padding:12px 16px;vertical-align:top;font-family:${FONT}" width="50%">
  <h2 style="margin:0 0 10px;color:${MALI_BLACK};font-size:18px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">${title}</h2>
  <div style="height:3px;width:100%;background:${MALI_BLACK};margin:0 0 14px"></div>
  <p style="margin:0 0 16px;color:${MALI_BLACK};font-size:14px;line-height:1.55">${body}</p>
  <p style="margin:0">
    <a href="https://mali.pe" style="color:${MALI_PINK};font-size:13px;font-weight:700;text-decoration:underline;text-transform:uppercase;letter-spacing:0.02em">→ Conoce más aquí</a>
  </p>
</td>`.trim();
}

function imageCol(src: string): string {
  return `
<td style="width:50%;padding:12px 16px;vertical-align:top" width="50%">
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

const BLOCK_TEXT_LEFT = twoCol(
  textCol(
    'Álbumes de juventud',
    'Texto del bloque. Edita el título, el párrafo y el enlace. Cambia colores en el panel de estilos.',
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
      <td style="padding:8px 16px 20px;color:${MALI_BLACK};font-size:14px;line-height:1.55">
        <p style="margin:0">Párrafo bajo la imagen a ancho completo. Edítalo aquí.</p>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_HEADER = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="padding:8px 16px;text-align:center;font-size:11px;color:#888888">
        <a href="https://mali.pe" style="color:#888888;text-decoration:underline">Ver este correo en el navegador</a>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 16px 8px">
        <div style="font-size:28px;font-weight:900;letter-spacing:0.08em;color:${MALI_BLACK}">MALI</div>
      </td>
    </tr>
    <tr>
      <td style="padding:4px 16px 20px">
        <h1 style="margin:0;color:${MALI_BLACK};font-size:26px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase">Edición especial</h1>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_COLOR_BANNER = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:#1a6bb5;padding:36px 28px;color:#ffffff">
        <h2 style="margin:0 0 14px;font-size:28px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff">Dona al MALI</h2>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#ffffff">
          Texto del bloque de color. Cambia el fondo y el color del texto en Estilos.
        </p>
        <p style="margin:0 0 10px">
          <a href="https://mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Donar</a>
        </p>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_CTA_BAR = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:${MALI_PINK};padding:16px 20px;text-align:center">
        <a href="https://mali.pe" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.06em;text-transform:uppercase">Compra tus entradas aquí</a>
      </td>
    </tr>
  </tbody>
</table>`.trim();

const BLOCK_FOOTER = `
<table style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:#4a4a4a;padding:20px 24px;text-align:center;color:#ffffff;font-size:13px;line-height:1.5">
        Explora y comparte los archivos digitalizados del MALI.
      </td>
    </tr>
    <tr>
      <td style="background-color:#111111;padding:18px 24px;text-align:center;color:#ffffff;font-size:14px;font-weight:700">
        Explora más historias del arte peruano en el MALI
      </td>
    </tr>
    <tr>
      <td style="padding:16px;text-align:center;font-size:11px;color:#888888">
        © ${new Date().getFullYear()} MALI — Museo de Arte de Lima. Todos los derechos reservados.
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
            <tr><td>${BLOCK_CTA_BAR}</td></tr>
            <tr><td>${BLOCK_FOOTER}</td></tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
`.trim();

function registerMaliBlocks(editor: Editor) {
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
      media: `<svg viewBox="0 0 24 24" width="40" height="40"><text x="2" y="16" font-size="10" font-weight="700">MALI</text></svg>`,
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
      id: 'mali-color-banner',
      label: 'Bloque de color',
      content: BLOCK_COLOR_BANNER,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="32" fill="#1a6bb5"/><rect x="6" y="10" width="24" height="3" fill="#fff"/><rect x="6" y="16" width="32" height="2" fill="#cde"/></svg>`,
    },
    {
      id: 'mali-cta-bar',
      label: 'Barra CTA',
      content: BLOCK_CTA_BAR,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect y="10" width="48" height="12" fill="${MALI_PINK}"/><rect x="10" y="14" width="28" height="3" fill="#fff"/></svg>`,
    },
    {
      id: 'mali-footer',
      label: 'Pie MALI',
      content: BLOCK_FOOTER,
      media: `<svg viewBox="0 0 48 32" width="48" height="32"><rect width="48" height="14" fill="#4a4a4a"/><rect y="14" width="48" height="12" fill="#111"/><rect y="28" width="48" height="4" fill="#ddd"/></svg>`,
    },
    {
      id: 'mali-divider',
      label: 'Separador',
      content: BLOCK_DIVIDER,
    },
  ];

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
  editor.setComponents(MALI_STARTER_HTML);
}

export const NewsletterEditor = forwardRef<
  NewsletterEditorHandle,
  NewsletterEditorProps
>(function NewsletterEditor(
  { initialDesignJson, initialHtml, className },
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
          { name: 'Escritorio', width: '' },
          { name: 'Móvil', width: '320px', widthMedia: '480px' },
        ],
      },
      plugins: [
        (ed) =>
          newsletterPlugin(ed, {
            modalTitleImport: 'Importar plantilla',
            modalTitleExport: 'Exportar HTML',
            modalLabelImport:
              'Pega el HTML de la plantilla y haz clic en Importar',
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

    registerMaliBlocks(editor);
    loadInitialContent(editor, initialDesignJson, initialHtml);
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
