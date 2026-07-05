import type { QrLogoPresetId, QrStyleDto } from '@mali-one/shared';
import { QR_LOGO_PRESETS } from '@mali-one/shared';
import QRCodeStyling from 'qr-code-styling';

export function getLogoUrlFromStyle(
  style: QrStyleDto,
  customLogoObjectUrl?: string | null,
): string | undefined {
  if (customLogoObjectUrl) return customLogoObjectUrl;
  if (style.logoPreset && style.logoPreset in QR_LOGO_PRESETS) {
    return QR_LOGO_PRESETS[style.logoPreset as QrLogoPresetId].url;
  }
  return undefined;
}

export function hasLogoInStyle(
  style: QrStyleDto,
  customLogoObjectUrl?: string | null,
): boolean {
  return Boolean(customLogoObjectUrl || style.logoPreset);
}

export function buildQrStylingOptions(
  data: string,
  style: QrStyleDto,
  customLogoObjectUrl?: string | null,
  width = 280,
) {
  const logoUrl = getLogoUrlFromStyle(style, customLogoObjectUrl);
  const withLogo = hasLogoInStyle(style, customLogoObjectUrl);
  const fgColor = style.foregroundGradient
    ? undefined
    : (style.foregroundColor ?? '#000000');
  const bg =
    style.backgroundColor === 'transparent'
      ? 'rgba(255,255,255,0)'
      : (style.backgroundColor ?? '#ffffff');

  return {
    width,
    height: width,
    type: 'canvas' as const,
    data,
    margin: style.margin ?? 8,
    qrOptions: {
      errorCorrectionLevel: withLogo ? ('H' as const) : ('M' as const),
    },
    image: logoUrl,
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: style.logoSize ?? 0.25,
      margin: 4,
      crossOrigin: 'anonymous' as const,
    },
    dotsOptions: {
      type: style.bodyShape,
      color: fgColor,
      gradient: style.foregroundGradient,
    },
    cornersSquareOptions: {
      type: style.eyeFrameShape,
      color: fgColor,
      gradient: style.foregroundGradient,
    },
    cornersDotOptions: {
      type: style.eyeShape,
      color: fgColor,
      gradient: style.foregroundGradient,
    },
    backgroundOptions: {
      color: bg,
    },
  };
}

export function createQrStyling(
  data: string,
  style: QrStyleDto,
  customLogoObjectUrl?: string | null,
  width = 280,
) {
  return new QRCodeStyling(
    buildQrStylingOptions(data, style, customLogoObjectUrl, width),
  );
}

export const BODY_SHAPES: Array<{
  id: QrStyleDto['bodyShape'];
  label: string;
}> = [
  { id: 'square', label: 'Cuadrados' },
  { id: 'dots', label: 'Círculos' },
  { id: 'rounded', label: 'Redondeado' },
  { id: 'extra-rounded', label: 'Extra redondeado' },
  { id: 'classy', label: 'Classy' },
  { id: 'classy-rounded', label: 'Classy redondeado' },
];

export const EYE_FRAME_SHAPES: Array<{
  id: QrStyleDto['eyeFrameShape'];
  label: string;
}> = [
  { id: 'square', label: 'Cuadrado' },
  { id: 'dot', label: 'Círculo' },
  { id: 'extra-rounded', label: 'Redondeado' },
];

export const EYE_SHAPES: Array<{ id: QrStyleDto['eyeShape']; label: string }> =
  [
    { id: 'square', label: 'Cuadrado' },
    { id: 'dot', label: 'Círculo' },
  ];
