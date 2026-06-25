import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { ShortLinkDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

type Tab = 'url' | 'file';

export function LinksPage() {
  const [tab, setTab] = useState<Tab>('url');
  const [url, setUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ShortLinkDto | null>(null);
  const [links, setLinks] = useState<ShortLinkDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLinks = useCallback(async () => {
    try {
      const data = await api.listLinks();
      setLinks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar enlaces');
    }
  }, []);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  async function handleShorten(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.shortenUrl(url, customSlug || undefined);
      setResult(data);
      await loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al acortar');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.uploadFile(file, customSlug || undefined);
      setResult(data);
      setFile(null);
      await loadLinks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir archivo');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este enlace?')) return;
    try {
      await api.deleteLink(id);
      await loadLinks();
      if (result?.id === id) setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <div>
      <h2 className="mb-2 text-2xl font-bold">Enlaces y QR</h2>
      <p className="mb-6 text-sm text-muted">
        Acorta URLs, genera QR y comparte archivos vía S3
      </p>

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
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
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
            <Button type="submit" disabled={loading}>
              {loading ? 'Procesando...' : 'Acortar y generar QR'}
            </Button>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={handleUpload}>
            <input
              type="file"
              className="text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <Input
              placeholder="Slug personalizado (opcional)"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value)}
            />
            <Button type="submit" disabled={loading || !file}>
              {loading ? 'Subiendo...' : 'Subir a S3 y generar QR'}
            </Button>
          </form>
        )}
      </Card>

      {result && (
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
            <div className="flex-1 space-y-2 text-sm">
              <p>
                <span className="text-muted">Corta: </span>
                <a
                  href={result.shortUrl}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.shortUrl}
                </a>
                <Button
                  className="ml-2"
                  variant="outline"
                  onClick={() => copyText(result.shortUrl)}
                >
                  Copiar
                </Button>
              </p>
              <p className="break-all">
                <span className="text-muted">Destino: </span>
                {result.targetUrl}
              </p>
              <a
                href={api.qrUrl(result.id)}
                className="text-primary underline"
                download={`qr-${result.slug}.png`}
              >
                Descargar QR PNG
              </a>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="p-4">Slug</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Destino</th>
              <th className="p-4">Clicks</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr key={link.id} className="border-b border-border/60">
                <td className="p-4">
                  <a
                    href={link.shortUrl}
                    className="text-primary underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.slug}
                  </a>
                </td>
                <td className="p-4">{link.type}</td>
                <td className="max-w-xs truncate p-4" title={link.targetUrl}>
                  {link.fileName ?? link.targetUrl}
                </td>
                <td className="p-4">{link.clickCount}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copyText(link.shortUrl)}
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
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
