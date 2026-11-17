import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { NewsletterBrand, NewsletterDto } from '@mali-one/shared';
import {
  NEWSLETTER_BRANDS,
  NEWSLETTER_BRAND_LABELS,
} from '@mali-one/shared';
import {
  NewsletterEditor,
  type NewsletterEditorHandle,
} from '@/components/newsletter-editor';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import { slugify } from '@/lib/coordinates';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
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
  const confirm = useConfirm();
  const editorRef = useRef<NewsletterEditorHandle>(null);
  const openedFromQueryRef = useRef<string | null>(null);
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [mode, setMode] = useState<EditorMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [initialDesignJson, setInitialDesignJson] = useState<string | null>(
    null,
  );
  const [initialHtml, setInitialHtml] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [brand, setBrand] = useState<NewsletterBrand | null>(null);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  function handleTitleChange(value: string) {
    setTitle(value);
    if (mode === 'create' && !slugManual) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManual(true);
    setSlug(value);
  }

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
    setSlugManual(false);
    setTitle('');
    setSubject('');
    setBrand(null);
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

  const openEdit = useCallback(async (id: string) => {
    try {
      const n = await api.getNewsletter(id);
      setEditingId(n.id);
      setSlug(n.slug);
      setTitle(n.title);
      setSubject(n.subject);
      setBrand(n.brand ?? null);
      setStatus(n.status === 'published' ? 'published' : 'draft');
      setInitialDesignJson(n.designJson ?? null);
      setInitialHtml(n.htmlBody);
      setMode('edit');
      setEditorKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo abrir');
    }
  }, [toast]);

  useEffect(() => {
    const requestedId = searchParams.get('edit');
    if (!requestedId || openedFromQueryRef.current === requestedId) return;
    openedFromQueryRef.current = requestedId;
    void openEdit(requestedId);
  }, [openEdit, searchParams]);

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
          brand,
          status,
        });
        toast.success('Boletín creado');
      } else if (mode === 'edit' && editingId) {
        await api.updateNewsletter(editingId, {
          title: title.trim(),
          subject: subject.trim(),
          htmlBody: exported.htmlBody,
          designJson: exported.designJson,
          brand,
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

  async function togglePublish(n: NewsletterDto, publish: boolean) {
    if (!publish) {
      const ok = await confirm({
        title: `¿Despublicar “${n.title}”?`,
        description: 'La URL pública dejará de estar disponible.',
        confirmLabel: 'Despublicar',
        variant: 'destructive',
      });
      if (!ok) return;
    }

    setTogglingId(n.id);
    try {
      await api.updateNewsletter(n.id, {
        status: publish ? 'published' : 'draft',
      });
      await load();
      toast.success(publish ? 'Boletín publicado' : 'Pasó a borrador');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(n: NewsletterDto) {
    const ok = await confirm({
      title: `¿Eliminar el boletín “${n.title}”?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
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
        description="Diseña y publica contenido reutilizable. Las audiencias y los envíos se administran desde el módulo que consume cada boletín."
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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="slug">Slug (URL /n/…)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="se-genera-del-titulo"
                disabled={mode === 'edit'}
              />
            </div>
            <div className="space-y-1">
              <Label>Marca (opcional)</Label>
              <Select
                value={brand ?? 'none'}
                onValueChange={(v) => {
                  const next = v === 'none' ? null : (v as NewsletterBrand);
                  setBrand(next);
                  if (mode === 'create') setEditorKey((k) => k + 1);
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
            <div className="space-y-1">
              <Label htmlFor="subject">Asunto del correo</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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
          </div>

          <p className="text-xs text-muted-foreground">
            En el panel izquierdo usa la categoría <strong>MALI</strong>: Texto |
            Imagen, Imagen | Texto, bloque de color, barra CTA
            {brand
              ? `. Con marca ${NEWSLETTER_BRAND_LABELS[brand]} también aparecen su header y footer.`
              : '.'}{' '}
            Selecciona un elemento y cambia color / alineación en Estilos a la
            derecha.
          </p>

          <NewsletterEditor
            key={`${editorKey}-${brand ?? 'none'}`}
            ref={editorRef}
            initialDesignJson={initialDesignJson}
            initialHtml={initialHtml}
            brand={brand}
            slug={slug}
          />
        </div>
      ) : null}

      {mode === 'closed' && loading ? (
        <TableSkeleton rows={4} />
      ) : mode === 'closed' && newsletters.length === 0 ? (
        <EmptyState
          title="Sin boletines"
          description="Crea el primero con el editor visual drag & drop."
        />
      ) : mode === 'closed' && newsletters.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[320px] max-w-[320px]">Título</TableHead>
              <TableHead className="w-[200px] max-w-[200px]">Slug</TableHead>
              <TableHead className="w-[140px]">Marca</TableHead>
              <TableHead className="w-[150px]">Estado</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-right">
                Acciones
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newsletters.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="max-w-[320px]">
                  <div className="truncate font-medium" title={n.title}>
                    {n.title}
                  </div>
                  <div
                    className="truncate text-xs text-muted-foreground"
                    title={n.subject}
                  >
                    {n.subject}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate font-mono text-sm" title={n.slug}>
                  {n.slug}
                </TableCell>
                <TableCell>
                  {n.brand ? NEWSLETTER_BRAND_LABELS[n.brand] : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      size="sm"
                      checked={n.status === 'published'}
                      disabled={togglingId === n.id}
                      aria-label={
                        n.status === 'published'
                          ? `Despublicar ${n.title}`
                          : `Publicar ${n.title}`
                      }
                      onCheckedChange={(checked) =>
                        void togglePublish(n, checked)
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {n.status === 'published' ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void openEdit(n.id)}
                    title="Editar"
                  >
                    <Pencil className="size-4" />
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
