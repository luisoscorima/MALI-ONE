import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailEventType,
  EmailSendStatus,
  NewsletterStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateNewsletterDto,
  UpdateNewsletterDto,
} from './dto/newsletter.dto';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

@Injectable()
export class NewslettersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get appUrl(): string {
    return String(this.config.get('APP_URL') ?? 'http://localhost:5173')
      .trim()
      .replace(/\/$/, '');
  }

  list() {
    return this.prisma.newsletter.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { campaigns: true } },
        createdBy: { select: { email: true, name: true } },
      },
    });
  }

  /** Published newsletters available to send from CRM PAM. */
  listPublished() {
    return this.prisma.newsletter.findMany({
      where: { status: NewsletterStatus.published },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subject: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async get(id: string) {
    const row = await this.prisma.newsletter.findUnique({
      where: { id },
      include: {
        createdBy: { select: { email: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Boletín no encontrado');
    return {
      ...row,
      publicUrl:
        row.status === NewsletterStatus.published
          ? `${this.appUrl}/n/${row.slug}`
          : null,
    };
  }

  async getPublishedBySlug(slug: string) {
    const row = await this.prisma.newsletter.findFirst({
      where: { slug, status: NewsletterStatus.published },
    });
    if (!row) throw new NotFoundException('Boletín no publicado');
    return row;
  }

  async create(userId: string, dto: CreateNewsletterDto) {
    try {
      return await this.prisma.newsletter.create({
        data: {
          slug: dto.slug.trim().toLowerCase(),
          title: dto.title.trim(),
          subject: dto.subject.trim(),
          htmlBody: dto.htmlBody,
          designJson: dto.designJson ?? null,
          status: (dto.status as NewsletterStatus) ?? NewsletterStatus.draft,
          createdById: userId,
        },
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('El slug ya existe');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateNewsletterDto) {
    await this.get(id);
    return this.prisma.newsletter.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject.trim() } : {}),
        ...(dto.htmlBody !== undefined ? { htmlBody: dto.htmlBody } : {}),
        ...(dto.designJson !== undefined
          ? { designJson: dto.designJson }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status as NewsletterStatus }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.newsletter.delete({ where: { id } });
    return { ok: true };
  }

  async recordOpen(openToken: string, userAgent?: string) {
    const send = await this.prisma.emailSend.findUnique({
      where: { openToken },
    });
    if (!send || send.status !== EmailSendStatus.sent) {
      return { tracked: false };
    }

    const already = await this.prisma.emailEvent.findFirst({
      where: { sendId: send.id, type: EmailEventType.open },
      select: { id: true },
    });

    await this.prisma.emailEvent.create({
      data: {
        campaignId: send.campaignId,
        sendId: send.id,
        type: EmailEventType.open,
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });

    if (!already) {
      await this.prisma.emailCampaign.update({
        where: { id: send.campaignId },
        data: { openCount: { increment: 1 } },
      });
    }

    return { tracked: true };
  }

  async recordClick(openToken: string, url: string, userAgent?: string) {
    const send = await this.prisma.emailSend.findUnique({
      where: { openToken },
    });
    if (!send) return { tracked: false, url };

    let target = url;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        target = this.appUrl;
      }
    } catch {
      target = this.appUrl;
    }

    await this.prisma.emailEvent.create({
      data: {
        campaignId: send.campaignId,
        sendId: send.id,
        type: EmailEventType.click,
        url: target.slice(0, 2000),
        userAgent: userAgent?.slice(0, 500) ?? null,
      },
    });
    await this.prisma.emailCampaign.update({
      where: { id: send.campaignId },
      data: { clickCount: { increment: 1 } },
    });

    return { tracked: true, url: target };
  }

  getPixelBuffer(): Buffer {
    return PIXEL_GIF;
  }

  injectTracking(html: string, openToken: string): string {
    const pixelUrl = `${this.appUrl}/mail/o/${openToken}.gif`;
    const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;

    let out = html;
    out = out.replace(
      /href=(["'])(https?:\/\/[^"']+)\1/gi,
      (_m, q: string, href: string) => {
        const tracked = `${this.appUrl}/mail/c/${openToken}?u=${encodeURIComponent(href)}`;
        return `href=${q}${tracked}${q}`;
      },
    );

    if (/<\/body>/i.test(out)) {
      return out.replace(/<\/body>/i, `${pixel}</body>`);
    }
    return `${out}${pixel}`;
  }
}
