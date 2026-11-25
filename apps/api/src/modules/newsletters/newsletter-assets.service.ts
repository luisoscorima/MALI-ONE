import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewsletterAssetUploadResultDto } from '@mali-one/shared';
import sharp from 'sharp';
import { S3Service } from '../../core/s3/s3.service';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const OPTIMIZE_TO_JPEG = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Max edge for email HTML (banners ~600px wide; headroom for retina). */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 85;

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

function toJpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}.jpg`;
}

function sanitizeScope(raw: string | undefined): string {
  const cleaned = (raw || 'library').replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 80) || 'library';
}

@Injectable()
export class NewsletterAssetsService {
  constructor(
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {}

  async upload(
    file: UploadedFile | undefined,
    scopeRaw?: string,
  ): Promise<NewsletterAssetUploadResultDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }

    const mime = (file.mimetype || '').toLowerCase();
    const originalName = file.originalname || 'upload';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Formato no permitido. Usa JPG, PNG, GIF o WebP.',
      );
    }

    const maxMb = Number(
      this.config.get('NEWSLETTER_ASSET_MAX_MB') ??
        this.config.get('UPLOAD_MAX_MB') ??
        40,
    );
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`El archivo supera ${maxMb} MB`);
    }

    const originalBytes = file.size;
    let uploadBuffer = file.buffer;
    let uploadMime = mime;
    let uploadName = originalName;
    let width: number | null = null;
    let height: number | null = null;

    if (OPTIMIZE_TO_JPEG.has(mime)) {
      try {
        uploadBuffer = await sharp(file.buffer)
          .rotate()
          .resize({
            width: MAX_EDGE,
            height: MAX_EDGE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        const outMeta = await sharp(uploadBuffer).metadata();
        width = outMeta.width ?? null;
        height = outMeta.height ?? null;
        uploadMime = 'image/jpeg';
        uploadName = toJpegFileName(originalName);
      } catch {
        throw new BadRequestException(
          'No se pudo procesar la imagen. Prueba otro JPG/PNG/WebP.',
        );
      }
    } else {
      try {
        const meta = await sharp(file.buffer, { animated: true }).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {
        // GIF metadata is best-effort; still upload the original bytes.
      }
    }

    const scope = sanitizeScope(scopeRaw);
    const key = this.s3.buildNewsletterAssetKey(scope, uploadName);
    const url = await this.s3.uploadFile(key, uploadBuffer, uploadMime);

    return {
      url,
      key,
      fileName: uploadName,
      mimeType: uploadMime,
      width,
      height,
      originalBytes,
      optimizedBytes: uploadBuffer.length,
    };
  }
}
