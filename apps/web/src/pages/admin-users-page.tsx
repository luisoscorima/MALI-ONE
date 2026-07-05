import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, LogOut, Pencil } from 'lucide-react';
import type { GoogleWorkspaceUser } from '@mali-one/shared';
import { GoogleAdminIcon, IconActionButton } from '@/components/icon-action-button';
import { api } from '@/lib/api';
import { googleAdminUserSecurityUrl } from '@/lib/google-admin-console';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Button,
  Card,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

export function AdminUsersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<GoogleWorkspaceUser[]>([]);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<GoogleWorkspaceUser | null>(
    null,
  );
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    primaryEmail: '',
    givenName: '',
    familyName: '',
    password: '',
    orgUnitPath: '/',
  });

  const [editForm, setEditForm] = useState({
    primaryEmail: '',
    givenName: '',
    familyName: '',
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
    const ok = await confirm({
      title: `¿Resetear contraseña de ${email}?`,
      confirmLabel: 'Resetear',
    });
    if (!ok) return;
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

  function startEdit(user: GoogleWorkspaceUser) {
    setShowCreate(false);
    setEditingUser(user);
    setEditForm({
      primaryEmail: user.primaryEmail,
      givenName: user.name.givenName,
      familyName: user.name.familyName,
      orgUnitPath: user.orgUnitPath,
    });
  }

  function cancelEdit() {
    setEditingUser(null);
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    const emailChanged =
      editForm.primaryEmail.trim() !== editingUser.primaryEmail;
    if (emailChanged) {
      const ok = await confirm({
        title: '¿Renombrar cuenta de correo?',
        description: `¿Renombrar ${editingUser.primaryEmail} a ${editForm.primaryEmail}? El correo anterior quedará como alias. El cambio puede tardar varios minutos.`,
        confirmLabel: 'Renombrar',
      });
      if (!ok) return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.updateWorkspaceUser(editingUser.primaryEmail, {
        primaryEmail: emailChanged ? editForm.primaryEmail.trim() : undefined,
        givenName: editForm.givenName.trim(),
        familyName: editForm.familyName.trim(),
        orgUnitPath: editForm.orgUnitPath.trim(),
      });
      setEditingUser(null);
      toast.success(
        emailChanged ? 'Usuario actualizado (correo renombrado)' : 'Usuario actualizado',
      );
      await loadUsers(search);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al actualizar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSuspend(email: string) {
    const ok = await confirm({
      title: `¿Suspender ${email}?`,
      confirmLabel: 'Suspender',
      variant: 'destructive',
    });
    if (!ok) return;
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

  async function handleReactivate(email: string) {
    const ok = await confirm({
      title: `¿Reactivar ${email}?`,
      confirmLabel: 'Reactivar',
    });
    if (!ok) return;
    try {
      await api.updateWorkspaceUser(email, { suspended: false });
      toast.success('Usuario reactivado');
      await loadUsers(search);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al reactivar';
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleSignOut(email: string) {
    const ok = await confirm({
      title: `¿Cerrar todas las sesiones de ${email}?`,
      description: 'Deberá volver a iniciar sesión en todos sus dispositivos.',
      confirmLabel: 'Cerrar sesiones',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.signOutWorkspaceUser(email);
      toast.success('Sesiones cerradas');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cerrar sesiones';
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleToggleActive(user: GoogleWorkspaceUser, active: boolean) {
    setTogglingStatus(user.primaryEmail);
    try {
      if (active) {
        await handleReactivate(user.primaryEmail);
      } else {
        await handleSuspend(user.primaryEmail);
      }
    } finally {
      setTogglingStatus(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuarios Workspace"
        description="Gestión manual vía Google Admin SDK"
        actions={
          <Button
            onClick={() => {
              setEditingUser(null);
              setShowCreate((v) => !v);
            }}
          >
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

      {editingUser && (
        <Card className="mb-6">
          <h3 className="mb-1 font-semibold">Editar usuario</h3>
          <p className="mb-4 text-sm text-muted">
            Cuenta actual: <strong>{editingUser.primaryEmail}</strong>
          </p>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleUpdate}>
            <Input
              placeholder="email@mali.pe"
              value={editForm.primaryEmail}
              onChange={(e) =>
                setEditForm({ ...editForm, primaryEmail: e.target.value })
              }
              required
            />
            <Input
              placeholder="Unidad organizativa (ej. /)"
              value={editForm.orgUnitPath}
              onChange={(e) =>
                setEditForm({ ...editForm, orgUnitPath: e.target.value })
              }
              required
            />
            <Input
              placeholder="Nombre"
              value={editForm.givenName}
              onChange={(e) =>
                setEditForm({ ...editForm, givenName: e.target.value })
              }
              required
            />
            <Input
              placeholder="Apellido"
              value={editForm.familyName}
              onChange={(e) =>
                setEditForm({ ...editForm, familyName: e.target.value })
              }
              required
            />
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" /> Guardando...
                  </span>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

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
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="text-muted">
                <TableHead className="p-4">Email</TableHead>
                <TableHead className="p-4">Nombre</TableHead>
                <TableHead className="p-4">OU</TableHead>
                <TableHead className="p-4">Estado</TableHead>
                <TableHead className="p-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            {loading && users.length === 0 ? (
              <TableBody>
                <TableSkeleton rows={6} cols={5} />
              </TableBody>
            ) : users.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      title="No se encontraron usuarios"
                      description="Prueba otra búsqueda o crea un usuario nuevo."
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : (
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-border/60">
                    <TableCell className="p-4">{u.primaryEmail}</TableCell>
                    <TableCell className="p-4">
                      {u.name.givenName} {u.name.familyName}
                    </TableCell>
                    <TableCell className="p-4 text-muted">{u.orgUnitPath}</TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!u.suspended}
                          disabled={togglingStatus === u.primaryEmail}
                          onCheckedChange={(active) =>
                            void handleToggleActive(u, active)
                          }
                          aria-label={
                            u.suspended
                              ? `Reactivar ${u.primaryEmail}`
                              : `Suspender ${u.primaryEmail}`
                          }
                        />
                        <span className="text-xs text-muted">
                          {u.suspended ? 'Inactivo' : 'Activo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-1">
                        <IconActionButton
                          label="Editar usuario"
                          onClick={() => startEdit(u)}
                        >
                          <Pencil className="size-4" />
                        </IconActionButton>
                        <IconActionButton
                          label="Resetear contraseña"
                          onClick={() => void handleReset(u.primaryEmail)}
                        >
                          <KeyRound className="size-4" />
                        </IconActionButton>
                        <IconActionButton
                          label="Cerrar sesiones"
                          onClick={() => void handleSignOut(u.primaryEmail)}
                        >
                          <LogOut className="size-4" />
                        </IconActionButton>
                        <IconActionButton
                          label="Abrir en Google Admin"
                          href={googleAdminUserSecurityUrl(u.id)}
                        >
                          <GoogleAdminIcon />
                        </IconActionButton>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </Table>
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
