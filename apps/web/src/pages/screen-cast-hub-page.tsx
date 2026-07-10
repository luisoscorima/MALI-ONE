import { Link } from 'react-router-dom';
import { ArrowLeft, ListVideo, Monitor } from 'lucide-react';
import { ModuleCard } from '@/components/module-card';

export function ScreenCastHubPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Transmisión a pantallas</h1>
        <p className="mt-1 text-sm text-muted">
          Gestiona monitores quiosco y listas de reproducción multimedia.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModuleCard
          to="/admin/screen-cast/monitors"
          title="Monitores"
          description="Registra pantallas, asigna playlists y consulta el estado en vivo."
          icon={Monitor}
          accent="cyan"
        />
        <ModuleCard
          to="/admin/screen-cast/playlists"
          title="Listas de reproducción"
          description="Crea playlists reutilizables con imágenes, GIFs y videos."
          icon={ListVideo}
          accent="blue"
        />
      </div>
    </div>
  );
}

export function ScreenCastBackLink() {
  return (
    <Link
      to="/admin/screen-cast"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
    >
      <ArrowLeft size={16} />
      Volver a Transmisión a pantallas
    </Link>
  );
}
