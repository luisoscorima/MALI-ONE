import { useCallback, useEffect, useState } from 'react';
import type { AppModule, AppUserDto } from '@mali-one/shared';
import { APP_MODULES } from '@/lib/app-modules';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { Button, Card } from '@/components/ui';

type DraftModules = Record<string, AppModule[]>;

export function AppUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AppUserDto[]>([]);
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

  return (
    <div>
      <PageHeader
        title="Accesos MALI ONE"
        description="Habilita qué módulos puede usar cada usuario de la plataforma"
      />

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      <Card className="mb-6">
        <p className="text-sm text-muted">
          Los usuarios con cuenta <strong>@mali.pe</strong> pueden iniciar sesión
          automáticamente. Aquí defines qué módulos ven en el menú y pueden usar.
          El administrador del sistema siempre tiene acceso completo.
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="p-4">Usuario</th>
                <th className="p-4">Rol</th>
                {APP_MODULES.map((mod) => (
                  <th key={mod.id} className="p-4 text-center">
                    {mod.label}
                  </th>
                ))}
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            {loading ? (
              <TableSkeleton
                rows={5}
                cols={3 + APP_MODULES.length}
              />
            ) : users.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={3 + APP_MODULES.length}>
                    <EmptyState
                      title="Aún no hay usuarios"
                      description="Los usuarios aparecerán aquí después de su primer inicio de sesión con Google."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {users.map((user) => {
                  const isAdmin = user.role === 'admin';
                  const draft = drafts[user.id] ?? user.modules;
                  const changed = hasChanges(user);

                  return (
                    <tr key={user.id} className="border-b border-border/60">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {user.picture ? (
                            <img
                              src={user.picture}
                              alt=""
                              className="h-9 w-9 rounded-full"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-border text-sm">
                              {user.name[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {isAdmin ? (
                          <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">
                            Administrador
                          </span>
                        ) : (
                          <span className="rounded bg-border px-2 py-0.5 text-xs text-muted">
                            Operador
                          </span>
                        )}
                      </td>
                      {APP_MODULES.map((mod) => (
                        <td key={mod.id} className="p-4 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border accent-primary"
                            checked={
                              isAdmin
                                ? true
                                : draft.includes(mod.id)
                            }
                            disabled={isAdmin || savingId === user.id}
                            onChange={() => toggleModule(user.id, mod.id)}
                            aria-label={`${mod.label} para ${user.email}`}
                          />
                        </td>
                      ))}
                      <td className="p-4">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
