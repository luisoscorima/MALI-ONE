import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import type { NewsletterDto } from '@mali-one/shared';
import {
  NewsletterEditor,
  type NewsletterEditorHandle,
} from '@/components/newsletter-editor';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

type EditorMode = 'closed' | 'create' | 'edit';

export function NewslettersPage() {
  const toast = useToast();
  const editorRef = useRef<NewsletterEditorHandle>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<EditorMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [initialDesignJson, setInitialDesignJson] = useState<string | null>(
    null,
  );
  const [initialHtml, setInitialHtml] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setNewsletters(await api.listNewsletters());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar boletines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetMeta() {
    setSlug('');
    setTitle('');
    setSubject('');
    setStatus('draft');
    setEditingId(null);
    setInitialDesignJson(null);
    setInitialHtml(null);
  }

  function openCreate() {
    resetMeta();
    setMode('create');
    setEditorKey((k) => k + 1);
  }

  async function openEdit(id: string) {
    try {
      const n = await api.getNewsletter(id);
      setEditingId(n.id);
      setSlug(n.slug);
      setTitle(n.title);
      setSubject(n.subject);
      setStatus(n.status === 'published' ? 'published' : 'draft');
      setInitialDesignJson(n.designJson ?? null);
      setInitialHtml(n.htmlBody);
      setMode('edit');
      setEditorKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir');
    }
  }

  function closeEditor() {
    setMode('closed');
    resetMeta();
  }

  async function handleSave() {
    const exported = editorRef.current?.getExport();
    if (!exported?.htmlBody?.trim()) {
      toast.error('El boletín no tiene contenido');
      return;
    }
    if (!title.trim() || !subject.trim()) {
      toast.error('Completa título y asunto');
      return;
    }
    if (mode === 'create' && !slug.trim()) {
      toast.error('Indica un slug para la URL pública');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        await api.createNewsletter({
          slug: slug.trim().toLowerCase(),
          title: title.trim(),
          subject: subject.trim(),
          htmlBody: exported.htmlBody,
          designJson: exported.designJson,
          status,
        });
        toast.success('Boletín creado');
      } else if (mode === 'edit' && editingId) {
        await api.updateNewsletter(editingId, {
          title: title.trim(),
          subject: subject.trim(),
          htmlBody: exported.htmlBody,
          designJson: exported.designJson,
          status,
        });
        toast.success('Boletín actualizado');
      }
      closeEditor();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(n: NewsletterDto) {
    try {
      await api.updateNewsletter(n.id, {
        status: n.status === 'published' ? 'draft' : 'published',
      });
      await load();
      toast.success(
        n.status === 'published' ? 'Pasó a borrador' : 'Boletín publicado',
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    }
  }

  async function handleDelete(n: NewsletterDto) {
    if (!window.confirm(`¿Eliminar el boletín “${n.title}”?`)) return;
    try {
      await api.deleteNewsletter(n.id);
      if (editingId === n.id) closeEditor();
      await load();
      toast.success('Boletín eliminado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  async function copyUrl(slugValue: string) {
    const url = `${window.location.origin}/n/${slugValue}`;
    await navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boletines"
        description="Bloques al estilo Mailchimp MALI: texto|imagen, imagen|texto, colores y CTAs. El envío masivo se hace desde CRM PAM."
        actions={
          mode === 'closed' ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-1 size-4" />
              Nuevo boletín
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={closeEditor}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving
                  ? 'Guardando…'
                  : mode === 'create'
                    ? 'Guardar boletín'
                    : 'Actualizar boletín'}
              </Button>
            </div>
          )
        }
      />

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      {mode !== 'closed' ? (
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <h3 className="font-semibold">
            {mode === 'create' ? 'Nuevo boletín' : 'Editar boletín'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="slug">Slug (URL /n/…)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="boletin-marzo-2026"
                disabled={mode === 'edit'}
              />
            </div>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as 'draft' | 'published')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="subject">Asunto del correo</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            En el panel izquierdo usa la categoría <strong>MALI</strong>: Texto |
            Imagen, Imagen | Texto, bloque de color, barra CTA. Selecciona un
            elemento y cambia color / alineación en Estilos a la derecha.
          </p>

          <NewsletterEditor
            key={editorKey}
            ref={editorRef}
            initialDesignJson={initialDesignJson}
            initialHtml={initialHtml}
          />
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : newsletters.length === 0 && mode === 'closed' ? (
        <EmptyState
          title="Sin boletines"
          description="Crea el primero con el editor visual drag & drop."
        />
      ) : newsletters.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newsletters.map((n) => (
              <TableRow key={n.id}>
                <TableCell>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.subject}</div>
                </TableCell>
                <TableCell className="font-mono text-sm">{n.slug}</TableCell>
                <TableCell>{n.status}</TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void openEdit(n.id)}
                    title="Editar"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void togglePublish(n)}
                  >
                    {n.status === 'published' ? 'Despublicar' : 'Publicar'}
                  </Button>
                  {n.status === 'published' ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void copyUrl(n.slug)}
                        title="Copiar URL"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a
                          href={`/n/${n.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDelete(n)}
                    title="Eliminar"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
