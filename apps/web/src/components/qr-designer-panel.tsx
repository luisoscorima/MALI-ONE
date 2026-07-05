import { useEffect, useRef, useState } from 'react';
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
  createQrStyling,
} from '@/lib/qr-styling';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { Spinner } from '@/components/feedback';
import { Button, Input } from '@/components/ui';

interface QrDesignerPanelProps {
  shortUrl: string;
  style: QrStyleDto;
  onChange: (style: QrStyleDto) => void;
  linkId?: string;
  onSaved?: (link: import('@mali-one/shared').ShortLinkDto) => void;
  compact?: boolean;
}

export function QrDesignerPanel({
  shortUrl,
  style,
  onChange,
  linkId,
  onSaved,
  compact,
}: QrDesignerPanelProps) {
  const toast = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<ReturnType<typeof createQrStyling> | null>(null);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [customLogoFile, setCustomLogoFile] = useState<File | null>(null);
  const [useGradient, setUseGradient] = useState(Boolean(style.foregroundGradient));
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (customLogoUrl) URL.revokeObjectURL(customLogoUrl);
    };
  }, [customLogoUrl]);

  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.innerHTML = '';
    const qr = createQrStyling(shortUrl, style, customLogoUrl, compact ? 200 : 260);
    qrRef.current = qr;
    qr.append(previewRef.current);
  }, [shortUrl, style, customLogoUrl, compact]);

  function patchStyle(partial: Partial<QrStyleDto>) {
    onChange({ ...style, ...partial });
  }

  function selectPreset(preset: QrLogoPresetId) {
    if (customLogoUrl) {
      URL.revokeObjectURL(customLogoUrl);
      setCustomLogoUrl(null);
    }
    setCustomLogoFile(null);
    patchStyle({ logoPreset: preset });
  }

  function clearLogo() {
    if (customLogoUrl) {
      URL.revokeObjectURL(customLogoUrl);
      setCustomLogoUrl(null);
    }
    setCustomLogoFile(null);
    patchStyle({ logoPreset: null });
  }

  function handleCustomLogo(file: File | undefined) {
    if (!file) return;
    if (customLogoUrl) URL.revokeObjectURL(customLogoUrl);
    setCustomLogoUrl(URL.createObjectURL(file));
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

  async function handleSave() {
    setSaving(true);
    try {
      if (linkId) {
        const updated = await api.updateLinkQrStyle(
          linkId,
          style,
          customLogoFile ?? undefined,
          saveAsDefault,
        );
        toast.success(
          saveAsDefault
            ? 'Diseño guardado en el enlace y como predeterminado'
            : 'Diseño QR guardado',
        );
        onSaved?.(updated);
      } else if (saveAsDefault) {
        await api.saveQrDefaultStyle(style);
        toast.success('Estilo predeterminado guardado');
      } else {
        toast.success('Guarda el enlace primero o marca "Guardar como predeterminado"');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar diseño');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'lg:grid-cols-[260px_1fr]')}>
      <div className="flex flex-col items-center gap-3">
        <div
          ref={previewRef}
          className="rounded-xl border border-border bg-white p-2"
        />
        {linkId && (
          <div className="flex flex-wrap justify-center gap-2">
            {(['png', 'svg', 'eps'] as const).map((fmt) => (
              <a
                key={fmt}
                href={api.qrUrl(linkId, fmt)}
                className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-xs font-medium uppercase hover:bg-muted"
                download
              >
                {fmt}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 text-sm">
        <Section title="Color del QR">
          <div className="mb-2 flex gap-2">
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
                  style.logoPreset === id && !customLogoUrl
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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={saveAsDefault}
            onChange={(e) => setSaveAsDefault(e.target.checked)}
          />
          Guardar también como predeterminado para nuevos enlaces
        </label>

        <Button
          type="button"
          className="w-fit"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-4" /> Guardando...
            </span>
          ) : linkId ? (
            'Guardar diseño'
          ) : (
            'Guardar predeterminado'
          )}
        </Button>
      </div>
    </div>
  );
}

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
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.startsWith('#') ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-border"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs"
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
