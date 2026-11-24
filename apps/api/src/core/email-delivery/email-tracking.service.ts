import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailEventType, EmailSendStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyEmailMergeTags, firstNameFromDisplayName } from './email-merge-tags';
import { stripViewInBrowserFromHtml } from './strip-view-in-browser';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export type EmailComposeMode = 'email' | 'browser';

export interface ComposeEmailHtmlOptions {
  openToken: string;
  unsubscribeUrl?: string;
  viewInBrowserUrl?: string;
  /** `email` (default): track links + open pixel + optional view link. `browser`: unsubscribe only. */
  mode?: EmailComposeMode;
}

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

  /**
   * Shared HTML chrome for the outbound message and the frozen browser view.
   * Browser mode keeps personalization + unsubscribe, without open pixel or click rewriting.
   */
  composeHtml(html: string, options: ComposeEmailHtmlOptions): string {
    const mode = options.mode ?? 'email';
    // Always drop legacy/historical “ver en navegador” (/n/:slug, spans, etc.)
    // so outbound mail and browser views never keep an old public archive link.
    let out = stripViewInBrowserFromHtml(html);

    if (mode === 'email') {
      out = out.replace(
        /href=(["'])(https?:\/\/[^"']+)\1/gi,
        (_match, quote: string, href: string) => {
          const tracked = this.publicUrl(
            `mail/c/${options.openToken}?u=${encodeURIComponent(href)}`,
          );
          return `href=${quote}${tracked}${quote}`;
        },
      );
    }

    // After link rewriting so the view URL stays a direct (untracked) public URL.
    if (mode === 'email' && options.viewInBrowserUrl) {
      const viewBlock = `<div data-mali-view-in-browser style="margin:0 auto 16px;max-width:640px;padding:12px 16px;text-align:center;font:12px/1.5 Arial,sans-serif;color:#6b7280"><a href="${escapeAttribute(options.viewInBrowserUrl)}" style="color:#4b5563;text-decoration:underline">Ver este correo en el navegador</a></div>`;
      if (/<body\b[^>]*>/i.test(out)) {
        out = out.replace(/<body\b[^>]*>/i, (open) => `${open}${viewBlock}`);
      } else {
        out = `${viewBlock}${out}`;
      }
    }

    const unsubscribe = options.unsubscribeUrl
      ? `<div style="margin:32px auto 0;max-width:640px;padding:16px;text-align:center;font:12px/1.5 Arial,sans-serif;color:#6b7280">Recibes este correo porque formas parte de la audiencia de comunicaciones del MALI. <a href="${escapeAttribute(options.unsubscribeUrl)}" style="color:#4b5563;text-decoration:underline">Cancelar suscripción</a>.</div>`
      : '';
    const pixel =
      mode === 'email'
        ? `<img src="${this.publicUrl(`mail/o/${options.openToken}.gif`)}" width="1" height="1" alt="" style="display:none" />`
        : '';
    const additions = `${unsubscribe}${pixel}`;

    if (/<\/body>/i.test(out)) {
      return out.replace(/<\/body>/i, `${additions}</body>`);
    }
    return `${out}${additions}`;
  }

  /** Outbound email: tracking + optional view-in-browser + unsubscribe. */
  inject(
    html: string,
    openToken: string,
    unsubscribeUrl?: string,
    viewInBrowserUrl?: string,
  ): string {
    return this.composeHtml(html, {
      openToken,
      unsubscribeUrl,
      viewInBrowserUrl,
      mode: 'email',
    });
  }

  /**
   * Frozen campaign snapshot for a sent recipient. Does not record an open.
   * @throws NotFoundException when token is unknown or the send never left.
   */
  async renderBrowserView(openToken: string): Promise<string> {
    const token = openToken.trim();
    const send = await this.prisma.emailSend.findUnique({
      where: { openToken: token },
      select: {
        openToken: true,
        sentAt: true,
        name: true,
        campaign: {
          select: {
            htmlSnapshot: true,
            unsubscribePath: true,
          },
        },
      },
    });
    if (!send?.sentAt) {
      throw new NotFoundException('Correo no encontrado');
    }

    const firstName = firstNameFromDisplayName(send.name);
    const personalizedHtml = applyEmailMergeTags(send.campaign.htmlSnapshot, {
      firstName,
    });
    const unsubscribeUrl = send.campaign.unsubscribePath
      ? this.publicUrl(`${send.campaign.unsubscribePath}/${send.openToken}`)
      : undefined;

    return this.composeHtml(personalizedHtml, {
      openToken: send.openToken,
      unsubscribeUrl,
      mode: 'browser',
    });
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
