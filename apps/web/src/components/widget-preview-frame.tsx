import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type WidgetPreviewTab = {
  id: string;
  label: string;
  src: string;
  height?: string;
  pamEmbed?: boolean;
  /** Añade ?preview=1 al iframe (estilos de demo en el HTML del widget; no afecta WordPress). */
  previewMode?: boolean;
};

type Props = {
  tabs: WidgetPreviewTab[];
};

export function WidgetPreviewFrame({ tabs }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tab = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    const current = tabs.find((t) => t.id === active);
    if (!current?.pamEmbed) return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; height?: number; url?: string };
      if (data?.type === 'pam-iframe-resize' && iframeRef.current && data.height) {
        iframeRef.current.style.height = `${data.height}px`;
      }
      if (data?.type === 'pam-open-checkout' && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [active, tabs]);

  if (!tab) return null;

  let src = tab.src;
  if (tab.pamEmbed && !src.includes('embed=1')) {
    src = `${src}${src.includes('?') ? '&' : '?'}embed=1`;
  }
  if (tab.previewMode && !src.includes('preview=1')) {
    src = `${src}${src.includes('?') ? '&' : '?'}preview=1`;
  }

  return (
    <div>
      {tabs.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                active === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-border/50 text-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={src}
        src={src}
        title={tab.label}
        className="w-full rounded-lg border border-border bg-white"
        style={{ height: tab.height ?? 'min(80vh, 720px)' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
