import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react';
import type { NewsletterDto } from '@mali-one/shared';
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
  Textarea,
} from '@/components/ui';

type BlockType = 'heading' | 'paragraph' | 'image' | 'button' | 'divider';

type Block = {
  id: string;
  type: BlockType;
  text?: string;
  url?: string;
  label?: string;
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function blocksToHtml(blocks: Block[]): string {
  const parts = blocks.map((b) => {
    switch (b.type) {
      case 'heading':
        return `<h1 style="font-family:Georgia,serif;font-size:28px;color:#111;margin:0 0 16px">${escapeHtml(b.text || '')}</h1>`;
      case 'paragraph':
        return `<p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#333;margin:0 0 16px">${escapeHtml(b.text || '').replace(/\n/g, '<br/>')}</p>`;
      case 'image':
        return b.url
          ? `<p style="margin:0 0 16px"><img src="${escapeAttr(b.url)}" alt="" style="max-width:100%;height:auto"/></p>`
          : '';
      case 'button':
        return `<p style="margin:0 0 24px"><a href="${escapeAttr(b.url || '#')}" style="display:inline-block;background:#c41230;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px;font-family:Arial,sans-serif">${escapeHtml(b.label || 'Ver más')}</a></p>`;
      case 'divider':
        return `<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>`;
      default:
        return '';
    }
  });
  return `<div style="max-width:640px;margin:0 auto;padding:24px">${parts.join('\n')}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Título',
  paragraph: 'Párrafo',
  image: 'Imagen',
  button: 'Botón',
  divider: 'Separador',
};

export function NewslettersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newsletters, setNewsletters] = useState<NewsletterDto[]>([]);
  const [saving, setSaving] = useState(false);

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [blocks, setBlocks] = useState<Block[]>([
    { id: newId(), type: 'heading', text: 'Hola PAM' },
    {
      id: newId(),
      type: 'paragraph',
      text: 'Contenido del boletín. Arrastra bloques o edítalos abajo.',
    },
    {
      id: newId(),
      type: 'button',
      label: 'Visitar mali.pe',
      url: 'https://mali.pe',
    },
  ]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const htmlBody = useMemo(() => blocksToHtml(blocks), [blocks]);

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

  function addBlock(type: BlockType) {
    const base: Block = { id: newId(), type };
    if (type === 'heading') base.text = 'Nuevo título';
    if (type === 'paragraph') base.text = 'Nuevo párrafo';
    if (type === 'image') base.url = 'https://';
    if (type === 'button') {
      base.label = 'Botón';
      base.url = 'https://mali.pe';
    }
    setBlocks((prev) => [...prev, base]);
  }

  function moveBlock(from: number, to: number) {
    setBlocks((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleCreate() {
    setSaving(true);
    try {
      await api.createNewsletter({
        slug,
        title,
        subject,
        htmlBody,
        status,
      });
      toast.success('Boletín creado');
      setSlug('');
      setTitle('');
      setSubject('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear');
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

  async function copyUrl(slugValue: string) {
    const url = `${window.location.origin}/n/${slugValue}`;
    await navigator.clipboard.writeText(url);
    toast.success('URL copiada');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boletines"
        description="Crea boletines con bloques (arrastrar para reordenar), publícalos y comparte la URL. El envío masivo se hace desde CRM PAM."
      />

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <h3 className="font-semibold">Nuevo boletín</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="slug">Slug (URL /n/…)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="boletin-marzo-2026"
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
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="subject">Asunto del correo</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(BLOCK_LABELS) as BlockType[]).map((type) => (
              <Button
                key={type}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => addBlock(type)}
              >
                <Plus className="mr-1 size-3" />
                {BLOCK_LABELS[type]}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            {blocks.map((block, index) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === index) return;
                  moveBlock(dragIndex, index);
                  setDragIndex(null);
                }}
                className="cursor-grab rounded-md border border-border/80 bg-card p-3 active:cursor-grabbing"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {BLOCK_LABELS[block.type]}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => moveBlock(index, index - 1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => moveBlock(index, index + 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      onClick={() => removeBlock(block.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {block.type === 'heading' || block.type === 'paragraph' ? (
                  <Textarea
                    value={block.text ?? ''}
                    onChange={(e) =>
                      updateBlock(block.id, { text: e.target.value })
                    }
                    className="min-h-[72px]"
                  />
                ) : null}
                {block.type === 'image' ? (
                  <Input
                    value={block.url ?? ''}
                    onChange={(e) =>
                      updateBlock(block.id, { url: e.target.value })
                    }
                    placeholder="https://… imagen"
                  />
                ) : null}
                {block.type === 'button' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={block.label ?? ''}
                      onChange={(e) =>
                        updateBlock(block.id, { label: e.target.value })
                      }
                      placeholder="Texto del botón"
                    />
                    <Input
                      value={block.url ?? ''}
                      onChange={(e) =>
                        updateBlock(block.id, { url: e.target.value })
                      }
                      placeholder="https://…"
                    />
                  </div>
                ) : null}
                {block.type === 'divider' ? (
                  <p className="text-xs text-muted-foreground">
                    Línea horizontal
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <Button
            onClick={() => void handleCreate()}
            disabled={saving || !slug || !title || !subject || blocks.length === 0}
          >
            Guardar boletín
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-border/60 p-4">
          <h3 className="font-semibold">Vista previa</h3>
          <div
            className="min-h-[320px] rounded-md border border-border/40 bg-white p-4 text-black"
            dangerouslySetInnerHTML={{ __html: htmlBody }}
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : newsletters.length === 0 ? (
        <EmptyState
          title="Sin boletines"
          description="Crea el primero con el editor de bloques."
        />
      ) : (
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
                <TableCell className="space-x-2 text-right">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
