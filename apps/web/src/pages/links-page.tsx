import { FormEvent, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Copy, Download, FileSpreadsheet, Pencil, QrCode, Trash2 } from 'lucide-react';
import type { QrStyleDto, ShortLinkDto, UpdateShortLinkDto } from '@mali-one/shared';
import { DEFAULT_QR_STYLE } from '@mali-one/shared';
import { FilterChip, IconActionButton } from '@/components/icon-action-button';
import { api } from '@/lib/api';
import { formatLinkDestination } from '@/lib/format-link';
import { downloadLinksExcel } from '@/lib/links-export';
import {
  formatTagsInput,
  parseTagsInput,
  parseWhatsappTarget,
} from '@/lib/parse-tags';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { LinksBulkFileUpload, LinksBulkImport } from '@/components/links-bulk-import';
import { PageHeader } from '@/components/page-header';
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';

const QrDesignerPanel = lazy(() =>
  import('@/components/qr-designer-panel').then((m) => ({
    default: m.QrDesignerPanel,
  })),
);
const LinkStatsPanel = lazy(() =>
  import('@/components/link-stats-panel').then((m) => ({
    default: m.LinkStatsPanel,
  })),
);

type Tab = 'url' | 'file' | 'whatsapp';

interface EditLinkState {
  link: ShortLinkDto;
  url: string;
  phone: string;
  text: string;
  tags: string;
  saving: boolean;
}

function TagsField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-sm text-muted">
        Etiquetas (opcional, separadas por coma)
      </span>
      <Input
        id={id}
        placeholder="campana, ventas, qr-flyer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1 text-xs text-muted">
        Minúsculas, números, guiones y guiones bajos. Máx. 10 etiquetas.
      </p>
    </label>
  );
}

