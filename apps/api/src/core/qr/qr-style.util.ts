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
