import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { NewsletterBrand } from '@mali-one/shared';
import { NEWSLETTER_BRAND_LABELS } from '@mali-one/shared';
import {
  NEWSLETTER_FIRST_NAME_MERGE_TAG,
  NewsletterEditor,
  type NewsletterEditorHandle,
} from '@/components/newsletter-editor';
import { AlertBanner } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
import { Button, Input, Label } from '@/components/ui';

type LoadedContent = {
  id: string;
  title: string;
  subject: string;
  htmlBody: string;
  designJson: string | null;
  brand: NewsletterBrand | null;
  editable: boolean;
  workingForCampaign?: { id: string; name: string; status: string } | null;
};

export function MalichimpContentEditor({
  contentId,
  onClose,
}: {
  contentId: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const editorRef = useRef<NewsletterEditorHandle>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [brand, setBrand] = useState<NewsletterBrand | null>(null);
  const [editable, setEditable] = useState(false);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [initialDesignJson, setInitialDesignJson] = useState<string | null>(null);
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const row = (await api.getMalichimpContent(contentId)) as LoadedContent;
      setTitle(row.title);
      setSubject(row.subject);
      setBrand(row.brand ?? null);
      setEditable(row.editable);
      setCampaignName(row.workingForCampaign?.name ?? null);
      setInitialDesignJson(row.designJson ?? null);
      setInitialHtml(row.htmlBody);
      setEditorKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el contenido');
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!editable) return;
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
    try {
      await api.updateMalichimpContent(contentId, {
        title: title.trim(),
        subject: subject.trim(),
        htmlBody: exported.htmlBody,
        designJson: exported.designJson,
      });
      toast.success('Contenido actualizado');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="size-4" aria-hidden />
            Volver al listado
          </Button>
          <h2 className="mt-2 text-base font-medium">
            {editable ? 'Editar contenido de campaña' : 'Contenido (solo lectura)'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {campaignName
              ? `Campaña: ${campaignName}`
              : 'Fork exclusivo de una campaña MALICHIMP.'}
            {brand ? ` · Marca ${NEWSLETTER_BRAND_LABELS[brand]}` : ''}
          </p>
        </div>
        {editable ? (
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            Guardar
          </Button>
        ) : null}
      </div>

      {!editable ? (
        <AlertBanner>
          Solo se puede editar mientras la campaña esté en preparación.
        </AlertBanner>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="malichimp-wc-title">Título</Label>
          <Input
            id="malichimp-wc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!editable}
            maxLength={200}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="malichimp-wc-subject">Asunto</Label>
          <Input
            id="malichimp-wc-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!editable}
            maxLength={200}
          />
        </div>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
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
        key={`${editorKey}-${brand ?? 'none'}`}
        ref={editorRef}
        initialDesignJson={initialDesignJson}
        initialHtml={initialHtml}
        brand={brand}
      />
    </div>
  );
}
