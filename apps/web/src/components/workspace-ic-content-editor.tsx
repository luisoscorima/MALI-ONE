import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { NewsletterBrand } from '@mali-one/shared';
import {
  NEWSLETTER_BRANDS,
  NEWSLETTER_BRAND_LABELS,
} from '@mali-one/shared';
import {
  NewsletterEditorChrome,
  NewsletterSubjectMergeButtons,
  appendNewsletterSubjectTag,
} from '@/components/newsletter-editor-chrome';
import { type NewsletterEditorHandle } from '@/components/newsletter-editor';
import { AlertBanner } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { ApiRequestError, api } from '@/lib/api';
import {
  exportNewsletterForSave,
  preserveEditorExport,
} from '@/lib/newsletter-editor-save';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

const PLACEHOLDER_HTML =
  '<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#444">Escribe aquí el contenido del correo.</p>';

export function WorkspaceIcContentEditor({
  contentId,
  mode,
  onClose,
  onCreated,
}: {
  contentId?: string | null;
  mode: 'create' | 'edit';
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const toast = useToast();
  const editorRef = useRef<NewsletterEditorHandle>(null);
  const uploadedImages = useRef(new Map<string, string>());
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveConflict, setSaveConflict] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [brand, setBrand] = useState<NewsletterBrand | null>(null);
  const [contentRevision, setContentRevision] = useState<string | null>(null);
  const [initialDesignJson, setInitialDesignJson] = useState<string | null>(null);
  const [initialHtml, setInitialHtml] = useState<string | null>(
    mode === 'create' ? PLACEHOLDER_HTML : null,
  );
  const [editorKey, setEditorKey] = useState(0);

  const load = useCallback(async () => {
    if (mode !== 'edit' || !contentId) return;
    setLoading(true);
    setError('');
    setSaveConflict(false);
    try {
      const row = await api.getInternalContent(contentId);
      setTitle(row.title);
      setSubject(row.subject);
      setBrand(row.brand ?? null);
      setContentRevision(row.contentRevisionToken ?? null);
      setInitialDesignJson(row.designJson ?? null);
      setInitialHtml(row.htmlBody);
      setEditorKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el boletín');
    } finally {
      setLoading(false);
    }
  }, [contentId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyBrand(next: NewsletterBrand | null) {
    try {
      const exported = preserveEditorExport(editorRef);
      if (exported) {
        setInitialHtml(exported.htmlBody);
        setInitialDesignJson(exported.designJson ?? null);
      }
      setBrand(next);
      setEditorKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar la marca.');
    }
  }

  async function handleSave() {
    if (!title.trim() || !subject.trim()) {
      toast.error('Completa título y asunto');
      return;
    }
    setSaving(true);
    setSaveConflict(false);
    try {
      const exported = await exportNewsletterForSave(
        editorRef,
        async (file) => {
          try {
            return (await api.uploadNewsletterAsset(file, contentId ?? 'catalog')).url;
          } catch (uploadError) {
            const message = uploadError instanceof ApiRequestError && uploadError.status === 413
              ? 'La imagen supera el límite de carga.'
              : uploadError instanceof Error ? uploadError.message : 'Error de carga.';
            throw new Error(`No se pudo subir una imagen incrustada. ${message}`);
          }
        },
        uploadedImages.current,
      );
      if (mode === 'create') {
        const created = await api.createInternalContent({
          title: title.trim(),
          subject: subject.trim(),
          htmlBody: exported.htmlBody,
          designJson: exported.designJson,
          brand,
        });
        toast.success('Boletín creado');
        onCreated?.(created.id);
      } else if (contentId) {
        if (!contentRevision) {
          toast.error('Recarga el boletín antes de guardar');
          return;
        }
        const updated = await api.updateInternalContent(contentId, {
          title: title.trim(),
          subject: subject.trim(),
          htmlBody: exported.htmlBody,
          designJson: exported.designJson,
          brand,
          contentRevision,
        });
        setContentRevision(updated.contentRevisionToken ?? null);
        toast.success('Boletín actualizado');
        onClose();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar';
      const isConflict = e instanceof ApiRequestError && e.status === 409;
      if (isConflict) {
        setSaveConflict(true);
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        Cargando boletín…
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <AlertBanner variant="error">{error}</AlertBanner>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="size-4" aria-hidden />
            Volver al listado
          </Button>
          <h2 className="mt-2 text-base font-medium">
            {mode === 'create' ? 'Nuevo boletín' : 'Editar boletín'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de boletines de campañas internas.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : null}
          Guardar
        </Button>
      </div>

      {saveConflict ? (
        <AlertBanner variant="error">
          <div className="space-y-2">
            <p>
              Otra persona modificó este boletín. Recarga la versión del servidor o conserva tu
              trabajo para copiarlo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                Recargar versión del servidor
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSaveConflict(false)}>
                Conservar mi trabajo
              </Button>
            </div>
          </div>
        </AlertBanner>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="ic-content-title">Título</Label>
          <Input
            id="ic-content-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ic-content-subject">Asunto</Label>
            <NewsletterSubjectMergeButtons
              disabled={saving}
              onAppend={(tag) =>
                setSubject((current) => appendNewsletterSubjectTag(current, tag))
              }
            />
          </div>
          <Input
            id="ic-content-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            disabled={saving}
          />
        </div>
        <div className="space-y-1">
          <Label>Marca (opcional)</Label>
          <Select
            value={brand ?? 'none'}
            disabled={saving}
            onValueChange={(v) => {
              applyBrand(v === 'none' ? null : (v as NewsletterBrand));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin marca</SelectItem>
              {NEWSLETTER_BRANDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {NEWSLETTER_BRAND_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <NewsletterEditorChrome
        editorRef={editorRef}
        editorKey={`${editorKey}-${brand ?? 'none'}-${mode}`}
        brand={brand}
        initialDesignJson={initialDesignJson}
        initialHtml={initialHtml}
        assetScope={contentId ?? 'catalog'}
        disabled={saving}
        onInsertSuccess={(label) => toast.success(`Se insertó «${label}»`)}
        onInsertError={() => toast.error('No se pudo insertar la variable')}
      />
    </div>
  );
}
