import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewsletterAssetUploadResultDto } from '@mali-one/shared';
import { optimizeEmailImage, type EmailImage } from '../../core/email-delivery/email-image';
import { S3Service } from '../../core/s3/s3.service';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const NEWSLETTER_ASSET_MAX_BYTES = 40 * 1024 * 1024;

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
  const cleaned = (typeof raw === 'string' ? raw : 'catalog').replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.slice(0, 80) || 'catalog';
}

@Injectable()
export class NewsletterAssetsService {
  private readonly logger = new Logger(NewsletterAssetsService.name);

  constructor(
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {}

  get maxUploadBytes(): number {
    const configuredMb = Number(
      this.config.get('NEWSLETTER_ASSET_MAX_MB') ?? this.config.get('UPLOAD_MAX_MB') ?? 40,
    );
    const configuredBytes = Math.floor(configuredMb * 1024 * 1024);
    return Number.isFinite(configuredBytes) && configuredBytes > 0
      ? Math.min(configuredBytes, NEWSLETTER_ASSET_MAX_BYTES)
      : NEWSLETTER_ASSET_MAX_BYTES;
  }

  async upload(
    file: UploadedFile | undefined,
    scopeRaw?: string,
  ): Promise<NewsletterAssetUploadResultDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Archivo requerido');
    }

    // Email HTML needs a stable public URL; signed URLs expire (~7d).
    if (this.config.get<string>('S3_PUBLIC_READ') !== 'true') {
      throw new BadRequestException(
        'Las imágenes de newsletter requieren S3_PUBLIC_READ=true (URL pública estable para el email).',
      );
    }

    const mime = (file.mimetype || '').toLowerCase();
    const originalName = file.originalname || 'upload';
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException(
        'Formato no permitido. Usa JPG, PNG, GIF o WebP.',
      );
    }

    if (file.size > this.maxUploadBytes) {
      throw new PayloadTooLargeException(`El archivo supera ${this.maxUploadBytes / (1024 * 1024)} MB`);
    }

    const originalBytes = file.size;
    const isGif = mime === 'image/gif';
    let image: EmailImage;
    try {
      image = await optimizeEmailImage(file.buffer, mime);
    } catch {
      throw new BadRequestException(
        isGif ? 'El archivo no es un GIF válido.' : 'No se pudo procesar la imagen. Prueba otro JPG/PNG/WebP.',
      );
    }
    const uploadName = isGif ? originalName : toJpegFileName(originalName);

    const scope = sanitizeScope(scopeRaw);
    const key = this.s3.buildNewsletterAssetKey(scope, uploadName);
    let url: string;
    try {
      url = await this.s3.uploadFile(key, image.buffer, image.mimeType);
    } catch (error) {
      const code = error instanceof Error ? error.name : 'unknown';
      this.logger.warn(`No se pudo escribir una imagen de boletín en S3 (${code})`);
      throw new ServiceUnavailableException(
        'No se pudo guardar la imagen en S3. Si el error continúa, revisa los permisos de escritura del servidor.',
      );
    }
    if (!await this.s3.isPubliclyReadable(key).catch(() => false)) {
      await this.s3.deleteFile(key).catch(() => undefined);
      throw new ServiceUnavailableException(
        'La imagen no se puede abrir sin iniciar sesión. Verifica la lectura pública del prefijo de boletines en S3.',
      );
    }

    return {
      url,
      key,
      fileName: uploadName,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      originalBytes,
      optimizedBytes: image.buffer.length,
    };
  }
}
