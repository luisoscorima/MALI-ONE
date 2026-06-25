import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  constructor(private readonly config: ConfigService) {}

  async generateForUrl(url: string): Promise<string> {
    return QRCode.toDataURL(url, { margin: 2, width: 320 });
  }

  async generatePngBuffer(url: string): Promise<Buffer> {
    return QRCode.toBuffer(url, { margin: 2, width: 512, type: 'png' });
  }

  buildShortUrl(slug: string): string {
    const appUrl = this.config.getOrThrow<string>('APP_URL').replace(/\/$/, '');
    return `${appUrl}/r/${slug}`;
  }
}
