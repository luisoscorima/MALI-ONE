import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { NewsletterBrand } from '@mali-one/shared';
import {
  NEWSLETTER_BRANDS,
  NEWSLETTER_BRAND_LABELS,
} from '@mali-one/shared';
import {
  NEWSLETTER_FIRST_NAME_MERGE_TAG,
  NewsletterEditor,
  type NewsletterEditorHandle,
} from '@/components/newsletter-editor';
import { AlertBanner } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { ApiRequestError, api } from '@/lib/api';
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
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveConflict, setSaveConflict] = useState(false);
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
    const exported = editorRef.current?.getExport();
    if (exported?.htmlBody?.trim()) {
      setInitialHtml(exported.htmlBody);
      setInitialDesignJson(exported.designJson ?? null);
    }
    setBrand(next);
    setEditorKey((k) => k + 1);
  }

  async function handleSave() {
    if (!editable && mode === 'edit') return;
    const exported = editorRef.current?.getExport();
    if (!exported?.htmlBody?.trim()) {
      toast.error('El contenido no tiene HTML');
      return;
    }
    if (!title.trim() || !subject.trim()) {
      toast.error('Completa título y asunto');
      return;
    }
    setSaving(true);
    setSaveConflict(false);
    try {
      if (mode === 'create') {
        const created = await api.createMalichimpContent({
          title: title.trim(),
          subject: subject.trim(),
          htmlBody: exported.htmlBody,
          designJson: exported.designJson,
          brand,
        });
        toast.success('Contenido creado');
        onCreated?.(created.id);
      } else if (contentId) {
        if (!contentRevision) {
          toast.error('Recarga el contenido antes de guardar');
          return;
        }
        const updated = await api.updateMalichimpContent(contentId, {
          title: title.trim(),
          subject: subject.trim(),
          htmlBody: exported.htmlBody,
          designJson: exported.designJson,
          brand,
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
      } else {
        toast.error(message);
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="malichimp-wc-title">Título</Label>
          <Input
            id="malichimp-wc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="malichimp-wc-subject">Asunto</Label>
          <Input
            id="malichimp-wc-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!canEdit}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <Label>Marca (opcional)</Label>
          <Select
            value={brand ?? 'none'}
            disabled={!canEdit}
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

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            En el panel izquierdo usa la categoría MALI
            {brand
              ? `. Con marca ${NEWSLETTER_BRAND_LABELS[brand]} también aparecen su header y footer.`
              : '.'}{' '}
            Para el saludo personalizado usa{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              {NEWSLETTER_FIRST_NAME_MERGE_TAG}
            </code>
            .
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const ok = editorRef.current?.insertFirstNameMergeTag();
              if (ok) {
                toast.success(`Se insertó ${NEWSLETTER_FIRST_NAME_MERGE_TAG}`);
              } else {
                toast.error('No se pudo insertar la variable');
              }
            }}
          >
            Insertar {NEWSLETTER_FIRST_NAME_MERGE_TAG}
          </Button>
        </div>
      ) : null}

      <NewsletterEditor
        key={`${editorKey}-${brand ?? 'none'}-${mode}`}
        ref={editorRef}
        initialDesignJson={initialDesignJson}
        initialHtml={initialHtml}
        brand={brand}
        assetScope={contentId ?? 'library'}
      />
    </div>
  );
}
