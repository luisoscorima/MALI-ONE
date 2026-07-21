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

const MALI_STARTER_HTML = `
<table style="width:100%;background-color:#f0f0f0;margin:0;padding:0" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td align="center" style="padding:24px 12px">
        <table style="width:600px;max-width:100%;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif" width="600" cellspacing="0" cellpadding="0">
          <tbody>
            <tr>
              <td style="background-color:#c41230;padding:28px 24px;text-align:center">
                <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.04em">MALI</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px">
                <h2 style="margin:0 0 16px;color:#111111;font-size:22px;font-weight:600">Hola PAM</h2>
                <p style="margin:0 0 16px;color:#333333;font-size:16px;line-height:1.55">
                  Escribe aquí el contenido del boletín. Arrastra bloques desde el panel izquierdo
                  (texto, imagen, botón, columnas) y suéltalos en el lienzo.
                </p>
                <p style="margin:28px 0 8px;text-align:center">
                  <a href="https://mali.pe" style="display:inline-block;background-color:#c41230;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:4px;font-size:15px;font-weight:600">
                    Visitar mali.pe
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background-color:#fafafa;text-align:center;font-size:12px;color:#888888;line-height:1.4">
                Museo de Arte de Lima · <a href="https://mali.pe" style="color:#c41230;text-decoration:none">mali.pe</a>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
`.trim();

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
            open: false,
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
            name: 'Decoración',
            open: false,
            buildProps: [
              'background-color',
              'border-radius',
              'border',
              'box-shadow',
              'background',
            ],
          },
        ],
      },
    });

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
