import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ScreenCastPlaylistDto } from '@mali-one/shared';
import { PageLoading, EmptyState, AlertBanner } from '@/components/feedback';
import { ScreenCastBackLink } from '@/pages/screen-cast-hub-page';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { useConfirm } from '@/hooks/use-confirm';
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';

export function ScreenCastPlaylistsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [playlists, setPlaylists] = useState<
    (ScreenCastPlaylistDto & {
      _count?: { monitors: number; items: number };
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.listScreenCastPlaylists();
      setPlaylists(data);
      setError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setCreating(true);
    try {
      const created = await api.createScreenCastPlaylist({ name: trimmed });
      toast.success('Playlist creada');
      setName('');
      navigate(`/admin/screen-cast/playlists/${created.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setCreating(false);
    }
  }

  async function remove(playlist: ScreenCastPlaylistDto) {
    const ok = await confirm({
      title: `¿Eliminar «${playlist.name}»?`,
      description: 'Los monitores asignados quedarán sin playlist.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.deleteScreenCastPlaylist(playlist.id);
      toast.success('Playlist eliminada');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div>
      <ScreenCastBackLink />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Listas de reproducción</h1>
        <p className="mt-1 text-sm text-muted">
          Playlists reutilizables que puedes asignar a uno o más monitores.
        </p>
      </div>

      {error && <AlertBanner>{error}</AlertBanner>}

      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="pl-name">Nueva playlist</Label>
          <Input
            id="pl-name"
            value={name}
            placeholder="Lobby principal"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create();
            }}
          />
        </div>
        <Button type="button" disabled={creating} onClick={() => void create()}>
          <Plus size={16} />
          Crear
        </Button>
      </Card>

      {playlists.length === 0 ? (
        <EmptyState
          title="Sin playlists"
          description="Crea una lista y añade imágenes o videos."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Ítems</TableHead>
                <TableHead>Monitores</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {playlists.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/admin/screen-cast/playlists/${p.id}`}
                      className="hover:underline"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.activo ? 'default' : 'secondary'}>
                      {p.activo ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </TableCell>
                  <TableCell>{p._count?.items ?? 0}</TableCell>
                  <TableCell>{p._count?.monitors ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button type="button" size="icon" variant="ghost" asChild>
                        <Link to={`/admin/screen-cast/playlists/${p.id}`}>
                          <Pencil size={16} />
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => void remove(p)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
