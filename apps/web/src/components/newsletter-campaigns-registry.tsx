import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { AlertBanner, EmptyState, TableShellSkeleton } from '@/components/feedback';
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
  dateStyle: 'medium',
  timeStyle: 'short',
});

const AREA_LABEL: Record<string, string> = {
  malichimp: 'MALICHIMP',
  internal_workspace: 'Campañas internas',
  pam: 'Legacy PAM',
};

function deepLinkFor(audienceArea: string, campaignId: string): string | null {
  if (audienceArea === 'malichimp') {
    return `/admin/malichimp?tab=campaigns&campaign=${encodeURIComponent(campaignId)}`;
  }
  if (audienceArea === 'internal_workspace') {
    return `/admin/users?tab=campanas&campaign=${encodeURIComponent(campaignId)}`;
  }
  return null;
}

type Row = Awaited<ReturnType<typeof api.listNewsletterCampaignRegistry>>[number];

export function NewsletterCampaignsRegistry() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await api.listNewsletterCampaignRegistry());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el registro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <TableShellSkeleton rows={4} cols={6} />;
  if (error) return <AlertBanner variant="error">{error}</AlertBanner>;
  if (!rows.length) {
    return (
      <EmptyState
        title="Sin campañas"
        description="Registro global vacío. Las campañas se crean y operan en MALICHIMP o Usuarios Workspace."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Vista de solo lectura. Para editar o enviar, abre la campaña en su módulo.
      </p>
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Destinatarios</TableHead>
              <TableHead>Actualizado</TableHead>
              <TableHead className="w-[1%] text-right">Abrir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = deepLinkFor(row.audienceArea, row.id);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="truncate text-xs text-muted-foreground" title={row.subjectSnapshot}>
                      {row.subjectSnapshot}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {AREA_LABEL[row.audienceArea] ?? row.audienceArea}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell className="tabular-nums">
                    {row.sentCount}/{row.totalRecipients}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {df.format(new Date(row.updatedAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    {href ? (
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <a href={href}>
                          <ExternalLink className="size-4" aria-hidden />
                          Módulo
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableShell>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Actualizando…
        </div>
      ) : null}
    </div>
  );
}
