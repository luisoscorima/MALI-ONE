import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { S3Service } from '../s3/s3.service';
import { optimizeEmailImage } from './email-image';

// Same shape as the web editor: GrapesJS can keep raw or escaped line breaks inside the payload.
const EMBEDDED_IMAGE = /data:image\/([a-z0-9.+-]+);base64,((?:[a-z0-9+/=\n\r]|\\[nr])+)/gi;
const BASE64_BREAKS = /\s|\\[nr]/g;
const SUPPORTED_MIME = new Map([
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
]);

/**
 * Gmail does not render data: images and clips messages over ~102 KB, which also
 * drops the open pixel. Every outbound HTML must reference hosted images instead.
 */
@Injectable()
export class EmailInlineImagesService {
  private readonly uploads = new Map<string, Promise<string>>();

  constructor(
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {}

  async externalize(html: string): Promise<string> {
    if (!/data:image\//i.test(html)) return html;
    if (this.config.get<string>('S3_PUBLIC_READ') !== 'true') {
      throw new Error('S3_PUBLIC_READ debe estar activo para alojar imágenes de correo');
    }

    const urls = new Map<string, string>();
    for (const [uri, subtype, base64] of html.matchAll(EMBEDDED_IMAGE)) {
      const mimeType = SUPPORTED_MIME.get(subtype.toLowerCase());
      if (!mimeType || urls.has(uri)) continue;
      urls.set(uri, await this.hosted(base64.replace(BASE64_BREAKS, ''), mimeType));
    }
    return html.replace(EMBEDDED_IMAGE, (uri) => urls.get(uri) ?? uri);
  }

  /** Content-addressed key: re-sending the same snapshot reuses the object instead of re-uploading. */
  private hosted(base64: string, mimeType: string): Promise<string> {
    const hash = createHash('sha256').update(base64).digest('hex');
    let pending = this.uploads.get(hash);
    if (!pending) {
      pending = this.upload(hash, base64, mimeType);
      pending.catch(() => this.uploads.delete(hash));
      this.uploads.set(hash, pending);
    }
    return pending;
  }

  private async upload(hash: string, base64: string, mimeType: string): Promise<string> {
    const image = await optimizeEmailImage(Buffer.from(base64, 'base64'), mimeType);
    const extension = image.mimeType === 'image/gif' ? 'gif' : 'jpg';
    const key = `newsletters/inline/${hash}.${extension}`;
    const url = await this.s3.uploadFile(key, image.buffer, image.mimeType);
    if (!await this.s3.isPubliclyReadable(key).catch(() => false)) {
      throw new Error(`La imagen alojada no es pública: ${key}`);
    }
    return url;
  }
}
