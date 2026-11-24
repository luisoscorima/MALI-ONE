import { useMemo, useState } from 'react';
import { Loader2, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import type { EmailSenderDto, EmailSenderScope } from '@mali-one/shared';
import { useToast } from '@/contexts/toast-context';
import { api } from '@/lib/api';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from '@/components/ui';

const df = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' });
const senderPattern = /^[^@\s]+@mali\.pe$/i;

const SCOPE_LABELS: Record<EmailSenderScope, string> = {
  shared: 'Boletines (org)',
  malichimp: 'MALICHIMP',
  internal_communications: 'Campañas internas',
};

type Props = {
  senders: EmailSenderDto[];
  onChange: (senders: EmailSenderDto[]) => void;
  /** Fixed scope for module autonomy (MALICHIMP). Hub omits this and shows all. */
  scope?: EmailSenderScope;
  /** Hub create: pick which catalog to add to. Defaults to shared. */
  hubMode?: boolean;
};

function sortSenders(senders: EmailSenderDto[]) {
  return [...senders].sort((left, right) => {
    const scopeCmp = (left.scope ?? '').localeCompare(right.scope ?? '', 'es-PE');
    if (scopeCmp !== 0) return scopeCmp;
    return left.email.localeCompare(right.email, 'es-PE');
  });
}

function countInScope(senders: EmailSenderDto[], scope: EmailSenderScope) {
  return senders.filter((s) => s.scope === scope).length;
}

export function EmailSendersPanel({
  senders,
  onChange,
  scope,
  hubMode = false,
}: Props) {
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailSenderDto | null>(null);
  const [email, setEmail] = useState('');
  const [createScope, setCreateScope] = useState<EmailSenderScope>(
    scope ?? 'shared',
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmailSenderDto | null>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = senderPattern.test(normalizedEmail);
  const showScopeColumn = hubMode || !scope;

  const description = useMemo(() => {
    if (scope === 'malichimp') {
      return 'Catálogo de remitentes de MALICHIMP. Solo este módulo puede usarlos en campañas.';
    }
    if (hubMode) {
      return 'Hub global: administra remitentes de Boletines (org), MALICHIMP y Campañas internas.';
    }
    return 'Correos @mali.pe disponibles para campañas.';
  }, [hubMode, scope]);

  function openCreate() {
    setEditing(null);
    setEmail('');
    setCreateScope(scope ?? 'shared');
    setFormOpen(true);
  }

  function openEdit(sender: EmailSenderDto) {
    setEditing(sender);
    setEmail(sender.email);
    setCreateScope(sender.scope);
    setFormOpen(true);
  }

  async function save() {
    if (!emailValid) return;
    setSaving(true);
    try {
      let saved: EmailSenderDto;
      if (editing) {
        saved =
          scope === 'malichimp'
            ? await api.updateMalichimpSender(editing.id, normalizedEmail)
            : await api.updateEmailSender(editing.id, normalizedEmail);
      } else if (scope === 'malichimp') {
        saved = await api.createMalichimpSender(normalizedEmail);
      } else {
        saved = await api.createEmailSender(normalizedEmail, createScope);
      }
      onChange(
        sortSenders(
          editing
            ? senders.map((sender) => (sender.id === saved.id ? saved : sender))
            : [...senders, saved],
        ),
      );
      toast.success(editing ? 'Remitente actualizado' : 'Remitente agregado');
      setFormOpen(false);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo guardar el remitente');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (scope === 'malichimp') {
        await api.deleteMalichimpSender(deleteTarget.id);
      } else {
        await api.deleteEmailSender(deleteTarget.id);
      }
      onChange(senders.filter((sender) => sender.id !== deleteTarget.id));
      toast.success('Remitente eliminado');
      setDeleteTarget(null);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'No se pudo eliminar el remitente');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Remitentes disponibles</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" aria-hidden /> Agregar remitente
        </Button>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Correo</TableHead>
              {showScopeColumn ? <TableHead>Módulo</TableHead> : null}
              <TableHead>Creado por</TableHead>
              <TableHead>Agregado</TableHead>
              <TableHead className="w-28 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {senders.map((sender) => {
              const inScopeCount = countInScope(senders, sender.scope);
              return (
                <TableRow key={sender.id}>
                  <TableCell>
                    <div className="flex min-w-56 items-center gap-2 font-medium">
                      <Mail className="size-4 text-muted-foreground" aria-hidden />
                      {sender.email}
                    </div>
                  </TableCell>
                  {showScopeColumn ? (
                    <TableCell>
                      <Badge variant="outline">
                        {SCOPE_LABELS[sender.scope] ?? sender.scope}
                      </Badge>
                    </TableCell>
                  ) : null}
                  <TableCell
                    className="text-muted-foreground"
                    title={sender.createdBy?.email}
                  >
                    {sender.createdBy?.name ?? sender.createdBy?.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {df.format(new Date(sender.createdAt))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Editar ${sender.email}`}
                        onClick={() => openEdit(sender)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Eliminar ${sender.email}`}
                        disabled={inScopeCount <= 1}
                        title={
                          inScopeCount <= 1
                            ? 'Debe quedar al menos un remitente en este catálogo'
                            : undefined
                        }
                        onClick={() => setDeleteTarget(sender)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!senders.length ? (
              <TableRow>
                <TableCell
                  colSpan={showScopeColumn ? 5 : 4}
                  className="h-32 text-center text-muted-foreground"
                >
                  No hay remitentes. Agrega un correo @mali.pe para habilitar campañas.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableShell>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar remitente' : 'Agregar remitente'}</DialogTitle>
            <DialogDescription>
              Sólo se admiten direcciones del dominio mali.pe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {hubMode && !editing ? (
              <div className="space-y-2">
                <Label>Catálogo / módulo</Label>
                <Select
                  value={createScope}
                  onValueChange={(v) => setCreateScope(v as EmailSenderScope)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SCOPE_LABELS) as EmailSenderScope[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {SCOPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email-sender-email">Correo remitente</Label>
              <Input
                id="email-sender-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="boletines@mali.pe"
                autoComplete="off"
                aria-invalid={Boolean(email) && !emailValid}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && emailValid && !saving) void save();
                }}
              />
              {email && !emailValid ? (
                <p className="text-xs text-destructive">
                  Ingresa un correo válido terminado en @mali.pe.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Ejemplo: educacion@mali.pe</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!emailValid || saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {saving ? 'Guardando…' : 'Guardar remitente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este remitente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.email} dejará de estar disponible para campañas nuevas de este
              catálogo. Las campañas existentes no cambiarán. Debe quedar al menos un remitente
              por catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
