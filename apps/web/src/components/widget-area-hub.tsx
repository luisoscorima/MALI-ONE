import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { WidgetAreaCatalog } from '@/lib/widget-catalog';
import { Card } from '@/components/ui';

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

      <div className="grid gap-4 md:grid-cols-2">
        {area.widgets.map((widget) => (
          <Link
            key={widget.id}
            to={`${area.basePath}/${widget.path}`}
            className="group block"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/15 p-2 text-primary">
                    <widget.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{widget.label}</h3>
                    <p className="text-xs text-muted">{widget.embedHost}</p>
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p className="text-sm text-muted">{widget.description}</p>
              {widget.previewOnly && (
                <p className="mt-2 text-xs text-muted">Solo vista previa</p>
              )}
            </Card>
          </Link>
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