export function LinksPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappText, setWhatsappText] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tagSearch, setTagSearch] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [file, setFile] = useState<File | null>(null);
  const [links, setLinks] = useState<ShortLinkDto[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 25;
  const [listLoading, setListLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [qrModalLink, setQrModalLink] = useState<ShortLinkDto | null>(null);
  const [qrModalSavedStyle, setQrModalSavedStyle] = useState<QrStyleDto | null>(
    null,
  );
  const [editLink, setEditLink] = useState<EditLinkState | null>(null);
  const [statsLink, setStatsLink] = useState<ShortLinkDto | null>(null);
  const [defaultQrStyle, setDefaultQrStyle] = useState<QrStyleDto>({
    ...DEFAULT_QR_STYLE,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkQrFormat, setBulkQrFormat] = useState<'png' | 'svg'>('png');
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [excelExporting, setExcelExporting] = useState(false);
  const listRequestId = useRef(0);

  const loadDefaultQrStyle = useCallback(async () => {
    try {
      const style = await api.getQrDefaultStyle();
      setDefaultQrStyle(style);
    } catch {
      setDefaultQrStyle({ ...DEFAULT_QR_STYLE });
    }
  }, []);

  useEffect(() => {
    void loadDefaultQrStyle();
  }, [loadDefaultQrStyle]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tagFilter, typeFilter]);

  function openQrDesigner(link: ShortLinkDto) {
    setQrModalSavedStyle(link.qrStyle ?? defaultQrStyle);
    setQrModalLink(link);
  }

  function closeQrDesigner() {
    setQrModalLink(null);
    setQrModalSavedStyle(null);
  }

  const loadLinks = useCallback(async () => {
    const requestId = ++listRequestId.current;
    setListLoading(true);
    setError('');
    try {
      const data = await api.listLinks({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        tag: tagFilter || undefined,
        type: typeFilter,
      });
      if (requestId !== listRequestId.current) return;
      setLinks(data.items);
      setAllTags(data.tags);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.totalPages > 0 && page > data.totalPages) {
        setPage(data.totalPages);
      }
    } catch (e) {
      if (requestId !== listRequestId.current) return;
      const msg = e instanceof Error ? e.message : 'Error al cargar enlaces';
      setError(msg);
      toast.error(msg);
    } finally {
      if (requestId === listRequestId.current) setListLoading(false);
    }
  }, [debouncedSearch, page, tagFilter, toast, typeFilter]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  function getTagsFromInput() {
    const tags = parseTagsInput(tagsInput);
    return tags.length ? tags : undefined;
  }

  async function handleShorten(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.shortenUrl(
        url,
        customSlug || undefined,
        getTagsFromInput(),
      );
      setUrl('');
      setCustomSlug('');
      setTagsInput('');
      await loadLinks();
      toast.success('Enlace acortado correctamente');
      openQrDesigner(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al acortar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWhatsapp(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api.createWhatsappLink(
        whatsappPhone,
        whatsappText || undefined,
        customSlug || undefined,
        getTagsFromInput(),
      );
      setWhatsappPhone('');
      setWhatsappText('');
      setCustomSlug('');
      setTagsInput('');
      await loadLinks();
      toast.success('Enlace de WhatsApp creado correctamente');
      openQrDesigner(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear enlace de WhatsApp';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await api.uploadFile(
        file,
        customSlug || undefined,
        getTagsFromInput(),
      );
      setFile(null);
      setCustomSlug('');
      setTagsInput('');
      await loadLinks();
      toast.success('Archivo subido correctamente');
      openQrDesigner(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al subir archivo';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(link: ShortLinkDto) {
    if (link.type === 'WHATSAPP') {
      const { phone, text } = parseWhatsappTarget(link.targetUrl);
      setEditLink({
        link,
        url: '',
        phone,
        text,
        tags: formatTagsInput(link.tags),
        saving: false,
      });
      return;
    }

    setEditLink({
      link,
      url: link.type === 'URL' ? link.targetUrl : '',
      phone: '',
      text: '',
      tags: formatTagsInput(link.tags),
      saving: false,
    });
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editLink) return;

    setEditLink((current) => (current ? { ...current, saving: true } : null));
    setError('');

    const body: UpdateShortLinkDto = {
      tags: parseTagsInput(editLink.tags),
    };

    if (editLink.link.type === 'WHATSAPP') {
      body.phone = editLink.phone;
      body.text = editLink.text;
    } else if (editLink.link.type === 'URL') {
      body.url = editLink.url;
    }

    try {
      await api.updateLink(editLink.link.id, body);
      toast.success('Enlace actualizado (URL corta y QR sin cambios)');
      setEditLink(null);
      await loadLinks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al actualizar enlace';
      setError(msg);
      toast.error(msg);
      setEditLink((current) => (current ? { ...current, saving: false } : null));
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '¿Eliminar este enlace?',
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteLink(id);
      if (qrModalLink?.id === id) closeQrDesigner();
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
      toast.success('Enlace eliminado');
      await loadLinks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al eliminar';
      setError(msg);
      toast.error(msg);
    }
  }

  async function copyText(text: string, label = 'Enlace') {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado al portapapeles`);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  }

  function toggleLinkSelection(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllVisibleLinks(visibleIds: string[]) {
    setSelectedIds((prev) => {
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return [...new Set([...prev, ...visibleIds])];
    });
  }

  function getExportTargets(visibleLinks: ShortLinkDto[]) {
    if (selectedIds.length > 0) {
      return visibleLinks.filter((link) => selectedIds.includes(link.id));
    }
    return visibleLinks;
  }

  async function handleBulkQrDownload(visibleLinks: ShortLinkDto[]) {
    const targets = getExportTargets(visibleLinks);
    if (targets.length === 0) {
      toast.error('No hay enlaces para descargar');
      return;
    }
    if (targets.length > 50) {
      toast.error('Máximo 50 QR por descarga. Reduce la selección.');
      return;
    }
    setBulkDownloading(true);
    try {
      await api.downloadQrBulk(
        targets.map((link) => link.id),
        bulkQrFormat,
      );
      toast.success(`ZIP con ${targets.length} QR descargado`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al descargar QR';
      toast.error(msg);
    } finally {
      setBulkDownloading(false);
    }
  }

  function handleExcelExport(visibleLinks: ShortLinkDto[]) {
    const targets = getExportTargets(visibleLinks);
    if (targets.length === 0) {
      toast.error('No hay enlaces para exportar');
      return;
    }
    setExcelExporting(true);
    try {
      downloadLinksExcel(targets);
      toast.success(
        `Excel con ${targets.length} enlace${targets.length === 1 ? '' : 's'} descargado`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al exportar Excel';
      toast.error(msg);
    } finally {
      setExcelExporting(false);
    }
  }

  function handleQrSaved(updated: ShortLinkDto) {
    setQrModalLink(updated);
    setQrModalSavedStyle(updated.qrStyle ?? defaultQrStyle);
    void loadLinks();
  }

  const normalizedTagSearch = tagSearch.trim().toLocaleLowerCase();
  const visibleTags = allTags.filter((tag) =>
    tag.toLocaleLowerCase().includes(normalizedTagSearch),
  );
  const hasFilters = !!(debouncedSearch || tagFilter || typeFilter !== 'all');
  const visibleSelectedCount = links.filter((link) => selectedIds.includes(link.id)).length;
  const hiddenSelectedCount = selectedIds.length - visibleSelectedCount;
  function resetFilters() {
    setSearch('');
    setTagSearch('');
    setTagFilter('');
    setTypeFilter('all');
  }
  const exportTargets = getExportTargets(links);
  const exportScopeLabel =
    selectedIds.length > 0
      ? hiddenSelectedCount > 0
        ? `${visibleSelectedCount} visibles · ${hiddenSelectedCount} ocultos (no se exportan)`
        : `Exportar ${visibleSelectedCount} seleccionados`
      : `Exportar visibles: ${exportTargets.length}`;

  return (
    <div>
      <PageHeader
        title="Enlaces y QR"
        description="Acorta URLs, crea enlaces de WhatsApp, genera códigos QR y comparte archivos vía S3"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        className="mb-6"
      >
        <TabsList className="w-fit">
          <TabsTrigger value="url" className="flex-none px-4">
            URL
          </TabsTrigger>
          <TabsTrigger value="file" className="flex-none px-4">
            Archivo
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-none px-4">
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {error && (
          <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
        )}

        <TabsContent value="url">
          <Card className="mb-6">
          <form className="grid gap-3" onSubmit={handleShorten}>
            <label className="grid gap-2 text-sm">
              <span>URL de destino</span>
              <Input
                placeholder="https://ejemplo.com/pagina"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Identificador personalizado (opcional)</span>
              <Input
                placeholder="ej. mi-campana"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
              />
            </label>
            <TagsField
              id="tags-url"
              value={tagsInput}
              onChange={setTagsInput}
            />
            <Button type="submit" className="w-fit" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Procesando...
                </span>
              ) : (
                'Acortar y generar QR'
              )}
            </Button>
          </form>
          <div className="mt-4">
            <LinksBulkImport
              mode="url"
              disabled={submitting}
              onSuccess={() => void loadLinks()}
            />
          </div>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card className="mb-6">
          <form className="grid gap-3" onSubmit={handleWhatsapp}>
            <label className="grid gap-2 text-sm">
              <span>Número de WhatsApp con código de país</span>
              <Input
                placeholder="Número con código de país (ej. 51987654321 o +51 987 654 321)"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-muted">
                Mensaje prellenado (opcional)
              </span>
              <Textarea
                placeholder="Hola, me gustaría obtener más información..."
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                rows={4}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Identificador personalizado (opcional)</span>
              <Input
                placeholder="ej. mi-campana"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
              />
            </label>
            <TagsField
              id="tags-whatsapp"
              value={tagsInput}
              onChange={setTagsInput}
            />
            <Button type="submit" className="w-fit" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Procesando...
                </span>
              ) : (
                'Crear enlace y generar QR'
              )}
            </Button>
          </form>
          <div className="mt-4">
            <LinksBulkImport
              mode="whatsapp"
              disabled={submitting}
              onSuccess={() => void loadLinks()}
            />
          </div>
          </Card>
        </TabsContent>

        <TabsContent value="file">
          <Card className="mb-6">
          <form className="grid gap-3" onSubmit={handleUpload}>
            <label className="block">
              <span className="mb-2 block text-sm text-muted">
                Seleccionar archivo
              </span>
              <input
                type="file"
                className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-primary-foreground"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span>Identificador personalizado (opcional)</span>
              <Input
                placeholder="ej. mi-campana"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
              />
            </label>
            <TagsField
              id="tags-file"
              value={tagsInput}
              onChange={setTagsInput}
            />
            <Button type="submit" className="w-fit" disabled={submitting || !file}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Subiendo...
                </span>
              ) : (
                'Subir a S3 y generar QR'
              )}
            </Button>
          </form>
          <div className="mt-4 space-y-4">
            <LinksBulkImport
              mode="file-urls"
              disabled={submitting}
              onSuccess={() => void loadLinks()}
            />
            <LinksBulkFileUpload
              disabled={submitting}
              onSuccess={() => void loadLinks()}
            />
          </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Historial</h3>
            {allTags.length > 0 && (
              <div className="min-w-0 flex-1">
                <Input
                  type="search"
                  aria-label="Buscar etiquetas"
                  placeholder="Buscar etiquetas"
                  value={tagSearch}
                  onChange={(event) => setTagSearch(event.target.value)}
                  className="mb-2 ml-auto max-w-xs"
                />
                <div className="flex max-h-24 flex-wrap items-center gap-1.5 overflow-y-auto">
                  <FilterChip active={!tagFilter} onClick={() => setTagFilter('')}>
                    Todos
                  </FilterChip>
                  {visibleTags.map((tag) => (
                  <FilterChip
                    key={tag}
                    active={tagFilter === tag}
                    onClick={() => setTagFilter(tag)}
                  >
                    #{tag}
                  </FilterChip>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="grid min-w-0 flex-1 basis-64 gap-1 text-sm">
              Buscar enlaces
              <Input type="search" placeholder="Enlace, destino, archivo o etiqueta" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <div className="grid gap-1 text-sm">
              <label htmlFor="link-type-filter">Tipo</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="link-type-filter" className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="URL">URL</SelectItem>
                  <SelectItem value="FILE">Archivo</SelectItem>
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasFilters && <Button type="button" variant="ghost" onClick={resetFilters}>Restablecer filtros</Button>}
          </div>
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {listLoading ? 'Cargando enlaces…' : `${links.length} de ${total} enlaces`}
          </p>
          {(links.length > 0 || selectedIds.length > 0) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted">{exportScopeLabel}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={excelExporting || bulkDownloading || exportTargets.length === 0}
                onClick={() => handleExcelExport(links)}
              >
                {excelExporting ? (
                  <>
                    <Spinner className="size-3.5" />
                    Exportando…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="size-3.5" />
                    Excel
                  </>
                )}
              </Button>
              <Select
                value={bulkQrFormat}
                onValueChange={(value) =>
                  setBulkQrFormat(value as 'png' | 'svg')
                }
                disabled={bulkDownloading || excelExporting}
              >
                <SelectTrigger aria-label="Formato de descarga de QR" className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="png">PNG</SelectItem>
                  <SelectItem value="svg">SVG</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={
                  bulkDownloading ||
                  excelExporting ||
                  exportTargets.length === 0 ||
                  exportTargets.length > 50
                }
                onClick={() => void handleBulkQrDownload(links)}
              >
                {bulkDownloading ? (
                  <>
                    <Spinner className="size-3.5" />
                    Generando ZIP…
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    Descargar QR
                  </>
                )}
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={bulkDownloading || excelExporting}
                  onClick={() => setSelectedIds([])}
                >
                  Limpiar selección
                </Button>
              )}
              {exportTargets.length > 50 && (
                <span className="text-xs text-destructive">
                  Máximo 50 QR por descarga
                </span>
              )}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="text-muted">
                <TableHead className="w-10 p-4">
                  <Checkbox
                    checked={
                      links.length > 0 &&
                      links.every((link) =>
                        selectedIds.includes(link.id),
                      )
                        ? true
                        : links.some((link) =>
                              selectedIds.includes(link.id),
                            )
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={() =>
                      toggleAllVisibleLinks(links.map((l) => l.id))
                    }
                    aria-label="Seleccionar todos los visibles"
                    disabled={listLoading || links.length === 0}
                  />
                </TableHead>
                <TableHead className="p-4">Identificador</TableHead>
                <TableHead className="p-4">Tipo</TableHead>
                <TableHead className="p-4">Etiquetas</TableHead>
                <TableHead className="p-4">Destino</TableHead>
                <TableHead className="p-4">Clics</TableHead>
                <TableHead className="p-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            {listLoading ? (
              <TableBody>
                <TableSkeleton rows={4} cols={7} />
              </TableBody>
            ) : links.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      title={hasFilters ? 'Sin coincidencias' : 'Sin enlaces todavía'}
                      description={
                        hasFilters
                          ? 'Prueba otra búsqueda o restablece los filtros.'
                          : 'Acorta una URL, crea un enlace de WhatsApp o sube un archivo para empezar.'
                      }
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {links.map((link) => {
                  const dest = formatLinkDestination(link);
                  return (
                    <TableRow key={link.id} className="border-border/60">
                      <TableCell className="p-4">
                        <Checkbox
                          checked={selectedIds.includes(link.id)}
                          onCheckedChange={() => toggleLinkSelection(link.id)}
                          aria-label={`Seleccionar ${link.slug}`}
                        />
                      </TableCell>
                      <TableCell className="p-4">
                        <a
                          href={link.shortUrl}
                          className="font-medium text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {link.slug}
                        </a>
                      </TableCell>
                      <TableCell className="p-4">
                        <span
                          className={
                            link.type === 'FILE'
                              ? 'rounded bg-primary/15 px-2 py-0.5 text-xs text-primary'
                              : link.type === 'WHATSAPP'
                                ? 'rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400'
                                : 'rounded bg-border px-2 py-0.5 text-xs'
                          }
                        >
                          {link.type === 'FILE' ? 'Archivo' : link.type === 'WHATSAPP' ? 'WhatsApp' : 'URL'}
                        </span>
                      </TableCell>
                      <TableCell className="p-4">
                        {link.tags.length > 0 ? (
                          <div className="flex max-w-[10rem] flex-wrap gap-1">
                            {link.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs hover:border-primary/40 hover:bg-muted/50"
                                aria-pressed={tagFilter === tag}
                                onClick={() => setTagFilter(tag)}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs p-4" title={dest.secondary ?? dest.primary}>
                        <p className="truncate font-medium">{dest.primary}</p>
                        {dest.secondary && (
                          <p className="truncate text-xs text-muted">
                            {dest.secondary}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="p-4">
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => setStatsLink(link)}
                        >
                          {link.clickCount}
                        </button>
                      </TableCell>
                      <TableCell className="p-4">
                        <div className="flex items-center gap-1">
                          <IconActionButton
                            label="Estadísticas"
                            onClick={() => setStatsLink(link)}
                          >
                            <BarChart3 className="size-4" />
                          </IconActionButton>
                          <IconActionButton
                            label="Editar"
                            onClick={() => openEdit(link)}
                          >
                            <Pencil className="size-4" />
                          </IconActionButton>
                          <IconActionButton
                            label="Ver QR"
                            onClick={() => openQrDesigner(link)}
                          >
                            <QrCode className="size-4" />
                          </IconActionButton>
                          <IconActionButton
                            label="Copiar enlace"
                            onClick={() => void copyText(link.shortUrl)}
                          >
                            <Copy className="size-4" />
                          </IconActionButton>
                          <IconActionButton
                            label="Eliminar"
                            variant="danger"
                            onClick={() => void handleDelete(link.id)}
                          >
                            <Trash2 className="size-4" />
                          </IconActionButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            )}
          </Table>
        </div>
        {!listLoading && (totalPages > 1 || total > pageSize) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <span className="text-sm text-muted">
              Página {totalPages === 0 ? 0 : page} de {Math.max(1, totalPages)} · {total} enlaces
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog
        open={!!editLink}
        onOpenChange={(open) => {
          if (!open) setEditLink(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar enlace</DialogTitle>
            <DialogDescription>
              El identificador, URL corta y QR no cambian. Solo se actualiza el destino y
              las etiquetas.
            </DialogDescription>
          </DialogHeader>

          {editLink && (
              <form className="grid gap-3" onSubmit={handleSaveEdit}>
                {editLink.link.type === 'WHATSAPP' && (
                  <>
                    <label className="grid gap-2 text-sm">
                      <span>Número de WhatsApp con código de país</span>
                      <Input
                        placeholder="Número con código de país"
                        value={editLink.phone}
                        onChange={(e) =>
                          setEditLink((current) =>
                            current
                              ? { ...current, phone: e.target.value }
                              : null,
                          )
                        }
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm text-muted">
                        Mensaje prellenado
                      </span>
                      <Textarea
                        value={editLink.text}
                        onChange={(e) =>
                          setEditLink((current) =>
                            current
                              ? { ...current, text: e.target.value }
                              : null,
                          )
                        }
                        rows={4}
                      />
                    </label>
                  </>
                )}

                {editLink.link.type === 'URL' && (
                  <label className="grid gap-2 text-sm">
                    <span>URL de destino</span>
                    <Input
                      placeholder="https://ejemplo.com/pagina"
                      value={editLink.url}
                      onChange={(e) =>
                        setEditLink((current) =>
                          current ? { ...current, url: e.target.value } : null,
                        )
                      }
                      required
                    />
                  </label>
                )}

                {editLink.link.type === 'FILE' && (
                  <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted">
                    Archivo: {editLink.link.fileName ?? editLink.link.slug}. Solo
                    puedes editar las etiquetas.
                  </p>
                )}

                <TagsField
                  id="edit-tags"
                  value={editLink.tags}
                  onChange={(value) =>
                    setEditLink((current) =>
                      current ? { ...current, tags: value } : null,
                    )
                  }
                />

                <p className="text-xs text-muted">
                  Enlace corto:{' '}
                  <span className="font-medium">{editLink.link.shortUrl}</span>
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" className="w-fit" disabled={editLink.saving}>
                    {editLink.saving ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" /> Guardando...
                      </span>
                    ) : (
                      'Guardar cambios'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditLink(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!qrModalLink}
        onOpenChange={(open) => {
          if (!open) closeQrDesigner();
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,900px)] w-[min(calc(100vw-2rem),56rem)] max-w-none flex-col overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 px-4 pt-4">
            <DialogTitle>Código QR personalizable</DialogTitle>
            {qrModalLink && (
              <DialogDescription className="break-all">
                {qrModalLink.shortUrl}
                {' · '}
                Personaliza el diseño y pulsa «Guardar diseño» para aplicarlo.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
            {qrModalLink && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-16">
                    <Spinner className="size-6" />
                  </div>
                }
              >
                <QrDesignerPanel
                  key={qrModalLink.id}
                  shortUrl={qrModalLink.shortUrl}
                  style={qrModalLink.qrStyle ?? defaultQrStyle}
                  savedStyle={qrModalSavedStyle ?? defaultQrStyle}
                  initialPreview={qrModalLink.qrBase64}
                  onChange={(style) =>
                    setQrModalLink((current) =>
                      current ? { ...current, qrStyle: style } : null,
                    )
                  }
                  linkId={qrModalLink.id}
                  onSaved={handleQrSaved}
                />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!statsLink}
        onOpenChange={(open) => {
          if (!open) setStatsLink(null);
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,900px)] w-[min(calc(100vw-2rem),48rem)] max-w-none flex-col overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 px-4 pt-4">
            <DialogTitle>Estadísticas del enlace</DialogTitle>
            <DialogDescription>
              Clics y escaneos por día, dispositivos y navegadores
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
            {statsLink && (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-16">
                    <Spinner className="size-6" />
                  </div>
                }
              >
                <LinkStatsPanel linkId={statsLink.id} slug={statsLink.slug} />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
