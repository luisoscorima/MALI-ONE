import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { GoogleWorkspaceUser } from '@mali-one/shared';
import { api } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui';

export function AdminUsersPage() {
  const [users, setUsers] = useState<GoogleWorkspaceUser[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  const loadUsers = useCallback(async (q?: string, pageToken?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listWorkspaceUsers(q, pageToken);
      setUsers((prev) => (pageToken ? [...prev, ...data.users] : data.users));
      setNextPageToken(data.nextPageToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers(search);
  }, [loadUsers, search]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
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
      await loadUsers(search);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear usuario');
    }
  }

  async function handleReset(email: string) {
    if (!confirm(`¿Resetear contraseña de ${email}?`)) return;
    try {
      const result = await api.resetWorkspacePassword(email);
      setTempPassword(result.temporaryPassword);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al resetear');
    }
  }

  async function handleSuspend(email: string) {
    if (!confirm(`¿Suspender ${email}?`)) return;
    try {
      await api.suspendWorkspaceUser(email);
      await loadUsers(search);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al suspender');
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Usuarios Workspace</h2>
          <p className="text-sm text-muted">Gestión manual vía Google Admin SDK</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Crear usuario</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {tempPassword && (
        <div className="mb-4 rounded-lg border border-success/50 bg-success/10 px-4 py-3 text-sm">
          Contraseña temporal: <strong>{tempPassword}</strong>
          <button
            type="button"
            className="ml-4 underline"
            onClick={() => setTempPassword(null)}
          >
            Cerrar
          </button>
        </div>
      )}

      <Card className="mb-6">
        <form
          className="flex gap-2"
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
          <Button type="submit">Buscar</Button>
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
              <Button type="submit">Guardar</Button>
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

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="p-4">Email</th>
              <th className="p-4">Nombre</th>
              <th className="p-4">OU</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border/60">
                <td className="p-4">{u.primaryEmail}</td>
                <td className="p-4">
                  {u.name.givenName} {u.name.familyName}
                </td>
                <td className="p-4">{u.orgUnitPath}</td>
                <td className="p-4">
                  {u.suspended ? (
                    <span className="text-danger">Suspendido</span>
                  ) : (
                    <span className="text-success">Activo</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
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
        </table>
        {loading && <p className="p-4 text-muted">Cargando...</p>}
        {nextPageToken && !loading && (
          <div className="p-4">
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
