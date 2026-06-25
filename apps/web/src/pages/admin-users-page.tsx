import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { GoogleWorkspaceUser } from '@mali-one/shared';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import { Button, Card, Input } from '@/components/ui';

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<GoogleWorkspaceUser[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [form, setForm] = useState({
    primaryEmail: '',
    givenName: '',
    familyName: '',
    password: '',
    orgUnitPath: '/',
  });

  const loadUsers = useCallback(
    async (q?: string, pageToken?: string) => {
      setLoading(true);
      if (!pageToken) setError('');
      try {
        const data = await api.listWorkspaceUsers(q, pageToken);
        setUsers((prev) => (pageToken ? [...prev, ...data.users] : data.users));
        setNextPageToken(data.nextPageToken);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al cargar usuarios';
        setError(msg);
        if (!pageToken) toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadUsers(search);
  }, [loadUsers, search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createWorkspaceUser(form);
      setShowCreate(false);
      setForm({
        primaryEmail: '',
        givenName: '',
        familyName: '',
        password: '',
        orgUnitPath: '/',
      });
      toast.success('Usuario creado en Workspace');
      await loadUsers(search);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear usuario';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(email: string) {
    if (!confirm(`¿Resetear contraseña de ${email}?`)) return;
    try {
      const result = await api.resetWorkspacePassword(email);
      setTempPassword(result.temporaryPassword);
      toast.success('Contraseña temporal generada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al resetear';
      setError(msg);
      toast.error(msg);
    }
  }

  async function copyPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success('Contraseña copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  async function handleSuspend(email: string) {
    if (!confirm(`¿Suspender ${email}?`)) return;
    try {
      await api.suspendWorkspaceUser(email);
      toast.success('Usuario suspendido');
      await loadUsers(search);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al suspender';
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuarios Workspace"
        description="Gestión manual vía Google Admin SDK"
        actions={
          <Button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancelar' : 'Crear usuario'}
          </Button>
        }
      />

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      {tempPassword && (
        <AlertBanner variant="success" onDismiss={() => setTempPassword(null)}>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Contraseña temporal:{' '}
              <strong className="font-mono">{tempPassword}</strong>
            </span>
            <Button variant="outline" onClick={() => void copyPassword()}>
              Copiar
            </Button>
          </div>
        </AlertBanner>
      )}

      <Card className="mb-6">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
          }}
        >
          <Input
            placeholder="Buscar por email o nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" className="shrink-0">
            Buscar
          </Button>
        </form>
      </Card>

      {showCreate && (
        <Card className="mb-6">
          <h3 className="mb-4 font-semibold">Nuevo usuario</h3>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreate}>
            <Input
              placeholder="email@mali.pe"
              value={form.primaryEmail}
              onChange={(e) =>
                setForm({ ...form, primaryEmail: e.target.value })
              }
              required
            />
            <Input
              placeholder="Unidad organizativa (ej. /)"
              value={form.orgUnitPath}
              onChange={(e) =>
                setForm({ ...form, orgUnitPath: e.target.value })
              }
            />
            <Input
              placeholder="Nombre"
              value={form.givenName}
              onChange={(e) => setForm({ ...form, givenName: e.target.value })}
              required
            />
            <Input
              placeholder="Apellido"
              value={form.familyName}
              onChange={(e) =>
                setForm({ ...form, familyName: e.target.value })
              }
              required
            />
            <Input
              className="md:col-span-2"
              type="password"
              placeholder="Contraseña temporal"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" /> Guardando...
                  </span>
                ) : (
                  'Guardar'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="p-4">Email</th>
                <th className="p-4">Nombre</th>
                <th className="p-4">OU</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            {loading && users.length === 0 ? (
              <TableSkeleton rows={6} cols={5} />
            ) : users.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="No se encontraron usuarios"
                      description="Prueba otra búsqueda o crea un usuario nuevo."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="p-4">{u.primaryEmail}</td>
                    <td className="p-4">
                      {u.name.givenName} {u.name.familyName}
                    </td>
                    <td className="p-4 text-muted">{u.orgUnitPath}</td>
                    <td className="p-4">
                      {u.suspended ? (
                        <span className="rounded bg-danger/15 px-2 py-0.5 text-xs text-danger">
                          Suspendido
                        </span>
                      ) : (
                        <span className="rounded bg-success/15 px-2 py-0.5 text-xs text-success">
                          Activo
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => void handleReset(u.primaryEmail)}
                        >
                          Reset pass
                        </Button>
                        {!u.suspended && (
                          <Button
                            variant="danger"
                            onClick={() => void handleSuspend(u.primaryEmail)}
                          >
                            Suspender
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {loading && users.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border p-4 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Cargando...
          </div>
        )}
        {nextPageToken && !loading && (
          <div className="border-t border-border p-4">
            <Button
              variant="outline"
              onClick={() => void loadUsers(search, nextPageToken)}
            >
              Cargar más
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
