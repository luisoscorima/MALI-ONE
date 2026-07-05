import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ModuleCard } from '@/components/module-card';
import type { WidgetAreaCatalog } from '@/lib/widget-catalog';

type Props = {
  area: WidgetAreaCatalog;
};

export function WidgetAreaHub({ area }: Props) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{area.title}</h1>
        <p className="mt-1 text-sm text-muted">{area.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {area.widgets.map((widget) => (
          <ModuleCard
            key={widget.id}
            to={`${area.basePath}/${widget.path}`}
            title={widget.label}
            subtitle={widget.embedHost}
            description={widget.description}
            icon={widget.icon}
            badge={widget.previewOnly ? 'Vista previa' : undefined}
            accent="cyan"
          />
        ))}
      </div>
    </div>
  );
}

export function WidgetBackLink({ area }: { area: WidgetAreaCatalog }) {
  return (
    <Link
      to={area.basePath}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
    >
      <ArrowLeft size={16} />
      Volver a {area.title}
    </Link>
  );
}
