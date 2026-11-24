import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Pencil, RefreshCw } from 'lucide-react';
import { AlertBanner } from '@/components/feedback';
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
} from '@/components/ui';

const df = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short',
  timeStyle: 'short',
});

type ContentRow = {
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
  contentRevision: string;
  campaign: { id: string; name: string; status: string } | null;
  campaignStatusLabel: string;
  editable: boolean;
};

export function MalichimpContentPanel({
  onOpenCampaign,
  onNewCampaign,
}: {
  onOpenCampaign?: (campaignId: string) => void;
  onNewCampaign?: () => void;
}) {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await api.listMalichimpContent());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el contenido');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Contenido de campañas</h2>
          <p className="text-sm text-muted-foreground">
            Edita el contenido utilizado en campañas MALICHIMP. La biblioteca compartida y los
            remitentes se administran en Boletines.
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
          {onNewCampaign ? (
            <Button type="button" size="sm" onClick={onNewCampaign}>
              Nueva campaña
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contenido</TableHead>
              <TableHead>Campaña</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última modificación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Cargando…
                  </span>
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.subject}</p>
                  </TableCell>
                  <TableCell>{row.campaign?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.campaignStatusLabel}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {df.format(new Date(row.updatedAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {row.editable ? (
                        <Button type="button" size="sm" variant="outline" asChild>
                          <a
                            href={`/admin/malichimp?tab=content&edit=${encodeURIComponent(row.id)}`}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Editar contenido
                          </a>
                        </Button>
                      ) : null}
                      {row.campaign ? (
                        <>
                          {onOpenCampaign ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onOpenCampaign(row.campaign!.id)}
                            >
                              <ExternalLink className="size-4" aria-hidden />
                              Abrir campaña
                            </Button>
                          ) : null}
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <a
                              href={`/api/malichimp/campaigns/${encodeURIComponent(row.campaign.id)}/view`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Vista previa
                            </a>
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No hay contenido de campañas. Crea una campaña a partir de un boletín publicado
                  en Boletines, o duplica una campaña existente.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}
