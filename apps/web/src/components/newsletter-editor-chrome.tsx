import type { RefObject } from 'react';
import type { NewsletterBrand } from '@mali-one/shared';
import { NEWSLETTER_BRAND_LABELS } from '@mali-one/shared';
import {
  NEWSLETTER_FIRST_NAME_MERGE_TAG,
  NEWSLETTER_LAST_NAME_MERGE_TAG,
  NewsletterEditor,
  type NewsletterEditorHandle,
} from '@/components/newsletter-editor';
import { Button } from '@/components/ui';
import { appendMergeTagToSubject } from '@/lib/newsletter-editor-save';

const BODY_MERGE_TAGS = [
  ['Nombre', NEWSLETTER_FIRST_NAME_MERGE_TAG],
  ['Apellidos', NEWSLETTER_LAST_NAME_MERGE_TAG],
  ['Nombre y apellidos', `${NEWSLETTER_FIRST_NAME_MERGE_TAG} ${NEWSLETTER_LAST_NAME_MERGE_TAG}`],
] as const;

export function NewsletterSubjectMergeButtons({
  onAppend,
  disabled,
}: {
  onAppend: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {(
        [
          NEWSLETTER_FIRST_NAME_MERGE_TAG,
          NEWSLETTER_LAST_NAME_MERGE_TAG,
        ] as const
      ).map((tag) => (
        <Button
          key={tag}
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled}
          onClick={() => onAppend(tag)}
        >
          + {tag}
        </Button>
      ))}
    </div>
  );
}

export function appendNewsletterSubjectTag(current: string, tag: string): string {
  return appendMergeTagToSubject(current, tag);
}

type NewsletterEditorChromeProps = {
  editorRef: RefObject<NewsletterEditorHandle | null>;
  editorKey: string | number;
  brand?: NewsletterBrand | null;
  initialDesignJson?: string | null;
  initialHtml?: string | null;
  assetScope: string;
  disabled?: boolean;
  onInsertSuccess?: (label: string, tag: string) => void;
  onInsertError?: () => void;
  className?: string;
};

export function NewsletterEditorChrome({
  editorRef,
  editorKey,
  brand = null,
  initialDesignJson,
  initialHtml,
  assetScope,
  disabled,
  onInsertSuccess,
  onInsertError,
  className,
}: NewsletterEditorChromeProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs text-muted-foreground">
          En el panel izquierdo usa la categoría <strong>MALI</strong> (cabecera, columnas, color por
          marca, CTA, redes y pie)
          {brand
            ? `. Con marca ${NEWSLETTER_BRAND_LABELS[brand]} también aparecen su header y footer.`
            : '.'}{' '}
          La categoría <strong>Básico</strong> aporta secciones y texto genéricos. Selecciona un
          elemento y cambia tipografía / color en Estilos a la derecha. Para personalizar el envío
          usa{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            {NEWSLETTER_FIRST_NAME_MERGE_TAG}
          </code>{' '}
          y{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
            {NEWSLETTER_LAST_NAME_MERGE_TAG}
          </code>
          ; si falta el nombre, se envía como estimado(a).
        </p>
        <div
          className="flex shrink-0 flex-wrap gap-2"
          role="group"
          aria-label="Personalizar con datos del contacto"
        >
          {BODY_MERGE_TAGS.map(([label, tag]) => (
            <Button
              key={label}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const ok = editorRef.current?.insertNameMergeTag(tag);
                if (ok) onInsertSuccess?.(label, tag);
                else onInsertError?.();
              }}
            >
              Insertar {label}
            </Button>
          ))}
        </div>
      </div>

      <div inert={disabled || undefined} aria-busy={disabled || undefined}>
        <NewsletterEditor
          key={editorKey}
          ref={editorRef}
          initialDesignJson={initialDesignJson}
          initialHtml={initialHtml}
          brand={brand}
          assetScope={assetScope}
          editLinks
          className={className}
        />
      </div>
    </div>
  );
}
