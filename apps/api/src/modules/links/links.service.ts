import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LinkType, User, UserRole } from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../../core/prisma/prisma.service';
import { QrService } from '../../core/qr/qr.service';
import { RedisService } from '../../core/redis/redis.service';
import { S3Service } from '../../core/s3/s3.service';

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
    const link = await this.prisma.shortLink.create({
      data: {
        slug,
        targetUrl: parsed.toString(),
        type: LinkType.URL,
        createdById: user.id,
      },
    });

    await this.cacheSlug(slug, link.targetUrl);
    return this.toDto(link);
  }

  async uploadFile(
    user: User,
    file: Express.Multer.File,
    customSlug?: string,
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

    const link = await this.prisma.shortLink.create({
      data: {
        slug,
        targetUrl,
        type: LinkType.FILE,
        s3Key: key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        createdById: user.id,
      },
    });

    await this.cacheSlug(slug, targetUrl);

    return this.toDto(link);
  }

  async listLinks(user: User) {
    const where = user.role === UserRole.admin ? {} : { createdById: user.id };
    const links = await this.prisma.shortLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return Promise.all(links.map((l) => this.toDto(l, false)));
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

    await this.redis.client.del(`link:${link.slug}`);
    await this.prisma.shortLink.delete({ where: { id } });
    return { ok: true };
  }

  async getQrPng(id: string, user: User): Promise<Buffer> {
    const link = await this.prisma.shortLink.findUnique({ where: { id } });
    if (!link) {
      throw new NotFoundException('Enlace no encontrado');
    }
    if (user.role !== UserRole.admin && link.createdById !== user.id) {
      throw new NotFoundException('Enlace no encontrado');
    }

    const shortUrl = this.qr.buildShortUrl(link.slug);
    return this.qr.generatePngBuffer(shortUrl);
  }

  async resolveRedirect(slug: string): Promise<string> {
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
        await this.incrementClicks(slug);
        return cached;
      }
      await this.cacheSlug(slug, target);
    }

    await this.incrementClicks(slug);
    return target;
  }

  private async incrementClicks(slug: string) {
    await this.prisma.shortLink.updateMany({
      where: { slug },
      data: { clickCount: { increment: 1 } },
    });
  }

  private async cacheSlug(slug: string, targetUrl: string) {
    await this.redis.client.set(`link:${slug}`, targetUrl, 'EX', 60 * 60 * 24);
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
      clickCount: number;
      createdAt: Date;
    },
    includeQr = true,
  ) {
    const shortUrl = this.qr.buildShortUrl(link.slug);
    const qrBase64 = includeQr
      ? await this.qr.generateForUrl(shortUrl)
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
      qrBase64,
    };
  }
}
