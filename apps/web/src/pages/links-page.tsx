import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { ShortLinkDto, UpdateShortLinkDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { formatLinkDestination } from '@/lib/format-link';
import {
  formatTagsInput,
  parseTagsInput,
  parseWhatsappTarget,
} from '@/lib/parse-tags';
import { useToast } from '@/contexts/toast-context';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { Button, Card, Input } from '@/components/ui';

type Tab = 'url' | 'file' | 'whatsapp';

interface QrPreview {
  link: ShortLinkDto;
  objectUrl: string;
  loading?: boolean;
}

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
        Tags (opcional, separados por coma)
      </span>
      <Input
        id={id}
        placeholder="campana, ventas, qr-flyer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1 text-xs text-muted">
        Minúsculas, números, guiones y guiones bajos. Máx. 10 tags.
      </p>
    </label>
  );
}

export function LinksPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappText, setWhatsappText] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ShortLinkDto | null>(null);
  const [links, setLinks] = useState<ShortLinkDto[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [qrPreview, setQrPreview] = useState<QrPreview | null>(null);
  const [editLink, setEditLink] = useState<EditLinkState | null>(null);

  const loadLinks = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const data = await api.listLinks();
      setLinks(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar enlaces';
      setError(msg);
      toast.error(msg);
    } finally {
      setListLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  useEffect(() => {
    if (!qrPreview) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeQrPreview();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [qrPreview]);

  useEffect(() => {
    if (!editLink) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setEditLink(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editLink]);

  function getTagsFromInput() {
    const tags = parseTagsInput(tagsInput);
    return tags.length ? tags : undefined;
  }

  async function handleShorten(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const data = await api.shortenUrl(
        url,
        customSlug || undefined,
        getTagsFromInput(),
      );
      setResult(data);
      setUrl('');
      setCustomSlug('');
      setTagsInput('');
      toast.success('Enlace acortado correctamente');
      await loadLinks();
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
    setResult(null);
    try {
      const data = await api.createWhatsappLink(
        whatsappPhone,
        whatsappText || undefined,
        customSlug || undefined,
        getTagsFromInput(),
      );
      setResult(data);
      setWhatsappPhone('');
      setWhatsappText('');
      setCustomSlug('');
      setTagsInput('');
      toast.success('Enlace de WhatsApp creado correctamente');
      await loadLinks();
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
    setResult(null);
    try {
      const data = await api.uploadFile(
        file,
        customSlug || undefined,
        getTagsFromInput(),
      );
      setResult(data);
      setFile(null);
      setCustomSlug('');
      setTagsInput('');
      toast.success('Archivo subido y QR generado');
      await loadLinks();
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
      const updated = await api.updateLink(editLink.link.id, body);
      if (result?.id === updated.id) setResult(updated);
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
    if (!confirm('¿Eliminar este enlace?')) return;
    try {
      await api.deleteLink(id);
      if (result?.id === id) setResult(null);
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

  function closeQrPreview() {
    setQrPreview((current) => {
      if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
  }

  async function handleRegenerateQr(link: ShortLinkDto) {
    setError('');
    if (qrPreview?.objectUrl) URL.revokeObjectURL(qrPreview.objectUrl);
    setQrPreview({ link, objectUrl: '', loading: true });
    try {
      const objectUrl = await api.fetchLinkQrObjectUrl(link.id);
      setQrPreview({ link, objectUrl });
      toast.success('QR regenerado');
    } catch (e) {
      setQrPreview(null);
      const msg = e instanceof Error ? e.message : 'Error al generar el QR';
      setError(msg);
      toast.error(msg);
    }
  }

  useEffect(() => {
    return () => {
      if (qrPreview?.objectUrl) URL.revokeObjectURL(qrPreview.objectUrl);
    };
  }, [qrPreview?.objectUrl]);

  const resultDest = result ? formatLinkDestination(result) : null;
  const allTags = [...new Set(links.flatMap((link) => link.tags))].sort();
  const filteredLinks = tagFilter
    ? links.filter((link) => link.tags.includes(tagFilter))
    : links;

  return (
    <div>
      <PageHeader
        title="Enlaces y QR"
        description="Acorta URLs, crea enlaces de WhatsApp, genera códigos QR y comparte archivos vía S3"
      />

      <div className="mb-6 flex gap-2">
        <Button
          variant={tab === 'url' ? 'default' : 'outline'}
          onClick={() => setTab('url')}
        >
          URL
        </Button>
        <Button
          variant={tab === 'file' ? 'default' : 'outline'}
          onClick={() => setTab('file')}
        >
          Archivo
        </Button>
        <Button
          variant={tab === 'whatsapp' ? 'default' : 'outline'}
          onClick={() => setTab('whatsapp')}
        >
          WhatsApp
        </Button>
      </div>

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      <Card className="mb-6">
        {tab === 'url' ? (
          <form className="grid gap-3" onSubmit={handleShorten}>
            <Input
              placeholder="https://ejemplo.com/pagina"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <Input
              placeholder="Slug personalizado (opcional)"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
            />
            <TagsField
              id="tags-url"
              value={tagsInput}
              onChange={setTagsInput}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Procesando...
                </span>
              ) : (
                'Acortar y generar QR'
              )}
            </Button>
          </form>
        ) : tab === 'whatsapp' ? (
          <form className="grid gap-3" onSubmit={handleWhatsapp}>
            <Input
              placeholder="Número con código de país (ej. 51987654321 o +51 987 654 321)"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              required
            />
            <label className="block">
              <span className="mb-2 block text-sm text-muted">
                Mensaje prellenado (opcional)
              </span>
              <textarea
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Hola, me gustaría obtener más información..."
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                rows={4}
              />
            </label>
            <Input
              placeholder="Slug personalizado (opcional)"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
            />
            <TagsField
              id="tags-whatsapp"
              value={tagsInput}
              onChange={setTagsInput}
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Procesando...
                </span>
              ) : (
                'Crear enlace y generar QR'
              )}
            </Button>
          </form>
        ) : (
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
            <Input
              placeholder="Slug personalizado (opcional)"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
            />
            <TagsField
              id="tags-file"
              value={tagsInput}
              onChange={setTagsInput}
            />
            <Button type="submit" disabled={submitting || !file}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Subiendo...
                </span>
              ) : (
                'Subir a S3 y generar QR'
              )}
            </Button>
          </form>
        )}
      </Card>

      {result && resultDest && (
        <Card className="mb-6">
          <h3 className="mb-4 font-semibold">Resultado</h3>
          <div className="flex flex-wrap gap-6">
            {result.qrBase64 && (
              <img
                src={result.qrBase64}
                alt="QR"
                className="h-40 w-40 rounded-lg bg-white p-2"
              />
            )}
            <div className="min-w-0 flex-1 space-y-3 text-sm">
              <div>
                <p className="mb-1 text-muted">Enlace corto</p>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={result.shortUrl}
                    className="break-all text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {result.shortUrl}
                  </a>
                  <Button
                    variant="outline"
                    onClick={() => void copyText(result.shortUrl)}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1 text-muted">Destino</p>
                <p className="font-medium">{resultDest.primary}</p>
                {resultDest.secondary && (
                  <p className="mt-1 text-xs text-muted">{resultDest.secondary}</p>
                )}
              </div>
              {result.tags.length > 0 && (
                <div>
                  <p className="mb-1 text-muted">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {result.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-border px-2 py-0.5 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <a
                href={api.qrUrl(result.id)}
                className="inline-block text-primary underline"
                download={`qr-${result.slug}.png`}
              >
                Descargar QR PNG
              </a>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Historial</h3>
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={tagFilter ? 'outline' : 'default'}
                  onClick={() => setTagFilter('')}
                >
                  Todos
                </Button>
                {allTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={tagFilter === tag ? 'default' : 'outline'}
                    onClick={() => setTagFilter(tag)}
                  >
                    #{tag}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="p-4">Slug</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Destino</th>
                <th className="p-4">Clicks</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            {listLoading ? (
              <TableSkeleton rows={4} cols={6} />
            ) : filteredLinks.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title={tagFilter ? 'Sin enlaces con ese tag' : 'Sin enlaces todavía'}
                      description={
                        tagFilter
                          ? 'Prueba otro tag o quita el filtro.'
                          : 'Acorta una URL, crea un enlace de WhatsApp o sube un archivo para empezar.'
                      }
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {filteredLinks.map((link) => {
                  const dest = formatLinkDestination(link);
                  return (
                    <tr key={link.id} className="border-b border-border/60">
                      <td className="p-4">
                        <a
                          href={link.shortUrl}
                          className="font-medium text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {link.slug}
                        </a>
                      </td>
                      <td className="p-4">
                        <span
                          className={
                            link.type === 'FILE'
                              ? 'rounded bg-primary/15 px-2 py-0.5 text-xs text-primary'
                              : link.type === 'WHATSAPP'
                                ? 'rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400'
                                : 'rounded bg-border px-2 py-0.5 text-xs'
                          }
                        >
                          {link.type}
                        </span>
                      </td>
                      <td className="p-4">
                        {link.tags.length > 0 ? (
                          <div className="flex max-w-[10rem] flex-wrap gap-1">
                            {link.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                className="rounded bg-border px-2 py-0.5 text-xs hover:bg-border/70"
                                onClick={() => setTagFilter(tag)}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="max-w-xs p-4" title={dest.secondary ?? dest.primary}>
                        <p className="truncate font-medium">{dest.primary}</p>
                        {dest.secondary && (
                          <p className="truncate text-xs text-muted">
                            {dest.secondary}
                          </p>
                        )}
                      </td>
                      <td className="p-4">{link.clickCount}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => openEdit(link)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleRegenerateQr(link)}
                          >
                            Ver QR
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void copyText(link.shortUrl)}
                          >
                            Copiar
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => void handleDelete(link.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </Card>

      {editLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEditLink(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full max-w-lg">
              <h3 id="edit-dialog-title" className="mb-1 font-semibold">
                Editar enlace
              </h3>
              <p className="mb-4 text-sm text-muted">
                El slug, URL corta y QR no cambian. Solo se actualiza el destino
                y los tags.
              </p>

              <form className="grid gap-3" onSubmit={handleSaveEdit}>
                {editLink.link.type === 'WHATSAPP' && (
                  <>
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
                    <label className="block">
                      <span className="mb-2 block text-sm text-muted">
                        Mensaje prellenado
                      </span>
                      <textarea
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
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
                )}

                {editLink.link.type === 'FILE' && (
                  <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted">
                    Archivo: {editLink.link.fileName ?? editLink.link.slug}. Solo
                    puedes editar los tags.
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
                  <Button type="submit" disabled={editLink.saving}>
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
            </Card>
          </div>
        </div>
      )}

      {qrPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeQrPreview}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="w-full max-w-md">
              <h3 id="qr-dialog-title" className="mb-1 font-semibold">
                Código QR
              </h3>
              <p className="mb-4 break-all text-sm text-muted">
                {qrPreview.link.shortUrl}
              </p>

              <div className="mb-4 flex justify-center">
                {qrPreview.loading ? (
                  <div className="flex h-48 w-48 items-center justify-center gap-2 text-sm text-muted">
                    <Spinner /> Generando...
                  </div>
                ) : (
                  <img
                    src={qrPreview.objectUrl}
                    alt={`QR ${qrPreview.link.slug}`}
                    className="h-48 w-48 rounded-lg bg-white p-2"
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={qrPreview.loading}
                  onClick={() => void handleRegenerateQr(qrPreview.link)}
                >
                  Regenerar QR
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void copyText(qrPreview.link.shortUrl)}
                >
                  Copiar enlace
                </Button>
                {!qrPreview.loading && (
                  <a
                    href={qrPreview.objectUrl}
                    download={`qr-${qrPreview.link.slug}.png`}
                    className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-border/40"
                  >
                    Descargar PNG
                  </a>
                )}
                <Button variant="outline" onClick={closeQrPreview}>
                  Cerrar
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
