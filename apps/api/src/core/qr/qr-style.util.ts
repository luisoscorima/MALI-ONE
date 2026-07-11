import {
  DEFAULT_QR_STYLE,
  QR_LOGO_PRESETS,
  type QrLogoPresetId,
  type QrStyleDto,
} from '@mali-one/shared';

export function parseQrStyle(raw: unknown): QrStyleDto | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    ...DEFAULT_QR_STYLE,
    ...(obj as Partial<QrStyleDto>),
    bodyShape:
      (obj.bodyShape as QrStyleDto['bodyShape']) ?? DEFAULT_QR_STYLE.bodyShape,
    eyeFrameShape:
      (obj.eyeFrameShape as QrStyleDto['eyeFrameShape']) ??
      DEFAULT_QR_STYLE.eyeFrameShape,
    eyeShape:
      (obj.eyeShape as QrStyleDto['eyeShape']) ?? DEFAULT_QR_STYLE.eyeShape,
  };
}

export function resolveEffectiveQrStyle(
  userDefault: unknown,
  linkStyle: unknown,
): QrStyleDto {
  const base = parseQrStyle(userDefault) ?? { ...DEFAULT_QR_STYLE };
  const override = parseQrStyle(linkStyle);
  if (!override) return { ...base };
  return { ...base, ...override };
}

export function cloneQrStyleForCreate(userDefault: unknown): QrStyleDto {
  const style = resolveEffectiveQrStyle(userDefault, null);
  return JSON.parse(JSON.stringify(style)) as QrStyleDto;
}

export function getLogoUrl(
  style: QrStyleDto,
  customLogoKey?: string | null,
  getS3Url?: (key: string) => string,
): string | undefined {
  if (customLogoKey && getS3Url) {
    return getS3Url(customLogoKey);
  }
  if (style.logoPreset && style.logoPreset in QR_LOGO_PRESETS) {
    return QR_LOGO_PRESETS[style.logoPreset as QrLogoPresetId].url;
  }
  return undefined;
}

export function hasLogo(
  style: QrStyleDto,
  customLogoKey?: string | null,
): boolean {
  return Boolean(customLogoKey || style.logoPreset);
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_COLOR_RE = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+\s*)?\)$/i;

/** Normaliza colores a un formato que skia-canvas pueda parsear. */
export function normalizeCssColor(
  color: string | undefined | null,
  fallback: string,
): string {
  if (!color || typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  if (!trimmed) return fallback;
  if (trimmed === 'transparent') return 'rgba(255,255,255,0)';
  if (HEX_COLOR_RE.test(trimmed)) {
    if (trimmed.length === 4) {
      const [, r, g, b] = trimmed;
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return trimmed.toLowerCase();
  }
  if (RGB_COLOR_RE.test(trimmed)) return trimmed;
  return fallback;
}

export function sanitizeQrStyleForRender(style: QrStyleDto): QrStyleDto {
  const backgroundColor =
    style.backgroundColor === 'transparent'
      ? 'transparent'
      : normalizeCssColor(style.backgroundColor, '#ffffff');

  const gradient = style.foregroundGradient;
  if (gradient?.colorStops?.length) {
    const colorStops = gradient.colorStops
      .map((stop, index) => ({
        offset: clamp01(Number(stop.offset)),
        color: normalizeCssColor(
          stop.color,
          index === 0 ? '#000000' : '#333333',
        ),
      }))
      .filter((stop) => Number.isFinite(stop.offset))
      .sort((a, b) => a.offset - b.offset);

    if (colorStops.length >= 2) {
      return {
        ...style,
        backgroundColor,
        foregroundColor: undefined,
        foregroundGradient: {
          type: gradient.type === 'radial' ? 'radial' : 'linear',
          rotation: Number(gradient.rotation) || 0,
          colorStops,
        },
      };
    }
  }

  return {
    ...style,
    backgroundColor,
    foregroundColor: normalizeCssColor(style.foregroundColor, '#000000'),
    foregroundGradient: undefined,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
