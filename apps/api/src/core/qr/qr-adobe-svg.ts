import type {
  QrBodyShape,
  QrEyeFrameShape,
  QrEyeShape,
  QrStyleDto,
} from '@mali-one/shared';
import qrcode from 'qrcode-generator';

type AdobeSvgInput = {
  data: string;
  width: number;
  style: QrStyleDto;
  logoDataUrl?: string;
};

/**
 * SVG pensado para Illustrator/Photoshop: primitivas nativas (<rect>/<circle>),
 * sin paths densos de Skia ni clipPath.
 */
export function buildAdobeSafeQrSvg(input: AdobeSvgInput): string {
  const { data, width, style, logoDataUrl } = input;
  const marginPx = Math.max(0, style.margin ?? 8);
  const withLogo = Boolean(logoDataUrl);
  const ecc: 'M' | 'H' = withLogo ? 'H' : 'M';

  const qr = qrcode(0, ecc);
  qr.addData(data);
  qr.make();

  const count = qr.getModuleCount();
  const usable = Math.max(width - marginPx * 2, count);
  const moduleSize = usable / count;
  const offset = (width - moduleSize * count) / 2;

  const fg = resolveForeground(style);
  const bg = resolveBackground(style);
  const fillAttr = fg.paint;

  const parts: string[] = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${width}" viewBox="0 0 ${width} ${width}">`,
  );

  if (fg.defs) {
    parts.push(`<defs>${fg.defs}</defs>`);
  }

  if (bg !== 'none') {
    parts.push(
      `<rect x="0" y="0" width="${width}" height="${width}" fill="${escapeXml(bg)}"/>`,
    );
  }

  const logoClear = withLogo
    ? computeLogoClearArea(count, style.logoSize ?? 0.25)
    : null;

  const bodyGroup: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.isDark(row, col)) continue;
      if (isInFinderPattern(row, col, count)) continue;
      if (logoClear && isInLogoClear(row, col, logoClear)) continue;

      const x = offset + col * moduleSize;
      const y = offset + row * moduleSize;
      bodyGroup.push(renderBodyModule(style.bodyShape, x, y, moduleSize, fillAttr));
    }
  }
  parts.push(`<g fill="${escapeXml(fillAttr)}">${bodyGroup.join('')}</g>`);

  parts.push(
    renderFinder(
      offset,
      offset,
      moduleSize,
      style.eyeFrameShape,
      style.eyeShape,
      fillAttr,
      bg,
    ),
  );
  parts.push(
    renderFinder(
      offset + (count - 7) * moduleSize,
      offset,
      moduleSize,
      style.eyeFrameShape,
      style.eyeShape,
      fillAttr,
      bg,
    ),
  );
  parts.push(
    renderFinder(
      offset,
      offset + (count - 7) * moduleSize,
      moduleSize,
      style.eyeFrameShape,
      style.eyeShape,
      fillAttr,
      bg,
    ),
  );

  if (logoDataUrl && logoClear) {
    const logoPx = logoClear.size * moduleSize;
    const logoX = offset + logoClear.start * moduleSize;
    const logoY = offset + logoClear.start * moduleSize;
    parts.push(
      `<image x="${fmt(logoX)}" y="${fmt(logoY)}" width="${fmt(logoPx)}" height="${fmt(logoPx)}" preserveAspectRatio="xMidYMid meet" xlink:href="${escapeXml(logoDataUrl)}"/>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join('');
}

function resolveForeground(style: QrStyleDto): { paint: string; defs?: string } {
  const gradient = style.foregroundGradient;
  if (!gradient?.colorStops?.length) {
    return { paint: style.foregroundColor ?? '#000000' };
  }

  const stops = gradient.colorStops
    .map(
      (stop) =>
        `<stop offset="${clamp01(stop.offset) * 100}%" stop-color="${escapeXml(stop.color)}"/>`,
    )
    .join('');

  if (gradient.type === 'radial') {
    return {
      paint: 'url(#qrFg)',
      defs: `<radialGradient id="qrFg" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`,
    };
  }

  const rotation = ((gradient.rotation ?? 0) * 180) / Math.PI;
  return {
    paint: 'url(#qrFg)',
    defs: `<linearGradient id="qrFg" x1="0%" y1="0%" x2="100%" y2="0%" gradientTransform="rotate(${fmt(rotation)} 0.5 0.5)">${stops}</linearGradient>`,
  };
}

function resolveBackground(style: QrStyleDto): string {
  if (style.backgroundColor === 'transparent') return 'none';
  return style.backgroundColor ?? '#ffffff';
}

function renderBodyModule(
  shape: QrBodyShape,
  x: number,
  y: number,
  size: number,
  fill: string,
): string {
  const fillAttr = ` fill="${escapeXml(fill)}"`;
  switch (shape) {
    case 'dots':
      return `<circle cx="${fmt(x + size / 2)}" cy="${fmt(y + size / 2)}" r="${fmt(size * 0.4)}"${fillAttr}/>`;
    case 'rounded':
      return `<rect x="${fmt(x + size * 0.05)}" y="${fmt(y + size * 0.05)}" width="${fmt(size * 0.9)}" height="${fmt(size * 0.9)}" rx="${fmt(size * 0.25)}" ry="${fmt(size * 0.25)}"${fillAttr}/>`;
    case 'extra-rounded':
      return `<rect x="${fmt(x + size * 0.05)}" y="${fmt(y + size * 0.05)}" width="${fmt(size * 0.9)}" height="${fmt(size * 0.9)}" rx="${fmt(size * 0.45)}" ry="${fmt(size * 0.45)}"${fillAttr}/>`;
    case 'classy':
    case 'classy-rounded':
      return `<rect x="${fmt(x + size * 0.08)}" y="${fmt(y + size * 0.08)}" width="${fmt(size * 0.84)}" height="${fmt(size * 0.84)}" rx="${fmt(size * 0.2)}" ry="${fmt(size * 0.2)}"${fillAttr}/>`;
    case 'square':
    default:
      return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}"${fillAttr}/>`;
  }
}

