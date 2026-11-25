import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { NewsletterBrand } from '@mali-one/shared';
import {
  NEWSLETTER_BRANDS,
  NEWSLETTER_BRAND_LABELS,
  NEWSLETTER_CONTENT_REQUEST_MAX_BYTES,
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

type LoadedContent = {
  id: string;
  title: string;
  subject: string;
  htmlBody: string;
  designJson: string | null;
  brand: NewsletterBrand | null;
  editable: boolean;
  contentRevisionToken?: string;
  workingForCampaign?: { id: string; name: string; status: string } | null;
};

export function MalichimpContentEditor({
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
  const [saveError, setSaveError] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [brand, setBrand] = useState<NewsletterBrand | null>(null);
  const [editable, setEditable] = useState(true);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string | null>(null);
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
    setSaveError('');
    try {
      const row = (await api.getMalichimpContent(contentId)) as LoadedContent;
      setTitle(row.title);
      setSubject(row.subject);
      setBrand(row.brand ?? null);
      setEditable(row.editable);
      setCampaignId(row.workingForCampaign?.id ?? null);
      setCampaignName(row.workingForCampaign?.name ?? null);
      setContentRevision(row.contentRevisionToken ?? null);
      setInitialDesignJson(row.designJson ?? null);
      setInitialHtml(row.htmlBody);
      setEditorKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el contenido');
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
        setInitialDesignJson(exported.designJson);
      }
      setSaveError('');
      setBrand(next);
      setEditorKey((k) => k + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo cambiar la marca.');
    }
  }

  async function handleSave() {
    if (saving || (!editable && mode === 'edit')) return;
    if (!title.trim() || !subject.trim()) {
      setSaveError('Completa el título y el asunto para guardar.');
      return;
    }
    setSaving(true);
    setSaveConflict(false);
    setSaveError('');
    try {
      const content = await exportNewsletterForSave(
        editorRef,
        async (file) => {
          try {
            return (await api.uploadNewsletterAsset(file, contentId ?? 'library')).url;
          } catch (uploadError) {
            const message = uploadError instanceof ApiRequestError && uploadError.status === 413
              ? 'La imagen supera el límite de carga.'
              : uploadError instanceof Error ? uploadError.message : 'Error de carga.';
            throw new Error(`No se pudo subir una imagen incrustada. ${message}`);
          }
        },
        uploadedImages.current,
      );
      const body = { title: title.trim(), subject: subject.trim(), ...content, brand };
      const requestBody = mode === 'edit' ? { ...body, contentRevision } : body;
      if (new TextEncoder().encode(JSON.stringify(requestBody)).byteLength > NEWSLETTER_CONTENT_REQUEST_MAX_BYTES) {
        throw new Error('El boletín supera los 25 MB de guardado. Reduce el HTML importado o reemplaza los recursos pesados.');
      }
      if (mode === 'create') {
        const created = await api.createMalichimpContent(body);
        toast.success('Contenido creado');
        onCreated?.(created.id);
      } else if (contentId) {
        if (!contentRevision) {
          throw new Error('Recarga el contenido antes de guardar.');
        }
        const updated = await api.updateMalichimpContent(contentId, {
          ...body,
          contentRevision,
        });
        setContentRevision(updated.contentRevisionToken ?? null);
        toast.success('Contenido actualizado');
        onClose();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar';
      const isConflict = e instanceof ApiRequestError && e.status === 409;
      if (isConflict) {
        setSaveConflict(true);
        toast.error(message);
      } else if (e instanceof ApiRequestError && e.status === 413) {
        setSaveError('El servidor rechazó el tamaño del boletín (413). Tu trabajo sigue abierto para reducir el contenido o reintentar.');
      } else if (e instanceof ApiRequestError && (e.status === 401 || e.status === 403)) {
        setSaveError(`El servidor rechazó el acceso al guardar (${e.status}). Revisa tu sesión y acceso a MALICHIMP.`);
      } else {
        setSaveError(message);
      }
      // Keep local draft; never auto-reload after a failed save.
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        Cargando contenido…
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

  const canEdit = editable || mode === 'create';
  const backToCampaignHref = campaignId
    ? `/admin/malichimp?tab=campaigns&campaign=${encodeURIComponent(campaignId)}`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {backToCampaignHref ? (
            <Button type="button" variant="ghost" size="sm" asChild>
              <a href={backToCampaignHref}>
                <ArrowLeft className="size-4" aria-hidden />
                Volver a la campaña
              </a>
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="size-4" aria-hidden />
              Volver al listado
            </Button>
          )}
          <h2 className="mt-2 text-base font-medium">
            {mode === 'create'
              ? 'Nuevo contenido'
              : canEdit
                ? 'Editar contenido'
                : 'Contenido (solo lectura)'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {campaignName
              ? `Contenido de la campaña: ${campaignName}`
              : 'Pieza de la biblioteca MALICHIMP.'}
          </p>
          {backToCampaignHref ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Si abriste esta pestaña desde el asistente, puedes cerrarla tras guardar y
              actualizar la vista de la campaña.
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            Guardar
          </Button>
        ) : null}
      </div>

      {!editable && mode === 'edit' ? (
        <AlertBanner>
          Solo se puede editar el contenido de la campaña mientras esté en preparación.
        </AlertBanner>
      ) : null}

      {saveConflict ? (
        <AlertBanner variant="error">
          <div className="space-y-2">
            <p>
              Otra persona modificó este contenido. Puedes recargar la versión más reciente o
              conservar tu trabajo para copiarlo.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void load()}
              >
                Recargar versión del servidor
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSaveConflict(false)}
              >
                Conservar mi trabajo
              </Button>
            </div>
          </div>
        </AlertBanner>
      ) : null}

      {saveError ? <AlertBanner variant="error">{saveError}</AlertBanner> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="malichimp-wc-title">Título</Label>
          <Input
            id="malichimp-wc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit || saving}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="malichimp-wc-subject">Asunto</Label>
            {canEdit ? (
              <NewsletterSubjectMergeButtons
                disabled={saving}
                onAppend={(tag) =>
                  setSubject((current) => appendNewsletterSubjectTag(current, tag))
                }
              />
            ) : null}
          </div>
          <Input
            id="malichimp-wc-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!canEdit || saving}
            maxLength={campaignId ? 300 : 200}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="malichimp-wc-brand">Marca (opcional)</Label>
          <Select
            value={brand ?? 'none'}
            disabled={!canEdit || saving}
            onValueChange={(v) => {
              applyBrand(v === 'none' ? null : (v as NewsletterBrand));
            }}
          >
            <SelectTrigger id="malichimp-wc-brand">
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

      {canEdit ? (
        <NewsletterEditorChrome
          editorRef={editorRef}
          editorKey={`${editorKey}-${brand ?? 'none'}-${mode}`}
          brand={brand}
          initialDesignJson={initialDesignJson}
          initialHtml={initialHtml}
          assetScope={contentId ?? 'library'}
          disabled={saving}
          onInsertSuccess={(label) => toast.success(`Se insertó «${label}»`)}
          onInsertError={() => toast.error('No se pudo insertar la variable')}
        />
      ) : (
        <iframe
          className="min-h-[34rem] w-full rounded-lg border bg-white"
          title="Contenido del boletín"
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={initialHtml ?? ''}
        />
      )}
    </div>
  );
}
