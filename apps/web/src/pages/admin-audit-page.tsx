import { useCallback, useEffect, useState } from 'react';
import type { AdminAuditLogDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/format-bytes';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

const ACTION_LABELS: Record<string, string> = {
  CREATE_USER: 'Crear usuario',
  UPDATE_USER: 'Actualizar usuario',
  RESET_PASSWORD: 'Resetear contraseña',
  SIGN_OUT_USER: 'Cerrar sesiones',
  SUSPEND_USER: 'Suspender usuario',
  UPDATE_USER_MODULES: 'Actualizar accesos',
};

function describePayload(action: string, payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;

  if (action === 'RESET_PASSWORD') {
    const parts: string[] = [];
    if (data.forceChangePassword === true) parts.push('forzar cambio');
    if (data.forceChangePassword === false) parts.push('sin forzar cambio');
    if (data.signOutAfterReset) parts.push('sesiones cerradas');
    return parts.length ? parts.join(', ') : null;
  }

  if (action === 'CREATE_USER' && data.forceChangePassword === false) {
    return 'sin forzar cambio';
  }

  if (action === 'UPDATE_USER_MODULES' && Array.isArray(data.modules)) {
    return `${data.modules.length} módulo(s)`;
  }

  return null;
}

export function AdminAuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AdminAuditLogDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadLogs = useCallback(
    async (cursor?: string) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError('');
      }
      try {
        const data = await api.listAdminAuditLogs(cursor);
        setLogs((prev) => (cursor ? [...prev, ...data.logs] : data.logs));
        setNextCursor(data.nextCursor);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al cargar auditoría';
        setError(msg);
        if (!cursor) toast.error(msg);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div>
      <PageHeader
        title="Auditoría admin"
        description="Registro de acciones sobre usuarios Workspace y accesos MALI ONE"
      />

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow className="text-muted">
                <TableHead className="p-4">Fecha</TableHead>
                <TableHead className="p-4">Actor</TableHead>
                <TableHead className="p-4">Acción</TableHead>
                <TableHead className="p-4">Objetivo</TableHead>
                <TableHead className="p-4">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            {loading && logs.length === 0 ? (
              <TableBody>
                <TableSkeleton rows={8} cols={5} />
              </TableBody>
            ) : logs.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      title="Sin registros"
                      description="Las acciones administrativas aparecerán aquí."
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {logs.map((log) => {
                  const detail = describePayload(log.action, log.payload);
                  return (
                    <TableRow key={log.id} className="border-border/60">
                      <TableCell className="p-4 whitespace-nowrap text-muted">
                        {formatDate(log.createdAt)}
                      </TableCell>
                      <TableCell className="p-4">{log.actorEmail}</TableCell>
                      <TableCell className="p-4">
                        <Badge variant="secondary">
                          {ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-4 text-muted">
                        {log.targetEmail ?? '—'}
                      </TableCell>
                      <TableCell className="p-4 text-sm text-muted">
                        {detail ?? '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            )}
          </Table>
        </div>
        {nextCursor && (
          <div className="border-t border-border p-4">
            <Button
              variant="outline"
              disabled={loadingMore}
              onClick={() => void loadLogs(nextCursor)}
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Cargando...
                </span>
              ) : (
                'Cargar más'
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
