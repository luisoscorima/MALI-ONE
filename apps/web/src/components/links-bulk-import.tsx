import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import type { BulkLinksResultDto } from '@mali-one/shared';
import { api } from '@/lib/api';
import {
  parseUrlExcel,
  parseWhatsappExcel,
} from '@/lib/parse-links-excel';
import {
  downloadFileUrlBulkTemplate,
  downloadUrlBulkTemplate,
  downloadWhatsappBulkTemplate,
} from '@/lib/links-bulk-templates';
import { useToast } from '@/contexts/toast-context';
import { Spinner } from '@/components/feedback';
import { Button, Card } from '@/components/ui';

type BulkMode = 'url' | 'whatsapp' | 'file-urls';

interface LinksBulkImportProps {
  mode: BulkMode;
  onSuccess: () => void;
  disabled?: boolean;
}

const MODE_CONFIG: Record<
  BulkMode,
  {
    title: string;
    description: string;
    columns: string;
    downloadTemplate: () => void;
  }
> = {
  url: {
    title: 'Carga masiva desde Excel',
    description:
      'Importa hasta 100 URLs para acortar y generar QR en lote.',
    columns: 'url, slug (opcional), tags (opcional)',
    downloadTemplate: downloadUrlBulkTemplate,
  },
  whatsapp: {
    title: 'Carga masiva desde Excel',
    description:
      'Importa hasta 100 números de WhatsApp con mensaje, slug y tags opcionales.',
    columns: 'telefono, mensaje (opcional), slug (opcional), tags (opcional)',
    downloadTemplate: downloadWhatsappBulkTemplate,
  },
  'file-urls': {
    title: 'Carga masiva de URLs de archivo',
    description:
      'Acorta enlaces a archivos externos (PDF, imágenes, etc.) desde Excel.',
    columns: 'url, slug (opcional), tags (opcional)',
    downloadTemplate: downloadFileUrlBulkTemplate,
  },
};

export function LinksBulkImport({
  mode,
  onSuccess,
  disabled,
}: LinksBulkImportProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkLinksResultDto | null>(null);

  const config = MODE_CONFIG[mode];

  async function handleFileChange(file: File | undefined) {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Usa un archivo Excel (.xlsx, .xls) o CSV.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();

      if (mode === 'whatsapp') {
        const parsed = parseWhatsappExcel(buffer);
        if (!parsed.ok) {
          toast.error(parsed.error);
          return;
        }
        const data = await api.bulkWhatsapp(parsed.items);
        setResult(data);
        toast.success(
          `${data.created.length} enlace(s) creado(s)${data.errors.length ? `, ${data.errors.length} error(es)` : ''}`,
        );
        onSuccess();
      } else {
        const parsed = parseUrlExcel(buffer);
        if (!parsed.ok) {
          toast.error(parsed.error);
          return;
        }
        const data = await api.bulkShorten(parsed.items);
        setResult(data);
        toast.success(
          `${data.created.length} enlace(s) creado(s)${data.errors.length ? `, ${data.errors.length} error(es)` : ''}`,
        );
        onSuccess();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error en la importación');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Card className="border-dashed">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <FileSpreadsheet className="size-4 shrink-0 text-primary" />
            {config.title}
          </div>
          <p className="text-sm text-muted">{config.description}</p>
          <p className="mt-1 text-xs text-muted">
            Columnas: {config.columns}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || loading}
            onClick={() => config.downloadTemplate()}
          >
            <Download className="size-4" />
            Plantilla
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-4" /> Importando...
              </span>
            ) : (
              <>
                <Upload className="size-4" />
                Importar Excel
              </>
            )}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            disabled={disabled || loading}
            onChange={(e) => void handleFileChange(e.target.files?.[0])}
          />
        </div>
      </div>

      {result && (result.created.length > 0 || result.errors.length > 0) && (
        <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          {result.created.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-emerald-600 dark:text-emerald-400">
                {result.created.length} enlace(s) creado(s)
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-muted">
                {result.created.map((link) => (
                  <li key={link.id} className="truncate">
                    <span className="font-medium text-foreground">{link.slug}</span>
                    {' → '}
                    {link.shortUrl}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-destructive">
                {result.errors.length} error(es)
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-muted">
                {result.errors.map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    Fila {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface LinksBulkFileUploadProps {
  onSuccess: () => void;
  disabled?: boolean;
}

export function LinksBulkFileUpload({
  onSuccess,
  disabled,
}: LinksBulkFileUploadProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkLinksResultDto | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  async function handleUpload() {
    const files = inputRef.current?.files;
    if (!files?.length) {
      toast.error('Selecciona al menos un archivo.');
      return;
    }
    if (files.length > 50) {
      toast.error('Máximo 50 archivos por lote.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await api.bulkUpload(Array.from(files));
      setResult(data);
      toast.success(
        `${data.created.length} archivo(s) subido(s)${data.errors.length ? `, ${data.errors.length} error(es)` : ''}`,
      );
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al subir archivos');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
      setSelectedCount(0);
    }
  }

  return (
    <Card className="border-dashed">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <Upload className="size-4 shrink-0 text-primary" />
            Carga masiva de archivos
          </div>
          <p className="text-sm text-muted">
            Sube hasta 50 archivos a S3 y genera un enlace corto con QR por cada
            uno. Los binarios no pueden importarse desde Excel.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="max-w-[14rem] text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground"
            disabled={disabled || loading}
            onChange={(e) => setSelectedCount(e.target.files?.length ?? 0)}
          />
          <Button
            type="button"
            size="sm"
            className="w-fit"
            disabled={disabled || loading || selectedCount === 0}
            onClick={() => void handleUpload()}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-4" /> Subiendo...
              </span>
            ) : (
              `Subir ${selectedCount > 0 ? `(${selectedCount})` : ''}`
            )}
          </Button>
        </div>
      </div>

      {result && (result.created.length > 0 || result.errors.length > 0) && (
        <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
          {result.created.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-emerald-600 dark:text-emerald-400">
                {result.created.length} archivo(s) procesado(s)
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-muted">
                {result.created.map((link) => (
                  <li key={link.id} className="truncate">
                    <span className="font-medium text-foreground">
                      {link.fileName ?? link.slug}
                    </span>
                    {' → '}
                    {link.shortUrl}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-destructive">
                {result.errors.length} error(es)
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto text-muted">
                {result.errors.map((err) => (
                  <li key={`${err.row}-${err.message}`}>
                    Archivo {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
