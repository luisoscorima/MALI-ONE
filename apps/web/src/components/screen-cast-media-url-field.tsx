import { useCallback, useRef, useState, type DragEvent } from 'react';
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

type Props = {
  value: string;
  onChange: (url: string, inferredType?: MediaType) => void;
  id?: string;
  placeholder?: string;
};

const ACCEPT = 'image/jpeg,image/png,image/gif,video/mp4,.jpg,.jpeg,.png,.gif,.mp4';

export function ScreenCastMediaUrlField({
  value,
  onChange,
  id,
  placeholder = 'https://…',
}: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<'link' | 'upload'>('link');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const result = await api.uploadScreenCastMedia(file);
        setUploadedName(result.fileName);
        onChange(result.url, result.mediaType);
        toast.success('Archivo subido a S3');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al subir');
      } finally {
        setUploading(false);
      }
    },
    [onChange, toast],
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
              <p className="text-xs text-muted">JPG, PNG, GIF o MP4</p>
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
              {uploadedName
                ? `Listo: ${uploadedName}`
                : `URL: ${value}`}
            </p>
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
