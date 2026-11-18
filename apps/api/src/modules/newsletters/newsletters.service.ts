import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NewsletterBrand,
  NewsletterStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateNewsletterDto,
  UpdateNewsletterDto,
} from './dto/newsletter.dto';

function duplicateLabel(value: string, maxLength: number): string {
  const suffix = ' — copia';
  return `${value.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
}

function duplicateNewsletterSlug(value: string): string {
  const suffix = `copia-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const base = value
    .slice(0, 80 - suffix.length - 1)
    .replace(/-+$/g, '');
  return `${base}-${suffix}`;
}

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

  /** Published content available to any authorized campaign module. */
  listPublished() {
    return this.prisma.newsletter.findMany({
      where: { status: NewsletterStatus.published },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subject: true,
        htmlBody: true,
        status: true,
        createdAt: true,
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
          brand:
            dto.brand === undefined
              ? undefined
              : dto.brand === null
                ? null
                : (dto.brand as NewsletterBrand),
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
        ...(dto.brand !== undefined
          ? {
              brand:
                dto.brand === null ? null : (dto.brand as NewsletterBrand),
            }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status as NewsletterStatus }
          : {}),
      },
    });
  }

  async duplicate(userId: string, id: string) {
    const source = await this.prisma.newsletter.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Boletín no encontrado');

    return this.prisma.newsletter.create({
      data: {
        slug: duplicateNewsletterSlug(source.slug),
        title: duplicateLabel(source.title, 200),
        subject: source.subject.slice(0, 200),
        htmlBody: source.htmlBody,
        designJson: source.designJson,
        brand: source.brand,
        status: NewsletterStatus.draft,
        createdById: userId,
      },
    });
  }

  async remove(id: string) {
    const newsletter = await this.prisma.newsletter.findUnique({
      where: { id },
      include: { _count: { select: { campaigns: true } } },
    });
    if (!newsletter) throw new NotFoundException('Boletín no encontrado');
    if (newsletter._count.campaigns) {
      throw new BadRequestException(
        'Este boletín ya fue usado en una campaña y debe conservarse como historial',
      );
    }
    await this.prisma.newsletter.delete({ where: { id } });
    return { ok: true };
  }
}
