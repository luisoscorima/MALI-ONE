import { useCallback, useEffect, useState } from 'react';
import type { AppModule, AppUserDto } from '@mali-one/shared';
import { APP_MODULES } from '@/lib/app-modules';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

type DraftModules = Record<string, AppModule[]>;

const stickyUser =
  'sticky left-0 z-20 w-56 min-w-56 border-r border-border/60 bg-card p-4';
const stickyRole =
  'sticky left-56 z-20 border-r border-border/60 bg-card p-4';
const stickyActions =
  'sticky right-0 z-20 border-l border-border/60 bg-card p-4';

export function AppUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AppUserDto[]>([]);
  const [query, setQuery] = useState('');
  const [drafts, setDrafts] = useState<DraftModules>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppUsers();
      setUsers(data);
      setDrafts(
        Object.fromEntries(data.map((user) => [user.id, [...user.modules]])),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar usuarios';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  function toggleModule(userId: string, module: AppModule) {
    setDrafts((prev) => {
      const current = prev[userId] ?? [];
      const next = current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module];
      return { ...prev, [userId]: next };
    });
  }

  function hasChanges(user: AppUserDto) {
    const draft = drafts[user.id] ?? [];
    if (draft.length !== user.modules.length) return true;
    return draft.some((module) => !user.modules.includes(module));
  }

  async function saveModules(user: AppUserDto) {
    setSavingId(user.id);
    setError('');
    try {
      const updated = await api.updateAppUserModules(
        user.id,
        drafts[user.id] ?? [],
      );
      setUsers((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDrafts((prev) => ({ ...prev, [updated.id]: [...updated.modules] }));
      toast.success(`Accesos actualizados para ${user.email}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSavingId(null);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = normalizedQuery
    ? users.filter(
        (user) =>
          user.name.toLowerCase().includes(normalizedQuery) ||
          user.email.toLowerCase().includes(normalizedQuery),
      )
    : users;

  return (
    <div>
      <PageHeader
        title="Accesos MALI ONE"
        description="Los usuarios con cuenta @mali.pe inician sesión automáticamente. Aquí defines qué módulos ven en el menú. El administrador del sistema siempre tiene acceso completo."
      />

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      <Card className="mb-6 p-4">
        <Input
          placeholder="Buscar por nombre o email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <Table className="min-w-max w-full">
          <TableHeader>
            <TableRow className="text-muted">
              <TableHead className={stickyUser}>Usuario</TableHead>
              <TableHead className={stickyRole}>Rol</TableHead>
              {APP_MODULES.map((mod) => (
                <TableHead
                  key={mod.id}
                  title={mod.label}
                  className="h-auto max-w-[2.5rem] whitespace-normal px-1.5 py-3 text-center align-bottom"
                >
                  <span className="inline-block max-h-36 overflow-hidden text-ellipsis text-xs font-medium leading-tight [writing-mode:vertical-rl]">
                    {mod.label}
                  </span>
                </TableHead>
              ))}
              <TableHead className={stickyActions}>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          {loading ? (
            <TableBody>
              <TableSkeleton rows={5} cols={3 + APP_MODULES.length} />
            </TableBody>
          ) : filteredUsers.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={3 + APP_MODULES.length}>
                  <EmptyState
                    title={normalizedQuery ? 'Sin coincidencias' : 'Aún no hay usuarios'}
                    description={
                      normalizedQuery
                        ? 'Prueba con otro término de búsqueda.'
                        : 'Los usuarios aparecerán aquí después de su primer inicio de sesión con Google.'
                    }
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {filteredUsers.map((user) => {
                const isAdmin = user.role === 'admin';
                const draft = drafts[user.id] ?? user.modules;
                const changed = hasChanges(user);

                return (
                  <TableRow key={user.id} className="border-border/60">
                    <TableCell className={stickyUser}>
                      <div className="flex min-w-0 items-center gap-3">
                        {user.picture ? (
                          <img
                            src={user.picture}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-border text-sm">
                            {user.name[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{user.name}</p>
                          <p className="truncate text-muted">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={stickyRole}>
                      {isAdmin ? (
                        <Badge variant="secondary" className="bg-primary/15 text-primary">
                          Administrador
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Operador</Badge>
                      )}
                    </TableCell>
                    {APP_MODULES.map((mod) => (
                      <TableCell key={mod.id} className="px-1.5 py-4 text-center">
                        <Checkbox
                          checked={isAdmin ? true : draft.includes(mod.id)}
                          disabled={isAdmin || savingId === user.id}
                          onCheckedChange={() => toggleModule(user.id, mod.id)}
                          aria-label={`${mod.label} para ${user.email}`}
                        />
                      </TableCell>
                    ))}
                    <TableCell className={stickyActions}>
                      {isAdmin ? (
                        <span className="text-xs text-muted">Acceso total</span>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={!changed || savingId === user.id}
                          onClick={() => void saveModules(user)}
                        >
                          {savingId === user.id ? (
                            <span className="flex items-center gap-2">
                              <Spinner className="h-4 w-4" /> Guardando...
                            </span>
                          ) : (
                            'Guardar'
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          )}
        </Table>
      </Card>
    </div>
  );
}
