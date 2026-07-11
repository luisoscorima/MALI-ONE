import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QRCodeCanvas } from '@loskir/styled-qr-code-node';
import type { Options as QrCodeOptions } from '@loskir/styled-qr-code-node';
import type { QrStyleDto } from '@mali-one/shared';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { S3Service } from '../s3/s3.service';
import { buildAdobeSafeQrSvg } from './qr-adobe-svg';
import { getLogoUrl, sanitizeQrStyleForRender } from './qr-style.util';

const execFileAsync = promisify(execFile);

export type QrExportFormat = 'png' | 'svg' | 'eps';

@Injectable()
export class QrService {
  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
  ) {}

  buildShortUrl(slug: string): string {
    const appUrl = this.config.getOrThrow<string>('APP_URL').replace(/\/$/, '');
    return `${appUrl}/r/${slug}`;
  }

  async generateForUrl(
    url: string,
    style: QrStyleDto,
    qrLogoKey?: string | null,
    width = 320,
  ): Promise<string> {
    const buffer = await this.generatePngFromStyled(
      url,
      style,
      qrLogoKey,
      width,
    );
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  async generatePngBuffer(
    url: string,
    style: QrStyleDto,
    qrLogoKey?: string | null,
    width = 512,
    logoOverride?: { buffer: Buffer; mimeType: string },
    options?: { minRenderWidth?: number },
  ): Promise<Buffer> {
    const logoOverrideUrl = logoOverride
      ? `data:${logoOverride.mimeType};base64,${logoOverride.buffer.toString('base64')}`
      : undefined;
    return this.generatePngFromStyled(
      url,
      style,
      qrLogoKey,
      width,
      logoOverrideUrl,
      options?.minRenderWidth ?? 512,
    );
  }

  async generateExport(
    url: string,
    style: QrStyleDto,
    format: QrExportFormat,
    qrLogoKey?: string | null,
    width = 512,
  ): Promise<Buffer> {
    if (format === 'png') {
      return this.generatePngFromStyled(url, style, qrLogoKey, width);
    }

    const svg = await this.generateAdobeSafeSvg(url, style, qrLogoKey, width);
    if (format === 'eps') {
      return this.convertSvgToEps(svg);
    }
    return svg;
  }

  private async generateAdobeSafeSvg(
    url: string,
    style: QrStyleDto,
    qrLogoKey: string | null | undefined,
    width: number,
  ): Promise<Buffer> {
    const safeStyle = sanitizeQrStyleForRender(style);
    const logoDataUrl = await this.resolveLogoDataUrl(safeStyle, qrLogoKey);

    const svg = buildAdobeSafeQrSvg({
      data: url,
      width,
      style: safeStyle,
      logoDataUrl,
    });
    return Buffer.from(svg, 'utf8');
  }

  private async buildQrOptions(
    url: string,
    style: QrStyleDto,
    qrLogoKey: string | null | undefined,
    width: number,
    logoOverrideUrl?: string,
  ): Promise<QrCodeOptions> {
    const safeStyle = sanitizeQrStyleForRender(style);
    const logoUrl =
      logoOverrideUrl ??
      (await this.resolveLogoDataUrl(safeStyle, qrLogoKey));
    const withLogo = Boolean(logoUrl);

    const fgColor = safeStyle.foregroundGradient
      ? undefined
      : (safeStyle.foregroundColor ?? '#000000');

    const bg =
      safeStyle.backgroundColor === 'transparent'
        ? 'rgba(255,255,255,0)'
        : (safeStyle.backgroundColor ?? '#ffffff');

    const gradient = safeStyle.foregroundGradient
      ? {
          type: safeStyle.foregroundGradient.type,
          rotation: safeStyle.foregroundGradient.rotation ?? 0,
          colorStops: safeStyle.foregroundGradient.colorStops,
        }
      : undefined;

    const errorCorrectionLevel = withLogo ? 'H' : 'M';

    return {
      width,
      height: width,
      data: url,
      margin: safeStyle.margin ?? 8,
      image: logoUrl,
      qrOptions: {
        errorCorrectionLevel,
      },
      imageOptions: {
        hideBackgroundDots: true,
        imageSize: safeStyle.logoSize ?? 0.25,
        margin: 4,
        crossOrigin: 'anonymous',
      },
      dotsOptions: {
        type: safeStyle.bodyShape,
        color: fgColor,
        gradient,
      },
      cornersSquareOptions: {
        type: safeStyle.eyeFrameShape,
        color: fgColor,
        gradient,
      },
      cornersDotOptions: {
        type: safeStyle.eyeShape,
        color: fgColor,
        gradient,
      },
      backgroundOptions: {
        color: bg,
      },
    };
  }

  private async resolveLogoDataUrl(
    style: QrStyleDto,
    qrLogoKey?: string | null,
  ): Promise<string | undefined> {
    if (qrLogoKey) {
      try {
        const { buffer, contentType } = await this.s3.getFileBuffer(qrLogoKey);
        const mime = contentType.startsWith('image/')
          ? contentType
          : 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error desconocido';
        throw new InternalServerErrorException(
          `No se pudo leer el logo del QR desde S3. Detalle: ${message}`,
        );
      }
    }

    const presetUrl = getLogoUrl(style, null);
    if (!presetUrl) return undefined;
    return this.toEmbeddedImageUrl(presetUrl);
  }

  private async generatePngFromStyled(
    url: string,
    style: QrStyleDto,
    qrLogoKey: string | null | undefined,
    width: number,
    logoOverrideUrl?: string,
    minPngWidth = 512,
  ): Promise<Buffer> {
    const renderWidth = Math.max(width, minPngWidth);
    const options = await this.buildQrOptions(
      url,
      style,
      qrLogoKey,
      renderWidth,
      logoOverrideUrl,
    );
    const qr = new QRCodeCanvas(options);
    const output = await qr.toBuffer('png');
    return Buffer.isBuffer(output) ? output : Buffer.from(String(output), 'utf8');
  }

  private async toEmbeddedImageUrl(imageUrl: string): Promise<string> {
    if (imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') ?? 'image/png';

      if (!contentType.startsWith('image/')) {
        throw new Error(`Tipo de contenido inválido: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Timeout al descargar el logo'
          : error instanceof Error
            ? error.message
            : 'Error desconocido';

      throw new InternalServerErrorException(
        `No se pudo embeber el logo del QR en base64. Detalle: ${message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async convertSvgToEps(svg: Buffer): Promise<Buffer> {
    const dir = await mkdtemp(join(tmpdir(), 'qr-export-'));
    const input = join(dir, 'qr.svg');
    const output = join(dir, 'qr.eps');
    const inkscapeBin = this.config.get<string>('INKSCAPE_BIN') ?? 'inkscape';

    try {
      await writeFile(input, svg);
      await execFileAsync(
        inkscapeBin,
        [input, '--export-type=eps', `--export-filename=${output}`],
        {
          timeout: 15000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      try {
        await access(output);
      } catch {
        throw new Error(
          'Inkscape terminó sin generar el archivo EPS de salida',
        );
      }

      return await readFile(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo convertir el QR a EPS. Verifica que Inkscape esté instalado en el servidor. Detalle: ${message}`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}
