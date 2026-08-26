import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, LogOut, Pencil, RefreshCw } from 'lucide-react';
import type { GoogleWorkspaceUser } from '@mali-one/shared';
import { GoogleAdminIcon, IconActionButton } from '@/components/icon-action-button';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format-bytes';
import { googleAdminUserSecurityUrl } from '@/lib/google-admin-console';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import { AlertBanner, EmptyState, Spinner, TableSkeleton } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

const TEMP_PASSWORD_TTL_MS = 90_000;

export function AdminUsersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<GoogleWorkspaceUser[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPassword, setGeneratingPassword] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForceChange, setCreateForceChange] = useState(true);
  const [googleAdminHealth, setGoogleAdminHealth] = useState<
    'loading' | 'ok' | 'error'
  >('loading');
  const [googleAdminError, setGoogleAdminError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<GoogleWorkspaceUser | null>(
    null,
  );
  const [tempPassword, setTempPassword] = useState<{
    email: string;
    password: string;
    forceChange: boolean;
  } | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetForceChange, setResetForceChange] = useState(true);
  const [resetSignOut, setResetSignOut] = useState(false);
  const [resetting, setResetting] = useState(false);
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
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void loadUsers(debouncedQuery);
  }, [loadUsers, debouncedQuery]);

  useEffect(() => {
    void api
      .getGoogleAdminHealth()
      .then((result) => {
        setGoogleAdminHealth(result.ok ? 'ok' : 'error');
        setGoogleAdminError(result.error ?? null);
      })
      .catch(() => {
        setGoogleAdminHealth('error');
        setGoogleAdminError('No se pudo verificar la conexión');
      });
  }, []);

  useEffect(() => {
    if (!tempPassword) return;
    const timer = setTimeout(() => setTempPassword(null), TEMP_PASSWORD_TTL_MS);
    return () => clearTimeout(timer);
  }, [tempPassword]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createWorkspaceUser({
        ...form,
        forceChangePassword: createForceChange,
      });
      setShowCreate(false);
      setCreateForceChange(true);
      setForm({
        primaryEmail: '',
        givenName: '',
        familyName: '',
        password: '',
        orgUnitPath: '/',
      });
      toast.success('Usuario creado en Workspace');
      await loadUsers(debouncedQuery);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear usuario';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function openResetDialog(email: string) {
    setResetForceChange(true);
    setResetSignOut(false);
    setResetTarget(email);
  }

  function closeResetDialog() {
    if (resetting) return;
    setResetTarget(null);
  }

  async function confirmReset() {
    if (!resetTarget) return;
    setResetting(true);
    setError('');
    try {
      const result = await api.resetWorkspacePassword(resetTarget, {
        forceChangePassword: resetForceChange,
        signOutAfterReset: resetSignOut,
      });
      setTempPassword({
        email: resetTarget,
        password: result.temporaryPassword,
        forceChange: result.forceChangePassword,
      });
      setResetTarget(null);
      toast.success('Contraseña generada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al resetear';
      setError(msg);
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  }

  async function copyPassword() {
    if (!tempPassword) return;
    try {
      const text = [
        'https://accounts.google.com/',
        tempPassword.email,
        tempPassword.password,
      ].join('\n');
      await navigator.clipboard.writeText(text);
      toast.success('Acceso copiado al portapapeles');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  async function handleGeneratePassword() {
    setGeneratingPassword(true);
    try {
      const result = await api.generateWorkspacePassword();
      setForm((prev) => ({ ...prev, password: result.password }));
      toast.success('Contraseña generada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al generar');
    } finally {
      setGeneratingPassword(false);
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
      await loadUsers(debouncedQuery);
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
      await loadUsers(debouncedQuery);
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
      await loadUsers(debouncedQuery);
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
          <div className="flex flex-wrap items-center gap-2">
            {googleAdminHealth === 'loading' ? (
              <Badge variant="secondary">Verificando Google Admin…</Badge>
            ) : googleAdminHealth === 'ok' ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                Google Admin conectado
              </Badge>
            ) : (
              <Badge variant="destructive" title={googleAdminError ?? undefined}>
                Google Admin sin conexión
              </Badge>
            )}
            <Button
              onClick={() => {
                setEditingUser(null);
                setShowCreate((v) => !v);
              }}
            >
              {showCreate ? 'Cancelar' : 'Crear usuario'}
            </Button>
          </div>
        }
      />

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      {tempPassword && (
        <AlertBanner variant="success" onDismiss={() => setTempPassword(null)}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-sm break-all">
                https://accounts.google.com/
                <br />
                {tempPassword.email}
                <br />
                <strong>{tempPassword.password}</strong>
              </p>
              <p className="text-sm">
                {tempPassword.forceChange
                  ? 'Deberá cambiarla al iniciar sesión.'
                  : 'Lista para usar tal cual.'}
                {' · Se ocultará sola en 90 s.'}
              </p>
            </div>
            <Button variant="outline" onClick={() => void copyPassword()}>
              Copiar acceso
            </Button>
          </div>
        </AlertBanner>
      )}

      <AlertDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeResetDialog();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Resetear contraseña de {resetTarget}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se generará una contraseña nueva para compartir con el usuario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-start gap-3">
              <Checkbox
                id="reset-force-change"
                checked={resetForceChange}
                onCheckedChange={(checked) =>
                  setResetForceChange(checked === true)
                }
              />
              <Label htmlFor="reset-force-change" className="font-normal leading-snug">
                Forzar cambio al iniciar sesión
                <span className="mt-1 block text-sm text-muted">
                  Recomendado si la contraseña se comparte por un canal poco
                  seguro.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="reset-sign-out"
                checked={resetSignOut}
                onCheckedChange={(checked) =>
                  setResetSignOut(checked === true)
                }
              />
              <Label htmlFor="reset-sign-out" className="font-normal leading-snug">
                Cerrar sesiones activas
                <span className="mt-1 block text-sm text-muted">
                  Útil si sospechas acceso no autorizado.
                </span>
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetting}
              onClick={(e) => {
                e.preventDefault();
                void confirmReset();
              }}
            >
              {resetting ? 'Generando…' : 'Resetear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="mb-6 p-4">
        <Input
          placeholder="Buscar por email o nombre..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
              <Button type="submit" className="w-fit" disabled={submitting}>
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
            <div className="flex flex-col gap-2 md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="text"
                  placeholder="Contraseña"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  className="font-mono"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={generatingPassword}
                  onClick={() => void handleGeneratePassword()}
                >
                  {generatingPassword ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <>
                      <RefreshCw className="mr-1 size-4" />
                      Generar
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="create-force-change"
                  checked={createForceChange}
                  onCheckedChange={(checked) =>
                    setCreateForceChange(checked === true)
                  }
                />
                <Label
                  htmlFor="create-force-change"
                  className="font-normal leading-snug"
                >
                  Forzar cambio al iniciar sesión
                </Label>
              </div>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" className="w-fit" disabled={submitting}>
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
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow className="text-muted">
                <TableHead className="p-4">Email</TableHead>
                <TableHead className="p-4">Nombre</TableHead>
                <TableHead className="p-4">OU</TableHead>
                <TableHead className="p-4">Último acceso</TableHead>
                <TableHead className="p-4">Estado</TableHead>
                <TableHead className="p-4">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            {loading && users.length === 0 ? (
              <TableBody>
                <TableSkeleton rows={6} cols={6} />
              </TableBody>
            ) : users.length === 0 ? (
              <TableBody>
                <TableRow>
                  <TableCell colSpan={6}>
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
                    <TableCell className="p-4 whitespace-nowrap text-muted">
                      {formatDate(u.lastLoginTime ?? null)}
                    </TableCell>
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
                          onClick={() => openResetDialog(u.primaryEmail)}
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
              onClick={() => void loadUsers(debouncedQuery, nextPageToken)}
            >
              Cargar más
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
