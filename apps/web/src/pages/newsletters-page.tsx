import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type {
  EmailSenderDto,
  NewsletterBrand,
  NewsletterListItemDto,
} from '@mali-one/shared';
import {
  NEWSLETTER_BRANDS,
  NEWSLETTER_BRAND_LABELS,
} from '@mali-one/shared';
import { EmailSendersPanel } from '@/components/email-senders-panel';
import { NewsletterCampaignsRegistry } from '@/components/newsletter-campaigns-registry';
import {
  NEWSLETTER_FIRST_NAME_MERGE_TAG,
  NEWSLETTER_LAST_NAME_MERGE_TAG,
  NewsletterEditor,
  type NewsletterEditorHandle,
} from '@/components/newsletter-editor';
import { PageHeader } from '@/components/page-header';
import { AlertBanner, EmptyState, TableShellSkeleton } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import { slugify } from '@/lib/coordinates';
import {
  Badge,
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
  TableShell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

type EditorMode = 'closed' | 'create' | 'edit';

export function NewslettersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const editorRef = useRef<NewsletterEditorHandle>(null);
  const openedFromQueryRef = useRef<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const section =
    tabParam === 'remitentes' || tabParam === 'campanas' ? tabParam : 'boletines';

  const SCOPE_LABEL: Record<string, string> = {
    shared: 'Org / Boletines',
    malichimp: 'MALICHIMP',
    internal_communications: 'Campañas internas',
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newsletters, setNewsletters] = useState<NewsletterListItemDto[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [senders, setSenders] = useState<EmailSenderDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

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

  const load = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const [nextPage, nextSenders] = await Promise.all([
        api.listNewsletters({ page, pageSize: 50 }),
        api.listEmailSenders().catch(() => [] as EmailSenderDto[]),
      ]);
      setNewsletters(nextPage.items);
      setListPage(nextPage.page);
      setListTotalPages(nextPage.totalPages);
      setSenders(nextSenders);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar boletines');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(listPage);
  }, [listPage, load]);

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
      await load(listPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(n: NewsletterListItemDto, publish: boolean) {
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
      await load(listPage);
      toast.success(publish ? 'Boletín publicado' : 'Pasó a borrador');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(n: NewsletterListItemDto) {
    const ok = await confirm({
      title: `¿Eliminar el boletín “${n.title}”?`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteNewsletter(n.id);
      if (editingId === n.id) closeEditor();
      await load(listPage);
      toast.success('Boletín eliminado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  async function handleDuplicate(n: NewsletterListItemDto) {
    setDuplicatingId(n.id);
    try {
      const draft = await api.duplicateNewsletter(n.id);
      await load(listPage);
      toast.success('Boletín duplicado como borrador');
      await openEdit(draft.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo duplicar');
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campañas y Boletines"
        description="Hub global: biblioteca org, registro de campañas y remitentes por módulo. Las campañas se operan en MALICHIMP o Usuarios Workspace."
        actions={
          mode === 'closed' && section === 'boletines' ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-1 size-4" />
              Nuevo boletín org
            </Button>
          ) : mode !== 'closed' ? (
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
          ) : null
        }
      />

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      {mode === 'closed' ? (
        <Tabs
          value={section}
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams);
            if (value === 'boletines') next.delete('tab');
            else next.set('tab', value);
            setSearchParams(next, { replace: true });
          }}
        >
          <TabsList>
            <TabsTrigger value="boletines">
              <Newspaper className="size-4" aria-hidden />
              Boletines
            </TabsTrigger>
            <TabsTrigger value="campanas">
              <Mail className="size-4" aria-hidden />
              Campañas
            </TabsTrigger>
            <TabsTrigger value="remitentes">
              <Mail className="size-4" aria-hidden />
              Remitentes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campanas" className="mt-6">
            <NewsletterCampaignsRegistry />
          </TabsContent>

          <TabsContent value="remitentes" className="mt-6">
            <EmailSendersPanel hubMode senders={senders} onChange={setSenders} />
          </TabsContent>

          <TabsContent value="boletines" className="mt-6 space-y-6">
            {loading ? (
              <TableShellSkeleton rows={4} cols={5} />
            ) : newsletters.length === 0 ? (
              <EmptyState
                title="Sin boletines"
                description="Crea el primero con el editor visual drag & drop."
              />
            ) : (
              <TableShell>
                <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px] max-w-[280px]">Título</TableHead>
                    <TableHead className="w-[120px]">Módulo</TableHead>
                    <TableHead className="w-[180px] max-w-[180px]">Slug</TableHead>
                    <TableHead className="w-[120px]">Marca</TableHead>
                    <TableHead className="w-[150px]">Estado</TableHead>
                    <TableHead className="w-[1%] whitespace-nowrap text-right">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newsletters.map((n) => {
                    const isShared = (n.scope ?? 'shared') === 'shared';
                    return (
                    <TableRow key={n.id}>
                      <TableCell className="max-w-[280px]">
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
                      <TableCell>
                        <Badge variant="outline">
                          {SCOPE_LABEL[n.scope ?? 'shared'] ?? n.scope}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate font-mono text-sm"
                        title={n.slug}
                      >
                        {n.slug}
                      </TableCell>
                      <TableCell>
                        {n.brand ? NEWSLETTER_BRAND_LABELS[n.brand] : '—'}
                      </TableCell>
                      <TableCell>
                        {isShared ? (
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
                        ) : (
                          <span className="text-sm text-muted-foreground">Biblioteca módulo</span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        {isShared ? (
                        <>
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
                          variant="ghost"
                          onClick={() => void handleDuplicate(n)}
                          disabled={duplicatingId === n.id}
                          title="Duplicar"
                        >
                          {duplicatingId === n.id ? (
                            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                        {n.status === 'published' ? (
                          <Button size="sm" variant="ghost" asChild>
                            <a
                              href={`/n/${n.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir URL pública"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleDelete(n)}
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        </>
                        ) : n.scope === 'malichimp' ? (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/admin/malichimp?tab=content&edit=${encodeURIComponent(n.id)}`}>
                              Abrir en MALICHIMP
                            </a>
                          </Button>
                        ) : n.scope === 'internal_communications' ? (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/admin/users?tab=contenido&edit=${encodeURIComponent(n.id)}`}>
                              Abrir en Contenido
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Solo lectura</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                  })}
                  </TableBody>
                </Table>
              </TableShell>
            )}
            {listTotalPages > 1 ? (
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={listPage <= 1 || loading}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {listPage} de {listTotalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={listPage >= listTotalPages || loading}
                  onClick={() =>
                    setListPage((p) => Math.min(listTotalPages, p + 1))
                  }
                >
                  Siguiente
                </Button>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      ) : null}

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
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="subject">Asunto del correo</Label>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setSubject((current) =>
                        `${current}${current && !/\s$/.test(current) ? ' ' : ''}${NEWSLETTER_FIRST_NAME_MERGE_TAG}`,
                      )
                    }
                  >
                    + {NEWSLETTER_FIRST_NAME_MERGE_TAG}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setSubject((current) =>
                        `${current}${current && !/\s$/.test(current) ? ' ' : ''}${NEWSLETTER_LAST_NAME_MERGE_TAG}`,
                      )
                    }
                  >
                    + {NEWSLETTER_LAST_NAME_MERGE_TAG}
                  </Button>
                </div>
              </div>
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-xs text-muted-foreground">
              En el panel izquierdo usa la categoría <strong>MALI</strong>:
              cabecera, columnas, color por marca (Museo / Cursos / Extensión),
              CTA entradas u outline, redes y pie
              {brand
                ? `. Con marca ${NEWSLETTER_BRAND_LABELS[brand]} también aparecen su header y footer.`
                : '.'}{' '}
              Selecciona un elemento y cambia color / alineación en Estilos a la
              derecha. Para el saludo personalizado al enviar, usa{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                {NEWSLETTER_FIRST_NAME_MERGE_TAG}
              </code>{' '}
              y{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                {NEWSLETTER_LAST_NAME_MERGE_TAG}
              </code>
              ; si el contacto no tiene nombre, se envía como estimado(a).
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {(
                [
                  ['Nombre', NEWSLETTER_FIRST_NAME_MERGE_TAG],
                  ['Apellidos', NEWSLETTER_LAST_NAME_MERGE_TAG],
                ] as const
              ).map(([label, tag]) => (
                <Button
                  key={tag}
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const ok = editorRef.current?.insertNameMergeTag(tag);
                    if (ok) {
                      toast.success(`Se insertó «${label}» (${tag}) en el boletín`);
                    } else {
                      toast.error('No se pudo insertar la variable en el editor');
                    }
                  }}
                >
                  Insertar {tag}
                </Button>
              ))}
            </div>
          </div>

          <NewsletterEditor
            key={`${editorKey}-${brand ?? 'none'}`}
            ref={editorRef}
            initialDesignJson={initialDesignJson}
            initialHtml={initialHtml}
            brand={brand}
            assetScope={slug.trim() || editingId || 'library'}
          />
        </div>
      ) : null}
    </div>
  );
}
