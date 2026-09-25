import { memo, useEffect, useState } from 'react';
import type { QrLogoPresetId, QrStyleDto } from '@mali-one/shared';
import {
  DEFAULT_QR_STYLE,
  QR_LOGO_PRESETS,
} from '@mali-one/shared';
import { cn } from '@/lib/utils';
import {
  BODY_SHAPES,
  EYE_FRAME_SHAPES,
  EYE_SHAPES,
} from '@/lib/qr-styling';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { Spinner } from '@/components/feedback';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
} from '@/components/ui';

interface QrDesignerPanelProps {
  shortUrl: string;
  style: QrStyleDto;
  onChange: (style: QrStyleDto) => void;
  linkId?: string;
  onSaved?: (link: import('@mali-one/shared').ShortLinkDto) => void;
  compact?: boolean;
  draftLogoFile?: File | null;
  onDraftLogoFileChange?: (file: File | null) => void;
  savedStyle?: QrStyleDto;
  initialPreview?: string | null;
  onRequestClose?: () => void;
}

function qrStylesEqual(a: QrStyleDto, b: QrStyleDto) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isBlobPreviewUrl(url: string | null) {
  return Boolean(url?.startsWith('blob:'));
}

export const QrDesignerPanel = memo(function QrDesignerPanel({
  shortUrl,
  style,
  onChange,
  linkId,
  onSaved,
  compact,
  draftLogoFile,
  onDraftLogoFileChange,
  savedStyle,
  initialPreview,
  onRequestClose,
}: QrDesignerPanelProps) {
  const toast = useToast();
  const previewSize = compact ? 200 : 260;
  const [internalLogoFile, setInternalLogoFile] = useState<File | null>(null);
  const customLogoFile = draftLogoFile !== undefined ? draftLogoFile : internalLogoFile;
  const setCustomLogoFile = onDraftLogoFileChange ?? setInternalLogoFile;
  const [dropSavedLogo, setDropSavedLogo] = useState(false);
  const usesSavedStyle =
    Boolean(linkId) &&
    Boolean(savedStyle) &&
    !customLogoFile &&
    !dropSavedLogo &&
    qrStylesEqual(style, savedStyle!);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    usesSavedStyle && initialPreview ? initialPreview : null,
  );
  const [previewLoading, setPreviewLoading] = useState(
    () => !(usesSavedStyle && initialPreview),
  );
  const [previewError, setPreviewError] = useState('');
  const [useGradient, setUseGradient] = useState(Boolean(style.foregroundGradient));
  const [saving, setSaving] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  useEffect(() => {
    if (usesSavedStyle && initialPreview) {
      setPreviewUrl((prev) => {
        if (prev === initialPreview) return prev;
        if (prev && isBlobPreviewUrl(prev)) URL.revokeObjectURL(prev);
        return initialPreview;
      });
      setPreviewLoading(false);
      setPreviewError('');
      return;
    }

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewLoading((prev) => prev || !previewUrl);
      setPreviewError('');

      const request =
        usesSavedStyle && linkId
          ? api.fetchLinkQrBlob(linkId, {
              width: previewSize,
              signal: ctrl.signal,
            })
          : api.fetchQrPreview(shortUrl, style, {
              linkId,
              logoFile: customLogoFile ?? undefined,
              clearCustomLogo: dropSavedLogo && !customLogoFile && !style.logoPreset,
              signal: ctrl.signal,
              width: previewSize,
            });

      void request
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setPreviewUrl((prev) => {
            if (prev && isBlobPreviewUrl(prev)) URL.revokeObjectURL(prev);
            return url;
          });
        })
        .catch((e) => {
          if (!ctrl.signal.aborted) {
            setPreviewError(
              e instanceof Error ? e.message : 'No se pudo generar la vista previa',
            );
          }
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setPreviewLoading(false);
        });
    }, usesSavedStyle ? 0 : 350);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [
    shortUrl,
    style,
    customLogoFile,
    linkId,
    previewSize,
    savedStyle,
    initialPreview,
    usesSavedStyle,
    dropSavedLogo,
  ]);

  useEffect(() => {
    return () => {
      if (previewUrl && isBlobPreviewUrl(previewUrl)) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function patchStyle(partial: Partial<QrStyleDto>) {
    onChange({ ...style, ...partial });
  }

  function selectPreset(preset: QrLogoPresetId) {
    setCustomLogoFile(null);
    setDropSavedLogo(false);
    patchStyle({ logoPreset: preset });
  }

  function clearLogo() {
    setCustomLogoFile(null);
    setDropSavedLogo(true);
    patchStyle({ logoPreset: null });
  }

  function handleCustomLogo(file: File | undefined) {
    if (!file) return;
    setDropSavedLogo(false);
    setCustomLogoFile(file);
    patchStyle({ logoPreset: null });
  }

  function toggleGradient(enabled: boolean) {
    setUseGradient(enabled);
    if (enabled) {
      patchStyle({
        foregroundGradient: style.foregroundGradient ?? {
          type: 'linear',
          rotation: 0,
          colorStops: [
            { offset: 0, color: '#059669' },
            { offset: 1, color: '#7c3aed' },
          ],
        },
        foregroundColor: undefined,
      });
    } else {
      patchStyle({
        foregroundGradient: undefined,
        foregroundColor: style.foregroundColor ?? '#000000',
      });
    }
  }

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    try {
      if (linkId) {
        const updated = await api.updateLinkQrStyle(
          linkId,
          dropSavedLogo && !customLogoFile
            ? { ...style, clearCustomLogo: true }
            : style,
          customLogoFile ?? undefined,
          false,
        );
        setCustomLogoFile(null);
        setDropSavedLogo(false);
        toast.success('Diseño QR guardado');
        onSaved?.(updated);
      } else {
        toast.error('Guarda el enlace antes de personalizar su QR');
        return false;
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar diseño');
      return false;
    } finally {
      setSaving(false);
    }
  }

  const hasUnsavedChanges =
    Boolean(customLogoFile) ||
    dropSavedLogo ||
    (savedStyle ? !qrStylesEqual(style, savedStyle) : true);

  function requestClose() {
    if (!onRequestClose) return;
    if (hasUnsavedChanges) {
      setCloseConfirmOpen(true);
      return;
    }
    onRequestClose();
  }

  async function saveAndClose() {
    const saved = await handleSave();
    if (!saved) return;
    setCloseConfirmOpen(false);
    onRequestClose?.();
  }

  const transparentBg = (style.backgroundColor ?? '#ffffff') === 'transparent';

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div
        className={cn(
          'grid min-h-0 flex-1 gap-4 overflow-hidden',
          compact
            ? 'grid-rows-[auto_minmax(0,1fr)]'
            : 'grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] xl:grid-rows-1',
        )}
      >
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div
            className={cn(
              'relative flex min-h-[calc(var(--qr-preview-size)+16px)] min-w-[calc(var(--qr-preview-size)+16px)] items-center justify-center rounded-xl border border-border p-2',
              transparentBg &&
                'bg-[length:16px_16px] bg-[position:0_0,8px_8px] bg-[image:linear-gradient(45deg,#d1d5db_25%,transparent_25%),linear-gradient(-45deg,#d1d5db_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d1d5db_75%),linear-gradient(-45deg,transparent_75%,#d1d5db_75%)]',
              !transparentBg && 'bg-white',
            )}
            style={
              { '--qr-preview-size': `${previewSize}px` } as React.CSSProperties
            }
          >
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Spinner className="size-6" />
              </div>
            )}
            {previewUrl && !previewError && (
              <img
                src={previewUrl}
                alt="Vista previa del código QR"
                width={previewSize}
                height={previewSize}
                className="block max-w-full"
              />
            )}
            {previewError && (
              <p className="px-3 text-center text-xs text-destructive">
                {previewError}
              </p>
            )}
          </div>
        </div>

        <div className="min-h-0 min-w-0 space-y-4 overflow-x-hidden overflow-y-auto pr-1 text-sm">
          <Section title="Color del QR">
          <div className="mb-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={!useGradient ? 'default' : 'outline'}
              onClick={() => toggleGradient(false)}
            >
              Sólido
            </Button>
            <Button
              type="button"
              size="sm"
              variant={useGradient ? 'default' : 'outline'}
              onClick={() => toggleGradient(true)}
            >
              Degradado
            </Button>
          </div>
          {!useGradient ? (
            <ColorInput
              label="Color"
              value={style.foregroundColor ?? '#000000'}
              onChange={(v) => patchStyle({ foregroundColor: v, foregroundGradient: undefined })}
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <ColorInput
                label="Inicio"
                value={
                  style.foregroundGradient?.colorStops[0]?.color ?? '#059669'
                }
                onChange={(v) =>
                  patchStyle({
                    foregroundGradient: {
                      type: style.foregroundGradient?.type ?? 'linear',
                      rotation: style.foregroundGradient?.rotation ?? 0,
                      colorStops: [
                        { offset: 0, color: v },
                        style.foregroundGradient?.colorStops[1] ?? {
                          offset: 1,
                          color: '#7c3aed',
                        },
                      ],
                    },
                  })
                }
              />
              <ColorInput
                label="Fin"
                value={
                  style.foregroundGradient?.colorStops[1]?.color ?? '#7c3aed'
                }
                onChange={(v) =>
                  patchStyle({
                    foregroundGradient: {
                      type: style.foregroundGradient?.type ?? 'linear',
                      rotation: style.foregroundGradient?.rotation ?? 0,
                      colorStops: [
                        style.foregroundGradient?.colorStops[0] ?? {
                          offset: 0,
                          color: '#059669',
                        },
                        { offset: 1, color: v },
                      ],
                    },
                  })
                }
              />
            </div>
          )}
          </Section>

          <Section title="Fondo">
          <div className="flex flex-wrap gap-2">
            {[
              { id: '#ffffff', label: 'Blanco' },
              { id: 'transparent', label: 'Transparente' },
            ].map((opt) => (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={
                  (style.backgroundColor ?? '#ffffff') === opt.id
                    ? 'default'
                    : 'outline'
                }
                onClick={() => patchStyle({ backgroundColor: opt.id })}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <ColorInput
            label="Color personalizado"
            value={
              style.backgroundColor === 'transparent'
                ? '#ffffff'
                : (style.backgroundColor ?? '#ffffff')
            }
            onChange={(v) => patchStyle({ backgroundColor: v })}
          />
          </Section>

          <ShapeGrid
          title="Forma del cuerpo"
          options={BODY_SHAPES}
          value={style.bodyShape}
          onChange={(v) => patchStyle({ bodyShape: v })}
          />
          <ShapeGrid
          title="Marco del ojo"
          options={EYE_FRAME_SHAPES}
          value={style.eyeFrameShape}
          onChange={(v) => patchStyle({ eyeFrameShape: v })}
          />
          <ShapeGrid
          title="Forma del ojo"
          options={EYE_SHAPES}
          value={style.eyeShape}
          onChange={(v) => patchStyle({ eyeShape: v })}
          />

          <Section title="Logo central">
          <div className="mb-2 flex flex-wrap gap-2">
            {(Object.keys(QR_LOGO_PRESETS) as QrLogoPresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                title={QR_LOGO_PRESETS[id].label}
                className={cn(
                  'rounded-lg border p-1 transition-colors',
                  style.logoPreset === id && !customLogoFile
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-primary/40',
                )}
                onClick={() => selectPreset(id)}
              >
                <img
                  src={QR_LOGO_PRESETS[id].url}
                  alt={QR_LOGO_PRESETS[id].label}
                  className="size-10 object-contain"
                />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
              Subir logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => handleCustomLogo(e.target.files?.[0])}
              />
            </label>
            <Button type="button" size="sm" variant="outline" onClick={clearLogo}>
              Sin logo
            </Button>
          </div>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs text-muted">
              Tamaño del logo ({Math.round((style.logoSize ?? 0.25) * 100)}%)
            </span>
            <input
              type="range"
              min={0.15}
              max={0.4}
              step={0.01}
              value={style.logoSize ?? 0.25}
              onChange={(e) =>
                patchStyle({ logoSize: Number(e.target.value) })
              }
              className="w-full"
            />
          </label>
          </Section>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-4" /> Guardando...
            </span>
          ) : (
            'Guardar diseño'
          )}
        </Button>

        {linkId &&
          (['png', 'svg', 'eps'] as const).map((fmt) =>
            hasUnsavedChanges ? (
              <Button key={fmt} type="button" variant="outline" disabled>
                {fmt.toUpperCase()}
              </Button>
            ) : (
              <a
                key={fmt}
                href={api.qrUrl(linkId, fmt)}
                className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium uppercase hover:bg-muted"
                download
              >
                {fmt}
              </a>
            ),
          )}

        {onRequestClose && (
          <Button type="button" variant="outline" onClick={requestClose}>
            Cerrar
          </Button>
        )}

        {hasUnsavedChanges && (
          <p className="w-full text-sm text-muted">
            Guarda el diseño para descargar estos cambios.
          </p>
        )}
      </div>

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quieres cerrar sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios pendientes en el diseño del QR.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel disabled={saving}>Seguir editando</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setCloseConfirmOpen(false);
                onRequestClose?.();
              }}
            >
              Cerrar sin guardar
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void saveAndClose()}
            >
              {saving ? 'Guardando...' : 'Guardar y cerrar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border border-border"
        />
        <Input
          value={value}
          onChange={(e) => {
            const next = e.target.value.trim();
            if (/^#[0-9a-fA-F]{0,6}$/.test(next)) {
              onChange(next.length === 7 ? next.toLowerCase() : next);
            }
          }}
          onBlur={() => {
            if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
              onChange(pickerValue);
            }
          }}
          className="h-8 min-w-0 font-mono text-xs"
        />
      </div>
    </label>
  );
}

function ShapeGrid<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <Button
            key={opt.id}
            type="button"
            size="sm"
            variant={value === opt.id ? 'default' : 'outline'}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </Section>
  );
}

export function useDraftQrStyle(initial?: QrStyleDto | null) {
  const [draftStyle, setDraftStyle] = useState<QrStyleDto>(
    initial ?? { ...DEFAULT_QR_STYLE },
  );
  return { draftStyle, setDraftStyle };
}
