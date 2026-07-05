import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QRCodeCanvas } from '@loskir/styled-qr-code-node';
import type { QrStyleDto } from '@mali-one/shared';
import { getLogoUrl, hasLogo } from './qr-style.util';

export type QrExportFormat = 'png' | 'svg' | 'eps';

@Injectable()
export class QrService {
  constructor(private readonly config: ConfigService) {}

  buildShortUrl(slug: string): string {
    const appUrl = this.config.getOrThrow<string>('APP_URL').replace(/\/$/, '');
    return `${appUrl}/r/${slug}`;
  }

  buildS3PublicUrl(key: string): string {
    const region = this.config.getOrThrow<string>('AWS_REGION');
    const bucket = this.config.getOrThrow<string>('AWS_S3_BUCKET');
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async generateForUrl(
    url: string,
    style: QrStyleDto,
    qrLogoKey?: string | null,
    width = 320,
  ): Promise<string> {
    const buffer = await this.generateBuffer(url, style, qrLogoKey, 'png', width);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  async generatePngBuffer(
    url: string,
    style: QrStyleDto,
    qrLogoKey?: string | null,
    width = 512,
  ): Promise<Buffer> {
    return this.generateBuffer(url, style, qrLogoKey, 'png', width);
  }

  async generateExport(
    url: string,
    style: QrStyleDto,
    format: QrExportFormat,
    qrLogoKey?: string | null,
    width = 512,
  ): Promise<Buffer> {
    if (format === 'eps') {
      const svg = await this.generateBuffer(
        url,
        style,
        qrLogoKey,
        'svg',
        width,
      );
      return Buffer.from(this.svgToEps(svg.toString('utf8')), 'utf8');
    }
    return this.generateBuffer(url, style, qrLogoKey, format, width);
  }

  private buildQrInstance(
    url: string,
    style: QrStyleDto,
    qrLogoKey: string | null | undefined,
    width: number,
  ) {
    const logoUrl = getLogoUrl(style, qrLogoKey, (key) =>
      this.buildS3PublicUrl(key),
    );
    const withLogo = hasLogo(style, qrLogoKey);

    const fgColor = style.foregroundGradient
      ? undefined
      : (style.foregroundColor ?? '#000000');

    const bg =
      style.backgroundColor === 'transparent'
        ? 'rgba(255,255,255,0)'
        : (style.backgroundColor ?? '#ffffff');

    const gradient = style.foregroundGradient
      ? {
          type: style.foregroundGradient.type,
          rotation: style.foregroundGradient.rotation ?? 0,
          colorStops: style.foregroundGradient.colorStops,
        }
      : undefined;

    return new QRCodeCanvas({
      width,
      height: width,
      data: url,
      margin: style.margin ?? 8,
      image: logoUrl,
      qrOptions: {
        errorCorrectionLevel: withLogo ? 'H' : 'M',
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: style.logoSize ?? 0.25,
        margin: 4,
        crossOrigin: 'anonymous',
      },
      dotsOptions: {
        type: style.bodyShape,
        color: fgColor,
        gradient,
      },
      cornersSquareOptions: {
        type: style.eyeFrameShape,
        color: fgColor,
        gradient,
      },
      cornersDotOptions: {
        type: style.eyeShape,
        color: fgColor,
        gradient,
      },
      backgroundOptions: {
        color: bg,
      },
    });
  }

  private async generateBuffer(
    url: string,
    style: QrStyleDto,
    qrLogoKey: string | null | undefined,
    format: 'png' | 'svg',
    width: number,
  ): Promise<Buffer> {
    const qr = this.buildQrInstance(url, style, qrLogoKey, width);
    return qr.toBuffer(format);
  }

  private svgToEps(svg: string): string {
    const wMatch = svg.match(/width="(\d+)"/);
    const hMatch = svg.match(/height="(\d+)"/);
    const w = wMatch ? Number(wMatch[1]) : 512;
    const h = hMatch ? Number(hMatch[1]) : 512;
    const escaped = svg
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    return `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 ${w} ${h}
%%Creator: MALI ONE
%%Title: QR Code
gsave
0 ${h} translate
1 -1 scale
(${escaped}) svg exec
grestore
showpage
%%EOF
`;
  }
}
