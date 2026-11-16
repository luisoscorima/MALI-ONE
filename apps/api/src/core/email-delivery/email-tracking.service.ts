import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailEventType, EmailSendStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Injectable()
export class EmailTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get appUrl(): string {
    return String(this.config.get('APP_URL') ?? 'http://localhost:5173')
      .trim()
      .replace(/\/$/, '');
  }

  publicUrl(path: string): string {
    return `${this.appUrl}/${path.replace(/^\/+|\/+$/g, '')}`;
  }

  getPixelBuffer(): Buffer {
    return PIXEL_GIF;
  }

  inject(html: string, openToken: string, unsubscribeUrl?: string): string {
    const pixelUrl = this.publicUrl(`mail/o/${openToken}.gif`);
    const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;

    let out = html.replace(
      /href=(["'])(https?:\/\/[^"']+)\1/gi,
      (_match, quote: string, href: string) => {
        const tracked = this.publicUrl(
          `mail/c/${openToken}?u=${encodeURIComponent(href)}`,
        );
        return `href=${quote}${tracked}${quote}`;
      },
    );

    const unsubscribe = unsubscribeUrl
      ? `<div style="margin:32px auto 0;max-width:640px;padding:16px;text-align:center;font:12px/1.5 Arial,sans-serif;color:#6b7280">Recibes este correo porque formas parte de la audiencia de comunicaciones del MALI. <a href="${escapeAttribute(unsubscribeUrl)}" style="color:#4b5563;text-decoration:underline">Cancelar suscripción</a>.</div>`
      : '';
    const additions = `${unsubscribe}${pixel}`;

    if (/<\/body>/i.test(out)) {
      return out.replace(/<\/body>/i, `${additions}</body>`);
    }
    return `${out}${additions}`;
  }

  async recordOpen(openToken: string, userAgent?: string) {
    const send = await this.prisma.emailSend.findUnique({ where: { openToken } });
    if (!send || send.status !== EmailSendStatus.sent) return { tracked: false };

    await this.prisma.$transaction(async (tx) => {
      await tx.emailEvent.create({
        data: {
          campaignId: send.campaignId,
          sendId: send.id,
          type: EmailEventType.open,
          userAgent: userAgent?.slice(0, 500) ?? null,
        },
      });
      const first = await tx.emailSend.updateMany({
        where: { id: send.id, openedAt: null },
        data: { openedAt: new Date() },
      });
      if (first.count) {
        await tx.emailCampaign.update({
          where: { id: send.campaignId },
          data: { openCount: { increment: 1 } },
        });
      }
    });
    return { tracked: true };
  }

  async recordClick(openToken: string, url: string, userAgent?: string) {
    const send = await this.prisma.emailSend.findUnique({ where: { openToken } });
    if (!send) return { tracked: false, url: this.appUrl };

    let target = url;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) target = this.appUrl;
    } catch {
      target = this.appUrl;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.emailEvent.create({
        data: {
          campaignId: send.campaignId,
          sendId: send.id,
          type: EmailEventType.click,
          url: target.slice(0, 2000),
          userAgent: userAgent?.slice(0, 500) ?? null,
        },
      });
      const first = await tx.emailSend.updateMany({
        where: { id: send.id, clickedAt: null },
        data: { clickedAt: new Date() },
      });
      if (first.count) {
        await tx.emailCampaign.update({
          where: { id: send.campaignId },
          data: { clickCount: { increment: 1 } },
        });
      }
    });
    return { tracked: true, url: target };
  }
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
