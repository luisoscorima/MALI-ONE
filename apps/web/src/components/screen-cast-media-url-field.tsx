import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { FolderOpen, Loader2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { cn } from '@/lib/utils';
import {
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import {
  ScreenCastS3Picker,
  inferScreenCastMediaType,
} from '@/components/screen-cast-s3-picker';

type MediaType = 'image' | 'video' | 'gif';

export type ScreenCastUploadMeta = {
  originalBytes: number;
  optimizedBytes: number;
  width: number | null;
  height: number | null;
  durationMs?: number | null;
};

type Props = {
  value: string;
  onChange: (
    url: string,
    inferredType?: MediaType,
    meta?: ScreenCastUploadMeta,
  ) => void;
  id?: string;
  placeholder?: string;
  /** Monitors linked to this playlist — used for orientation mismatch warnings. */
  hasPortraitMonitors?: boolean;
  hasLandscapeMonitors?: boolean;
};

const ACCEPT =
  'image/jpeg,image/png,image/gif,video/mp4,video/quicktime,.jpg,.jpeg,.png,.gif,.mp4,.mov';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function orientationWarning(
  width: number | null,
  height: number | null,
  opts: {
    hasPortraitMonitors?: boolean;
    hasLandscapeMonitors?: boolean;
  },
): string | null {
  if (!width || !height) return null;
  const isLandscape = width > height;
  const isPortrait = height > width;
  if (opts.hasPortraitMonitors && isLandscape) {
    return `La imagen es horizontal (${width}×${height}) y hay monitores verticales en esta playlist.`;
  }
  if (opts.hasLandscapeMonitors && !opts.hasPortraitMonitors && isPortrait) {
    return `La imagen es vertical (${width}×${height}) y hay monitores horizontales en esta playlist.`;
  }
  return null;
}

export function ScreenCastMediaUrlField({
  value,
  onChange,
  id,
  placeholder = 'https://…',
  hasPortraitMonitors = false,
  hasLandscapeMonitors = false,
}: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<'link' | 'upload'>('link');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<ScreenCastUploadMeta | null>(
    null,
  );
  const [orientWarn, setOrientWarn] = useState<string | null>(null);

  const orientOpts = useMemo(
    () => ({ hasPortraitMonitors, hasLandscapeMonitors }),
    [hasPortraitMonitors, hasLandscapeMonitors],
  );

  const applyMeta = useCallback(
    (meta: ScreenCastUploadMeta | null) => {
      setUploadMeta(meta);
      setOrientWarn(
        meta
          ? orientationWarning(meta.width, meta.height, orientOpts)
          : null,
      );
    },
    [orientOpts],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const result = await api.uploadScreenCastMedia(file);
        const meta: ScreenCastUploadMeta = {
          originalBytes: result.originalBytes,
          optimizedBytes: result.optimizedBytes,
          width: result.width,
          height: result.height,
          durationMs: result.durationMs,
        };
        setUploadedName(result.fileName);
        applyMeta(meta);
        onChange(result.url, result.mediaType, meta);
        toast.success('Archivo subido a S3');
        const warn = orientationWarning(meta.width, meta.height, orientOpts);
        if (warn) toast.error(warn);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al subir');
      } finally {
        setUploading(false);
      }
    },
    [onChange, toast, applyMeta, orientOpts],
  );

  function onFileChosen(file: File | undefined) {
    if (!file || uploading) return;
    void uploadFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    onFileChosen(file);
  }

  return (
    <div className="space-y-3">
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as 'link' | 'upload')}
      >
        <TabsList>
          <TabsTrigger value="link">Enlace</TabsTrigger>
          <TabsTrigger value="upload">Subir archivo</TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="mt-3">
          <div className="flex gap-2">
            <Input
              id={id}
              value={value}
              placeholder={placeholder}
              onChange={(e) => {
                const url = e.target.value;
                applyMeta(null);
                setUploadedName(null);
                onChange(url, url ? inferScreenCastMediaType(url) : undefined);
              }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(true)}
              title="Elegir de S3"
            >
              <FolderOpen size={16} />
              S3
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-3">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={handleDrop}
            onClick={() => {
              if (!uploading) inputRef.current?.click();
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors',
              dragOver
                ? 'border-foreground bg-muted/60'
                : 'border-border hover:bg-muted/40',
              uploading && 'pointer-events-none opacity-70',
            )}
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin text-muted" />
            ) : (
              <Upload className="size-6 text-muted" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {uploading
                  ? 'Subiendo a S3…'
                  : 'Arrastra un archivo o haz clic para elegir'}
              </p>
              <p className="text-xs text-muted">
                JPG, PNG, GIF, MP4 o MOV (iPhone). PNG/JPG → JPEG; MOV → MP4
                H.264 al subir.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                inputRef.current?.click();
              }}
            >
              <Upload size={14} />
              Elegir archivo
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                onFileChosen(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {(uploadedName || value) && mode === 'upload' && (
            <p className="mt-2 truncate text-xs text-muted">
              {uploadedName ? `Listo: ${uploadedName}` : `URL: ${value}`}
            </p>
          )}
          {uploadMeta && (
            <p className="mt-1 text-xs text-muted">
              {uploadMeta.width && uploadMeta.height
                ? `${uploadMeta.width}×${uploadMeta.height} · `
                : ''}
              {formatBytes(uploadMeta.originalBytes)}
              {uploadMeta.optimizedBytes !== uploadMeta.originalBytes
                ? ` → ${formatBytes(uploadMeta.optimizedBytes)}`
                : ''}
            </p>
          )}
          {orientWarn && (
            <p className="mt-1 text-xs text-amber-500">{orientWarn}</p>
          )}
        </TabsContent>
      </Tabs>

      <ScreenCastS3Picker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(url) => onChange(url, inferScreenCastMediaType(url))}
      />
    </div>
  );
}
