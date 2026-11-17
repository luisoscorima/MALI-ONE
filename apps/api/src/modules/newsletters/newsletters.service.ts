import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NewsletterStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateNewsletterDto,
  UpdateNewsletterDto,
} from './dto/newsletter.dto';

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
