import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppModule, AppUserDto } from '@mali-one/shared';
import { APP_MODULES } from '@/lib/app-modules';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';
import { AlertBanner, EmptyState, Spinner } from '@/components/feedback';
import { PageHeader } from '@/components/page-header';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui';

type DraftModules = Record<string, AppModule[]>;

function modulesEqual(a: AppModule[], b: AppModule[]) {
  if (a.length !== b.length) return false;
  return a.every((module) => b.includes(module));
}

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'Sin actividad reciente';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return date.toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'hace unos segundos';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return date.toLocaleString();
}

function PresenceDot({
  online,
  lastSeenAt,
}: {
  online: boolean;
  lastSeenAt: string | null;
}) {
  const absolute =
    lastSeenAt && !Number.isNaN(new Date(lastSeenAt).getTime())
      ? new Date(lastSeenAt).toLocaleString()
      : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            online ? 'bg-emerald-500' : 'bg-muted-foreground/40',
          )}
          aria-label={online ? 'En línea' : 'Desconectado'}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-center">
        <p>{online ? 'En línea' : 'Desconectado'}</p>
        <p className="mt-0.5 text-[11px] opacity-80">
          Última actividad: {formatLastSeen(lastSeenAt)}
        </p>
        {absolute ? (
          <p className="mt-0.5 text-[11px] opacity-80">{absolute}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function AppUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AppUserDto[]>([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftModules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setSelectedId((current) => {
        if (current && data.some((user) => user.id === current)) return current;
        return data[0]?.id ?? null;
      });
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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = useMemo(
    () =>
      normalizedQuery
        ? users.filter(
            (user) =>
              user.name.toLowerCase().includes(normalizedQuery) ||
              user.email.toLowerCase().includes(normalizedQuery),
          )
        : users,
    [users, normalizedQuery],
  );

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredUsers.some((user) => user.id === selectedId)) {
      setSelectedId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedId]);

  const selectedUser =
    filteredUsers.find((user) => user.id === selectedId) ?? null;
  const selectedDraft = selectedUser
    ? (drafts[selectedUser.id] ?? selectedUser.modules)
    : [];
  const selectedIsAdmin = selectedUser?.role === 'admin';
  const selectedHasChanges = selectedUser
    ? !selectedIsAdmin &&
      !modulesEqual(selectedDraft, selectedUser.modules)
    : false;

  function userHasChanges(user: AppUserDto) {
    if (user.role === 'admin') return false;
    return !modulesEqual(drafts[user.id] ?? user.modules, user.modules);
  }

  function toggleModule(module: AppModule) {
    if (!selectedUser || selectedIsAdmin) return;
    setDrafts((prev) => {
      const current = prev[selectedUser.id] ?? [];
      const next = current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module];
      return { ...prev, [selectedUser.id]: next };
    });
  }

  async function saveModules() {
    if (!selectedUser || selectedIsAdmin || !selectedHasChanges) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateAppUserModules(
        selectedUser.id,
        drafts[selectedUser.id] ?? [],
      );
      setUsers((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setDrafts((prev) => ({ ...prev, [updated.id]: [...updated.modules] }));
      toast.success(`Accesos actualizados para ${selectedUser.email}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Accesos MALI ONE"
        description="Los usuarios con cuenta @mali.pe inician sesión automáticamente. Aquí defines qué módulos ven en el menú. El administrador del sistema siempre tiene acceso completo."
        actions={
          selectedUser && !selectedIsAdmin ? (
            <Button
              disabled={!selectedHasChanges || saving}
              onClick={() => void saveModules()}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" /> Guardando...
                </span>
              ) : (
                'Guardar'
              )}
            </Button>
          ) : null
        }
      />

      {error && (
        <AlertBanner onDismiss={() => setError('')}>{error}</AlertBanner>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-stretch">
        <Card className="flex max-h-[min(70vh,40rem)] flex-col overflow-hidden p-0">
          <div className="shrink-0 border-b border-border/60 p-3">
            <Input
              placeholder="Buscar por nombre o email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <EmptyState
                title={normalizedQuery ? 'Sin coincidencias' : 'Aún no hay usuarios'}
                description={
                  normalizedQuery
                    ? 'Prueba con otro término de búsqueda.'
                    : 'Los usuarios aparecerán aquí después de su primer inicio de sesión con Google.'
                }
              />
            ) : (
              <ul className="p-2" role="listbox" aria-label="Usuarios">
                {filteredUsers.map((user) => {
                  const isSelected = user.id === selectedId;
                  const isAdmin = user.role === 'admin';
                  const dirty = userHasChanges(user);
                  const moduleCount = isAdmin
                    ? APP_MODULES.length
                    : (drafts[user.id] ?? user.modules).length;

                  return (
                    <li key={user.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => setSelectedId(user.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-foreground'
                            : 'hover:bg-muted/60',
                        )}
                      >
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
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <PresenceDot
                              online={user.online}
                              lastSeenAt={user.lastSeenAt}
                            />
                            <p className="truncate font-medium">{user.name}</p>
                            {dirty ? (
                              <span
                                className="size-1.5 shrink-0 rounded-full bg-amber-500"
                                title="Cambios sin guardar"
                                aria-label="Cambios sin guardar"
                              />
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted">{user.email}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge
                            variant="secondary"
                            className={cn(
                              isAdmin && 'bg-primary/15 text-primary',
                            )}
                          >
                            {isAdmin ? 'Admin' : 'Operador'}
                          </Badge>
                          <span className="text-[11px] text-muted">
                            {isAdmin ? 'Total' : `${moduleCount} mód.`}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex max-h-[min(70vh,40rem)] flex-col overflow-hidden p-0">
          {loading ? (
            <div className="space-y-3 overflow-y-auto p-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72" />
              <div className="space-y-2 pt-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : !selectedUser ? (
            <EmptyState
              title="Selecciona un usuario"
              description="Elige alguien de la lista para ver y editar sus módulos."
            />
          ) : (
            <>
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PresenceDot
                      online={selectedUser.online}
                      lastSeenAt={selectedUser.lastSeenAt}
                    />
                    <h3 className="truncate text-lg font-semibold tracking-tight">
                      {selectedUser.name}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={cn(
                        selectedIsAdmin && 'bg-primary/15 text-primary',
                      )}
                    >
                      {selectedIsAdmin ? 'Administrador' : 'Operador'}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {selectedUser.email}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Última actividad:{' '}
                    {formatLastSeen(selectedUser.lastSeenAt)}
                  </p>
                </div>
                {selectedIsAdmin ? (
                  <p className="text-sm text-muted">Acceso total a todos los módulos</p>
                ) : (
                  <p className="text-sm text-muted">
                    {selectedDraft.length} de {APP_MODULES.length} módulos
                    {selectedHasChanges ? ' · sin guardar' : ''}
                  </p>
                )}
              </div>

              <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
                {APP_MODULES.map((mod) => {
                  const checked = selectedIsAdmin
                    ? true
                    : selectedDraft.includes(mod.id);
                  const inputId = `module-${selectedUser.id}-${mod.id}`;

                  return (
                    <li key={mod.id}>
                      <label
                        htmlFor={inputId}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 px-5 py-3.5 transition-colors',
                          selectedIsAdmin
                            ? 'cursor-default opacity-80'
                            : 'hover:bg-muted/40',
                        )}
                      >
                        <Checkbox
                          id={inputId}
                          checked={checked}
                          disabled={selectedIsAdmin || saving}
                          onCheckedChange={() => toggleModule(mod.id)}
                          className="mt-0.5"
                          aria-label={mod.label}
                        />
                        <span className="min-w-0 flex-1">
                          <Label
                            htmlFor={inputId}
                            className="cursor-pointer text-sm font-medium leading-snug"
                          >
                            {mod.label}
                          </Label>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {mod.description}
                          </p>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {!selectedIsAdmin ? (
                <div className="flex shrink-0 justify-end border-t border-border/60 bg-card px-5 py-3">
                  <Button
                    disabled={!selectedHasChanges || saving}
                    onClick={() => void saveModules()}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" /> Guardando...
                      </span>
                    ) : (
                      'Guardar cambios'
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
