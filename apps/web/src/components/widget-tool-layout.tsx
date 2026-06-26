import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  backLink?: React.ReactNode;
  config?: React.ReactNode;
  preview: React.ReactNode;
  previewOnly?: boolean;
};

export function WidgetToolLayout({
  title,
  description,
  backLink,
  config,
  preview,
  previewOnly = false,
}: Props) {
  const [tab, setTab] = useState<'config' | 'preview'>(previewOnly ? 'preview' : 'config');

  return (
    <div>
      {backLink}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>

      {!previewOnly && config && (
        <div className="mb-6 flex gap-2 border-b border-border">
          {(['config', 'preview'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground',
              )}
            >
              {key === 'config' ? 'Configuración' : 'Vista previa'}
            </button>
          ))}
        </div>
      )}

      {previewOnly || tab === 'preview' ? preview : config}
    </div>
  );
}