function renderFinder(
  x: number,
  y: number,
  moduleSize: number,
  frame: QrEyeFrameShape,
  eye: QrEyeShape,
  fg: string,
  bg: string,
): string {
  const size = moduleSize * 7;
  const parts: string[] = [`<g>`];

  if (frame === 'dot') {
    const cx = x + size / 2;
    const cy = y + size / 2;
    parts.push(
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(size / 2)}" fill="${escapeXml(fg)}"/>`,
    );
    parts.push(
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(size * (5 / 14))}" fill="${escapeXml(bg === 'none' ? '#ffffff' : bg)}"/>`,
    );
  } else {
    const rx = frame === 'extra-rounded' ? moduleSize : 0;
    parts.push(
      `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(rx)}" ry="${fmt(rx)}" fill="${escapeXml(fg)}"/>`,
    );
    parts.push(
      `<rect x="${fmt(x + moduleSize)}" y="${fmt(y + moduleSize)}" width="${fmt(moduleSize * 5)}" height="${fmt(moduleSize * 5)}" rx="${fmt(rx * 0.7)}" ry="${fmt(rx * 0.7)}" fill="${escapeXml(bg === 'none' ? '#ffffff' : bg)}"/>`,
    );
  }

  const eyeSize = moduleSize * 3;
  const eyeX = x + moduleSize * 2;
  const eyeY = y + moduleSize * 2;
  if (eye === 'dot') {
    parts.push(
      `<circle cx="${fmt(eyeX + eyeSize / 2)}" cy="${fmt(eyeY + eyeSize / 2)}" r="${fmt(eyeSize / 2)}" fill="${escapeXml(fg)}"/>`,
    );
  } else {
    parts.push(
      `<rect x="${fmt(eyeX)}" y="${fmt(eyeY)}" width="${fmt(eyeSize)}" height="${fmt(eyeSize)}" fill="${escapeXml(fg)}"/>`,
    );
  }

  parts.push(`</g>`);
  return parts.join('');
}

function isInFinderPattern(row: number, col: number, count: number): boolean {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= count - 7;
  const inBottomLeft = row >= count - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

function computeLogoClearArea(count: number, logoSize: number) {
  const ratio = Math.min(Math.max(logoSize, 0.15), 0.4);
  let clear = Math.max(5, Math.round(count * ratio));
  if (clear % 2 === 0) clear += 1;
  const start = Math.floor((count - clear) / 2);
  return { start, size: clear };
}

function isInLogoClear(
  row: number,
  col: number,
  area: { start: number; size: number },
): boolean {
  return (
    row >= area.start &&
    row < area.start + area.size &&
    col >= area.start &&
    col < area.start + area.size
  );
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function fmt(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
