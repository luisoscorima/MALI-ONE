import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LinkType, Prisma, User, UserRole } from '@prisma/client';
import type { LinkStatsDto, QrStyleDto } from '@mali-one/shared';
import { DEFAULT_QR_STYLE } from '@mali-one/shared';
import { customAlphabet } from 'nanoid';
import UAParserPkg from 'ua-parser-js';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  cloneQrStyleForCreate,
  resolveEffectiveQrStyle,
} from '../../core/qr/qr-style.util';
import { QrExportFormat, QrService } from '../../core/qr/qr.service';
import { RedisService } from '../../core/redis/redis.service';
import { S3Service } from '../../core/s3/s3.service';
import { UpdateQrStyleDto } from './dto/update-qr-style.dto';

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const generateSlug = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  8,
);

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly qr: QrService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
  ) {}

  async shortenUrl(
    user: User,
    url: string,
    customSlug?: string,
    tags?: string[],
  ) {
    const link = await this.createUrlLink(user, url, customSlug, tags);
    return this.toDto(link);
  }

  private async createUrlLink(
    user: User,
    url: string,
    customSlug?: string,
    tags?: string[],
  ) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('URL inválida');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Solo se permiten URLs http/https');
    }

    const slug = await this.resolveSlug(customSlug);
    const qrStyle = await this.initialQrStyle(user.id);
    const link = await this.prisma.shortLink.create({
      data: {
        slug,
        targetUrl: parsed.toString(),
        type: LinkType.URL,
        tags: this.normalizeTags(tags),
        qrStyle: qrStyle as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });

    await this.cacheSlug(slug, link.targetUrl);
    return link;
  }

  async bulkShortenUrls(
    user: User,
    items: Array<{ url: string; customSlug?: string; tags?: string[] }>,
  ) {
    const created: Awaited<ReturnType<typeof this.toDto>>[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const link = await this.createUrlLink(
          user,
          items[i].url,
          items[i].customSlug,
          items[i].tags,
        );
        created.push(await this.toDto(link, false));
      } catch (e) {
        errors.push({
          row: i + 2,
          message: e instanceof Error ? e.message : 'Error al acortar URL',
        });
      }
    }

    return { created, errors };
  }

  async bulkCreateWhatsappLinks(
    user: User,
    items: Array<{
      phone: string;
      text?: string;
      customSlug?: string;
      tags?: string[];
    }>,
  ) {
    const created: Awaited<ReturnType<typeof this.toDto>>[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const link = await this.createWhatsappLinkRecord(
          user,
          items[i].phone,
          items[i].text,
          items[i].customSlug,
          items[i].tags,
        );
        created.push(await this.toDto(link, false));
      } catch (e) {
        errors.push({
          row: i + 2,
          message:
            e instanceof Error ? e.message : 'Error al crear enlace WhatsApp',
        });
      }
    }

    return { created, errors };
  }

  async bulkUploadFiles(user: User, files: UploadedFile[]) {
    const created: Awaited<ReturnType<typeof this.toDto>>[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const link = await this.createUploadedFileLink(user, files[i]);
        created.push(await this.toDto(link, false));
      } catch (e) {
        errors.push({
          row: i + 1,
          message: e instanceof Error ? e.message : 'Error al subir archivo',
        });
      }
    }

    return { created, errors };
  }

  async createWhatsappLink(
    user: User,
    phone: string,
    text?: string,
    customSlug?: string,
    tags?: string[],
  ) {
    const link = await this.createWhatsappLinkRecord(
      user,
      phone,
      text,
      customSlug,
      tags,
    );
    return this.toDto(link);
  }

  private async createWhatsappLinkRecord(
    user: User,
    phone: string,
    text?: string,
    customSlug?: string,
    tags?: string[],
  ) {
    const targetUrl = this.buildWhatsappUrl(phone, text);
    const slug = await this.resolveSlug(customSlug);
    const qrStyle = await this.initialQrStyle(user.id);

    const link = await this.prisma.shortLink.create({
      data: {
        slug,
        targetUrl,
        type: LinkType.WHATSAPP,
        tags: this.normalizeTags(tags),
        qrStyle: qrStyle as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });

    await this.cacheSlug(slug, targetUrl);
    return link;
  }

  async uploadFile(
    user: User,
    file: UploadedFile,
    customSlug?: string,
    tags?: string[],
  ) {
    const link = await this.createUploadedFileLink(
      user,
      file,
      customSlug,
      tags,
    );
    return this.toDto(link);
  }

  private async createUploadedFileLink(
    user: User,
    file: UploadedFile,
    customSlug?: string,
    tags?: string[],
  ) {
    if (!file) {
      throw new BadRequestException('Archivo requerido');
    }

    const maxMb = Number(this.config.get('UPLOAD_MAX_MB') ?? 25);
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`El archivo supera ${maxMb} MB`);
    }

    const key = this.s3.buildKey(file.originalname);
    const targetUrl = await this.s3.uploadFile(key, file.buffer, file.mimetype);
    const slug = await this.resolveSlug(customSlug);
    const qrStyle = await this.initialQrStyle(user.id);

    const link = await this.prisma.shortLink.create({
      data: {
        slug,
        targetUrl,
        type: LinkType.FILE,
        s3Key: key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        tags: this.normalizeTags(tags),
        qrStyle: qrStyle as unknown as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });

    await this.cacheSlug(slug, targetUrl);
    return link;
  }

  async listLinks(user: User, tag?: string) {
    const where =
      user.role === UserRole.admin ? {} : { createdById: user.id };
    const normalizedTag = tag?.trim().toLowerCase();

    const links = await this.prisma.shortLink.findMany({
      where: normalizedTag
        ? { ...where, tags: { has: normalizedTag } }
        : where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Promise.all(links.map((l) => this.toDto(l, false)));
  }

  async updateLink(
    user: User,
    id: string,
    input: {
      url?: string;
      phone?: string;
      text?: string;
      tags?: string[];
    },
  ) {
    const link = await this.findOwnedLink(user, id);
    const data: {
      targetUrl?: string;
      tags?: string[];
    } = {};

    if (input.tags !== undefined) {
      data.tags = this.normalizeTags(input.tags);
    }

    if (link.type === LinkType.WHATSAPP) {
      if (input.url !== undefined) {
        throw new BadRequestException(
          'Usa phone y text para editar enlaces de WhatsApp',
        );
      }

      if (input.phone !== undefined || input.text !== undefined) {
        const current = this.parseWhatsappFromUrl(link.targetUrl);
        const phone = input.phone ?? current.phone;
        const text = input.text !== undefined ? input.text : current.text;
        data.targetUrl = this.buildWhatsappUrl(phone, text);
      }
    } else if (link.type === LinkType.URL) {
      if (input.phone !== undefined || input.text !== undefined) {
        throw new BadRequestException(
          'Usa url para editar enlaces de tipo URL',
        );
      }

      if (input.url !== undefined) {
        let parsed: URL;
        try {
          parsed = new URL(input.url);
        } catch {
          throw new BadRequestException('URL inválida');
        }

        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new BadRequestException('Solo se permiten URLs http/https');
        }

        data.targetUrl = parsed.toString();
      }
    } else if (
      input.url !== undefined ||
      input.phone !== undefined ||
      input.text !== undefined
    ) {
      throw new BadRequestException(
        'Los enlaces de archivo solo permiten editar tags',
      );
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No hay cambios para aplicar');
    }

    const updated = await this.prisma.shortLink.update({
      where: { id },
      data,
    });

    if (data.targetUrl) {
      await this.refreshCache(link.slug, data.targetUrl);
    }

    return this.toDto(updated, false);
  }

  async deleteLink(user: User, id: string) {
    const link = await this.prisma.shortLink.findUnique({ where: { id } });
    if (!link) {
      throw new NotFoundException('Enlace no encontrado');
    }
    if (user.role !== UserRole.admin && link.createdById !== user.id) {
      throw new NotFoundException('Enlace no encontrado');
    }

    if (link.s3Key) {
      await this.s3.deleteFile(link.s3Key);
    }
    if (link.qrLogoKey) {
      await this.s3.deleteFile(link.qrLogoKey);
    }

    await this.redis.client.del(`link:${link.slug}`);
    await this.prisma.linkClick.deleteMany({ where: { linkId: id } });
    await this.prisma.shortLink.delete({ where: { id } });
    return { ok: true };
  }

  async getQrExport(
    id: string,
    user: User,
    format: QrExportFormat = 'png',
    width = 512,
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    const link = await this.findOwnedLink(user, id);
    const creator = await this.prisma.user.findUnique({
      where: { id: link.createdById },
      select: { qrDefaultStyle: true },
    });
    const style = resolveEffectiveQrStyle(
      creator?.qrDefaultStyle,
      link.qrStyle,
    );
    const shortUrl = this.qr.buildShortUrl(link.slug);
    const buffer = await this.qr.generateExport(
      shortUrl,
      style,
      format,
      link.qrLogoKey,
      width,
    );

    const meta: Record<
      QrExportFormat,
      { mimeType: string; extension: string }
    > = {
      png: { mimeType: 'image/png', extension: 'png' },
      svg: { mimeType: 'image/svg+xml', extension: 'svg' },
      eps: { mimeType: 'application/postscript', extension: 'eps' },
    };

    return { buffer, ...meta[format] };
  }

  async generateQrPreview(
    user: User,
    data: string,
    input: UpdateQrStyleDto,
    linkId?: string,
    logoFile?: UploadedFile,
    width = 260,
  ): Promise<Buffer> {
    const style = this.mergeQrStyle({ ...DEFAULT_QR_STYLE }, input);
    let qrLogoKey: string | null = null;
    let logoOverride: { buffer: Buffer; mimeType: string } | undefined;

    if (logoFile) {
      logoOverride = { buffer: logoFile.buffer, mimeType: logoFile.mimetype };
    } else if (linkId) {
      const link = await this.findOwnedLink(user, linkId);
      qrLogoKey = link.qrLogoKey;
    }

    return this.qr.generatePngBuffer(
      data,
      style,
      qrLogoKey,
      width,
      logoOverride,
      { minRenderWidth: 280 },
    );
  }

  async getQrDefaultStyle(user: User): Promise<QrStyleDto> {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { qrDefaultStyle: true },
    });
    return resolveEffectiveQrStyle(record?.qrDefaultStyle, null);
  }

  async saveQrDefaultStyle(user: User, input: UpdateQrStyleDto): Promise<QrStyleDto> {
    const current = await this.getQrDefaultStyle(user);
    const merged = this.mergeQrStyle(current, input);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { qrDefaultStyle: merged as unknown as Prisma.InputJsonValue },
    });
    return merged;
  }

  async updateLinkQrStyle(
    user: User,
    id: string,
    input: UpdateQrStyleDto,
    logoFile?: UploadedFile,
    saveAsDefault = false,
  ) {
    const link = await this.findOwnedLink(user, id);
    const creator = await this.prisma.user.findUnique({
      where: { id: link.createdById },
      select: { qrDefaultStyle: true },
    });
    const current = resolveEffectiveQrStyle(
      creator?.qrDefaultStyle,
      link.qrStyle,
    );
    const merged = this.mergeQrStyle(current, input);

    let qrLogoKey = link.qrLogoKey;
    if (input.clearCustomLogo && qrLogoKey) {
      await this.s3.deleteFile(qrLogoKey);
      qrLogoKey = null;
    }
    if (logoFile) {
      if (qrLogoKey) {
        await this.s3.deleteFile(qrLogoKey);
      }
      const maxMb = Number(this.config.get('UPLOAD_MAX_MB') ?? 25);
      if (logoFile.size > maxMb * 1024 * 1024) {
        throw new BadRequestException(`El logo supera ${maxMb} MB`);
      }
      const key = this.s3.buildQrLogoKey(link.id, logoFile.originalname);
      await this.s3.uploadFile(key, logoFile.buffer, logoFile.mimetype);
      qrLogoKey = key;
      merged.logoPreset = null;
    }

    const updated = await this.prisma.shortLink.update({
      where: { id },
      data: {
        qrStyle: merged as unknown as Prisma.InputJsonValue,
        qrLogoKey,
      },
    });

    if (saveAsDefault) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { qrDefaultStyle: merged as unknown as Prisma.InputJsonValue },
      });
    }

    return this.toDto(updated, true, creator?.qrDefaultStyle);
  }

  async removeLinkQrLogo(user: User, id: string) {
    const link = await this.findOwnedLink(user, id);
    if (link.qrLogoKey) {
      await this.s3.deleteFile(link.qrLogoKey);
    }
    const updated = await this.prisma.shortLink.update({
      where: { id },
      data: { qrLogoKey: null },
    });
    const creator = await this.prisma.user.findUnique({
      where: { id: link.createdById },
      select: { qrDefaultStyle: true },
    });
    return this.toDto(updated, true, creator?.qrDefaultStyle);
  }

  async getLinkStats(
    user: User,
    id: string,
    days = 30,
  ): Promise<LinkStatsDto> {
    const link = await this.findOwnedLink(user, id);
    const safeDays = Math.min(Math.max(days, 1), 365);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (safeDays - 1));
    since.setUTCHours(0, 0, 0, 0);

    const clicks = await this.prisma.linkClick.findMany({
      where: { linkId: link.id, clickedAt: { gte: since } },
      select: {
        clickedAt: true,
        deviceType: true,
        browser: true,
        os: true,
      },
    });

    const dayMap = new Map<string, number>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const osMap = new Map<string, number>();

    for (const click of clicks) {
      const dateKey = click.clickedAt.toISOString().slice(0, 10);
      dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + 1);
      deviceMap.set(
        click.deviceType,
        (deviceMap.get(click.deviceType) ?? 0) + 1,
      );
      const browser = click.browser ?? 'Desconocido';
      browserMap.set(browser, (browserMap.get(browser) ?? 0) + 1);
      const os = click.os ?? 'Desconocido';
      osMap.set(os, (osMap.get(os) ?? 0) + 1);
    }

    const toSorted = (map: Map<string, number>) =>
      [...map.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

    return {
      totalClicks: link.clickCount,
      clicksByDay: [...dayMap.entries()].map(([date, count]) => ({
        date,
        count,
      })),
      devices: toSorted(deviceMap),
      browsers: toSorted(browserMap).map(({ type, count }) => ({
        name: type,
        count,
      })),
      operatingSystems: toSorted(osMap).map(({ type, count }) => ({
        name: type,
        count,
      })),
    };
  }

  async resolveRedirect(slug: string, userAgent?: string): Promise<string> {
    const link = await this.prisma.shortLink.findUnique({ where: { slug } });
    if (!link) {
      throw new NotFoundException('Enlace no encontrado');
    }

    let target = link.targetUrl;
    if (link.type === LinkType.FILE && link.s3Key) {
      target = await this.s3.getReadableUrl(link.s3Key);
    } else {
      const cached = await this.redis.client.get(`link:${slug}`);
      if (cached) {
        await this.recordClick(link.id, userAgent);
        return cached;
      }
      await this.cacheSlug(slug, target);
    }

    await this.recordClick(link.id, userAgent);
    return target;
  }

  private async recordClick(linkId: string, userAgent?: string) {
    const parsed = new UAParserPkg.UAParser(userAgent ?? '').getResult();
    const deviceType = parsed.device.type ?? 'desktop';
    const normalizedDevice =
      deviceType === 'mobile' ||
      deviceType === 'tablet' ||
      deviceType === 'wearable'
        ? deviceType
        : parsed.browser.name?.toLowerCase().includes('bot')
          ? 'bot'
          : 'desktop';

    await this.prisma.$transaction([
      this.prisma.shortLink.updateMany({
        where: { id: linkId },
        data: { clickCount: { increment: 1 } },
      }),
      this.prisma.linkClick.create({
        data: {
          linkId,
          userAgent: userAgent?.slice(0, 512) ?? null,
          deviceType: normalizedDevice,
          os: parsed.os.name
            ? `${parsed.os.name}${parsed.os.version ? ` ${parsed.os.version}` : ''}`.trim()
            : null,
          browser: parsed.browser.name
            ? `${parsed.browser.name}${parsed.browser.version ? ` ${parsed.browser.version}` : ''}`.trim()
            : null,
        },
      }),
    ]);
  }

  private async initialQrStyle(userId: string): Promise<QrStyleDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { qrDefaultStyle: true },
    });
    return cloneQrStyleForCreate(user?.qrDefaultStyle);
  }

  private mergeQrStyle(
    current: QrStyleDto,
    input: UpdateQrStyleDto,
  ): QrStyleDto {
    const { foregroundGradient, clearCustomLogo: _, ...rest } = input;
    const merged: QrStyleDto = { ...current, ...rest };
    if (foregroundGradient === null) {
      delete merged.foregroundGradient;
      merged.foregroundColor =
        input.foregroundColor ?? current.foregroundColor ?? '#000000';
    } else if (foregroundGradient !== undefined) {
      merged.foregroundGradient = foregroundGradient;
      delete merged.foregroundColor;
    }
    if (input.logoPreset !== undefined) {
      merged.logoPreset = input.logoPreset;
    }
    return merged;
  }

  private async cacheSlug(slug: string, targetUrl: string) {
    await this.redis.client.set(`link:${slug}`, targetUrl, 'EX', 60 * 60 * 24);
  }

  private async refreshCache(slug: string, targetUrl: string) {
    await this.redis.client.del(`link:${slug}`);
    await this.cacheSlug(slug, targetUrl);
  }

  private async findOwnedLink(user: User, id: string) {
    const link = await this.prisma.shortLink.findUnique({ where: { id } });
    if (!link) {
      throw new NotFoundException('Enlace no encontrado');
    }
    if (user.role !== UserRole.admin && link.createdById !== user.id) {
      throw new NotFoundException('Enlace no encontrado');
    }
    return link;
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!tags?.length) return [];

    const normalized = tags
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

    const unique = [...new Set(normalized)];
    if (unique.length > 10) {
      throw new BadRequestException('Máximo 10 tags por enlace');
    }

    for (const tag of unique) {
      if (tag.length > 32) {
        throw new BadRequestException('Cada tag admite hasta 32 caracteres');
      }
      if (!/^[a-z0-9_-]+$/.test(tag)) {
        throw new BadRequestException(
          'Tags inválidos (solo minúsculas, números, _ y -)',
        );
      }
    }

    return unique;
  }

  private parseWhatsappFromUrl(targetUrl: string): {
    phone: string;
    text?: string;
  } {
    try {
      const parsed = new URL(targetUrl);
      const phone = parsed.searchParams.get('phone') ?? '';
      const text = parsed.searchParams.get('text') ?? undefined;
      return { phone, text };
    } catch {
      throw new BadRequestException('Enlace de WhatsApp inválido');
    }
  }

  private buildWhatsappUrl(phone: string, text?: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new BadRequestException(
        'Número inválido (8-15 dígitos con código de país)',
      );
    }

    const params = new URLSearchParams({ phone: digits });
    const message = text?.trim();
    if (message) {
      params.set('text', message);
    }

    return `https://api.whatsapp.com/send?${params.toString()}`;
  }

  private async resolveSlug(customSlug?: string): Promise<string> {
    const slug = customSlug?.trim() || generateSlug();
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(slug)) {
      throw new BadRequestException(
        'Slug inválido (3-32 caracteres alfanuméricos, _ o -)',
      );
    }

    const exists = await this.prisma.shortLink.findUnique({ where: { slug } });
    if (exists) {
      throw new BadRequestException('El slug ya está en uso');
    }
    return slug;
  }

  private async toDto(
    link: {
      id: string;
      slug: string;
      targetUrl: string;
      type: LinkType;
      s3Key: string | null;
      fileName: string | null;
      mimeType: string | null;
      qrStyle: unknown;
      qrLogoKey: string | null;
      clickCount: number;
      createdAt: Date;
      tags: string[];
      createdById?: string;
    },
    includeQr = true,
    userDefaultStyle?: unknown,
  ) {
    let defaultStyle = userDefaultStyle;
    if (defaultStyle === undefined && link.createdById) {
      const creator = await this.prisma.user.findUnique({
        where: { id: link.createdById },
        select: { qrDefaultStyle: true },
      });
      defaultStyle = creator?.qrDefaultStyle;
    }

    const effectiveStyle = resolveEffectiveQrStyle(defaultStyle, link.qrStyle);
    const shortUrl = this.qr.buildShortUrl(link.slug);
    const qrBase64 = includeQr
      ? await this.qr.generateForUrl(
          shortUrl,
          effectiveStyle,
          link.qrLogoKey,
        )
      : undefined;

    return {
      id: link.id,
      slug: link.slug,
      targetUrl: link.targetUrl,
      shortUrl,
      type: link.type,
      fileName: link.fileName,
      mimeType: link.mimeType,
      s3Key: link.s3Key,
      clickCount: link.clickCount,
      createdAt: link.createdAt.toISOString(),
      tags: link.tags,
      qrStyle: effectiveStyle,
      qrLogoKey: link.qrLogoKey,
      qrBase64,
    };
  }
}
