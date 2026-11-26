import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { NewsletterBrand } from '@mali-one/shared';
import { NEWSLETTER_BRAND_LABELS } from '@mali-one/shared';
import { AlertBanner } from '@/components/feedback';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { api } from '@/lib/api';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui';

const df = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

type ContentRow = {
  id: string;
  title: string;
  subject: string;
  brand: NewsletterBrand | null;
  updatedAt: string;
  contentRevision: string;
  usedInCampaigns: number;
  editable: boolean;
};

export function MalichimpContentPanel({
  onNewContent,
  onEditContent,
}: {
  onNewContent?: () => void;
  onEditContent?: (contentId: string) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await api.listMalichimpContent());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los boletines');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function duplicateRow(row: ContentRow) {
    setBusyId(row.id);
    try {
      const created = await api.duplicateMalichimpContent(row.id);
      toast.success('Boletín duplicado');
      await load();
      onEditContent?.(created.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo duplicar');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteRow(row: ContentRow) {
    const ok = await confirm({
      title: `¿Eliminar “${row.title}”?`,
      description: row.usedInCampaigns
        ? 'Este boletín ya se usó en campañas y no se puede eliminar.'
        : 'Se eliminará del catálogo de MALICHIMP.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    if (row.usedInCampaigns) {
      toast.error('Este boletín ya fue usado en una campaña');
      return;
    }
    setBusyId(row.id);
    try {
      await api.deleteMalichimpContent(row.id);
      toast.success('Boletín eliminado');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Boletines</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de correos de MALICHIMP. Crea y edita piezas aquí; al armar una campaña se
            copia una versión editable. Los remitentes del módulo están en la pestaña Remitentes;
            el hub Campañas y Boletines ve el inventario global.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Actualizar
          </Button>
          {onNewContent ? (
            <Button type="button" size="sm" onClick={onNewContent}>
              <Plus className="size-4" aria-hidden />
              Nuevo boletín
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-56 max-w-56">Boletín</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Campañas</TableHead>
              <TableHead>Última modificación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Cargando…
                  </span>
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="w-56 max-w-56">
                    <div className="w-56 max-w-56">
                      <p className="truncate font-medium" title={row.title}>
                        {row.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={row.subject}>
                        {row.subject}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.brand ? NEWSLETTER_BRAND_LABELS[row.brand] : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Disponible</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {row.usedInCampaigns || '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {df.format(new Date(row.updatedAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() => onEditContent?.(row.id)}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Editar
                      </Button>
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <a
                          href={`/api/malichimp/content/${encodeURIComponent(row.id)}/view`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Vista previa
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === row.id}
                        onClick={() => void duplicateRow(row)}
                      >
                        <Copy className="size-4" aria-hidden />
                        Duplicar
                      </Button>
                      {row.usedInCampaigns > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled
                                  aria-disabled
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                  Eliminar
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              No se puede eliminar porque forma parte del historial de una campaña.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === row.id}
                          onClick={() => void deleteRow(row)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No hay boletines todavía. Crea el primero para usarlo en campañas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
