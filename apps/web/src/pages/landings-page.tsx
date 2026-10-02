import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_GESTION_CULTURAL_LANDING_CONTENT,
  type LandingDocument,
  type LandingPageDto,
} from '@mali-one/shared';
import { LandingEditor } from '@/components/landing-editor';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@/components/ui';

type EditorMode = 'closed' | 'create' | 'edit';

function cloneDefault(): LandingDocument {
  return JSON.parse(
    JSON.stringify(DEFAULT_GESTION_CULTURAL_LANDING_CONTENT),
  ) as LandingDocument;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function LandingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<LandingPageDto[]>([]);
  const [mode, setMode] = useState<EditorMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState('gestion-cultural');
  const [name, setName] = useState('Gestión Cultural');
  const [seoTitle, setSeoTitle] = useState(
    'Programa de Especialización en Gestión Cultural | MALI Educación',
  );
  const [seoDescription, setSeoDescription] = useState(
    'Estudia Gestión Cultural en el Museo de Arte de Lima. Fórmate para diseñar y liderar proyectos culturales de gran impacto.',
  );
  const [ogImageUrl, setOgImageUrl] = useState(
    'https://educacion.mali.pe/wp-content/uploads/2025/11/Gestion-Cultural.webp',
  );
  const [content, setContent] = useState<LandingDocument>(cloneDefault);
  const [previewHtml, setPreviewHtml] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await api.listLandings());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se pudieron cargar las landings',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setSlug('gestion-cultural');
    setName('Gestión Cultural');
    setSeoTitle(
      'Programa de Especialización en Gestión Cultural | MALI Educación',
    );
    setSeoDescription(
      'Estudia Gestión Cultural en el Museo de Arte de Lima. Fórmate para diseñar y liderar proyectos culturales de gran impacto.',
    );
    setOgImageUrl(
      'https://educacion.mali.pe/wp-content/uploads/2025/11/Gestion-Cultural.webp',
    );
    setContent(cloneDefault());
    setPreviewHtml('');
    setMode('create');
  }

  async function openEdit(id: string) {
    try {
      const item = await api.getLanding(id);
      setEditingId(item.id);
      setSlug(item.slug);
      setName(item.name);
      setSeoTitle(item.seoTitle ?? '');
      setSeoDescription(item.seoDescription ?? '');
      setOgImageUrl(item.ogImageUrl ?? '');
      setContent(item.content ?? cloneDefault());
      setPreviewHtml('');
      setMode('edit');
    } catch (openError) {
      toast.error(
        openError instanceof Error ? openError.message : 'No se pudo abrir',
      );
    }
  }

  function closeEditor() {
    setMode('closed');
    setEditingId(null);
    setPreviewHtml('');
  }

  async function save(publishAfter = false) {
    if (!name.trim() || !slug.trim()) {
      toast.error('Completa el nombre y el slug');
      return;
    }
    if (content.blocks.length === 0) {
      toast.error('Añade al menos un bloque');
      return;
    }
    if (
      content.blocks.filter((block) => block.type === 'lead_form').length > 1
    ) {
      toast.error('Solo se permite un formulario de contacto por landing');
      return;
    }
    setSaving(true);
    try {
      let id = editingId;
      if (mode === 'create') {
        const created = await api.createLanding({
          slug: slug.trim().toLowerCase(),
          name: name.trim(),
          content,
          seoTitle: seoTitle.trim() || null,
          seoDescription: seoDescription.trim() || null,
          ogImageUrl: ogImageUrl.trim() || null,
        });
        id = created.id;
        // Si publicar falla, el registro ya existe: conservar el editor en modo
        // edición para que un reintento no intente crear de nuevo el mismo slug.
        setEditingId(created.id);
        setMode('edit');
      } else if (id) {
        await api.updateLanding(id, {
          name: name.trim(),
          content,
          seoTitle: seoTitle.trim() || null,
          seoDescription: seoDescription.trim() || null,
          ogImageUrl: ogImageUrl.trim() || null,
        });
      }
      if (publishAfter && id) {
        await api.publishLanding(id);
        toast.success('Landing guardada y publicada');
      } else {
        toast.success(mode === 'create' ? 'Landing creada' : 'Cambios guardados');
      }
      closeEditor();
      await load();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : 'No se pudo guardar',
      );
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    try {
      const result = await api.previewLanding({
        name: name.trim() || 'Vista previa',
        content,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        ogImageUrl: ogImageUrl.trim() || null,
      });
      setPreviewHtml(result.html);
      window.setTimeout(() => {
        document.getElementById('landing-preview')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    } catch (previewError) {
      toast.error(
        previewError instanceof Error
          ? previewError.message
          : 'No se pudo generar la vista previa',
      );
    }
  }

  async function unpublish(item: LandingPageDto) {
    try {
      await api.unpublishLanding(item.id);
      await load();
      toast.success('Landing despublicada');
    } catch (unpublishError) {
      toast.error(
        unpublishError instanceof Error
          ? unpublishError.message
          : 'No se pudo despublicar',
      );
    }
  }

  async function remove(item: LandingPageDto) {
    const accepted = await confirm({
      title: `¿Eliminar la landing “${item.name}”?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!accepted) return;
    try {
      await api.deleteLanding(item.id);
      await load();
      toast.success('Landing eliminada');
    } catch (removeError) {
      toast.error(
        removeError instanceof Error
          ? removeError.message
          : 'No se pudo eliminar',
      );
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Landings"
        description="Páginas de campaña publicadas en MALI Educación sin cargar el theme de WordPress."
        actions={
          mode === 'closed' ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-1 size-4" /> Nueva landing
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={closeEditor}>
                Cancelar
              </Button>
              <Button type="button" variant="outline" onClick={() => void preview()}>
                <Eye className="mr-1 size-4" /> Vista previa
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => void save(false)}>
                {saving ? 'Guardando…' : 'Guardar borrador'}
              </Button>
              <Button type="button" disabled={saving} onClick={() => void save(true)}>
                <Send className="mr-1 size-4" /> Guardar y publicar
              </Button>
            </div>
          )
        }
      />

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      {mode !== 'closed' ? (
        <div className="space-y-5">
          <section className="grid gap-3 rounded-xl border border-border/60 p-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="landing-name">Nombre interno</Label>
              <Input id="landing-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="landing-slug">Slug</Label>
              <Input
                id="landing-slug"
                value={slug}
                disabled={mode === 'edit'}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                placeholder="gestion-cultural"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="landing-seo-title">Título SEO</Label>
              <Input id="landing-seo-title" value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="landing-seo-description">Descripción SEO</Label>
              <Textarea
                id="landing-seo-description"
                value={seoDescription}
                onChange={(event) => setSeoDescription(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="landing-og-image">Imagen Open Graph</Label>
              <Input id="landing-og-image" value={ogImageUrl} onChange={(event) => setOgImageUrl(event.target.value)} />
            </div>
          </section>

          <LandingEditor value={content} onChange={setContent} />

          {previewHtml ? (
            <section id="landing-preview" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Vista previa</h3>
                <Button variant="ghost" size="sm" onClick={() => setPreviewHtml('')}>
                  Cerrar
                </Button>
              </div>
              <iframe
                title="Vista previa de la landing"
                srcDoc={previewHtml}
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                className="h-[820px] w-full rounded-xl border bg-white"
              />
            </section>
          ) : null}
        </div>
      ) : loading ? (
        <TableSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin landings"
          description="Crea la landing piloto con la plantilla de Gestión Cultural."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Landing</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Publicación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">/landing/{item.slug}/</div>
                </TableCell>
                <TableCell>
                  <Badge variant={item.status === 'published' ? 'default' : 'outline'}>
                    {item.status === 'published' ? 'Publicada' : item.status === 'archived' ? 'Archivada' : 'Borrador'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>{formatDate(item.publishedAt)}</div>
                  {item.publishedVersion > 0 ? (
                    <div className="text-xs text-muted-foreground">Versión {item.publishedVersion}</div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => void openEdit(item.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    {item.publicUrl ? (
                      <>
                        <Button size="icon" variant="ghost" title="Copiar URL" onClick={() => void copyUrl(item.publicUrl!)}>
                          <Copy className="size-4" />
                        </Button>
                        <Button size="icon" variant="ghost" asChild>
                          <a href={item.publicUrl} target="_blank" rel="noreferrer" title="Abrir landing">
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void unpublish(item)}>
                          Despublicar
                        </Button>
                      </>
                    ) : null}
                    <Button size="icon" variant="ghost" title="Eliminar" onClick={() => void remove(item)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
