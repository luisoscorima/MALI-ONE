import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

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
  const [tab, setTab] = useState<'config' | 'preview'>(
    previewOnly ? 'preview' : 'config',
  );

  return (
    <div>
      {backLink}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>

      {previewOnly || !config ? (
        preview
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'config' | 'preview')}
        >
          <TabsList className="mb-6 w-fit">
            <TabsTrigger value="config" className="flex-none px-4">
              Configuración
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-none px-4">
              Vista previa
            </TabsTrigger>
          </TabsList>
          <TabsContent value="config">{config}</TabsContent>
          <TabsContent value="preview">{preview}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
