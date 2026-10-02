import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LandingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateLandingDto,
  PreviewLandingDto,
  UpdateLandingDto,
} from './dto/landing.dto';
import {
  normalizeLandingDocument,
  renderLandingHtml,
} from './landing-renderer';

@Injectable()
export class LandingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get appUrl(): string {
    return String(this.config.get('APP_URL') ?? 'http://localhost:5173')
      .trim()
      .replace(/\/$/, '');
  }

  private get publicBaseUrl(): string {
    return String(
      this.config.get('LANDINGS_PUBLIC_BASE_URL') ??
        'https://educacion.mali.pe/landing',
    )
      .trim()
      .replace(/\/$/, '');
  }

  private get gtmId(): string {
    const candidate = String(this.config.get('LANDINGS_GTM_ID') ?? '')
      .trim()
      .toUpperCase();
    return /^GTM-[A-Z0-9]+$/.test(candidate) ? candidate : '';
  }

  private publicUrl(slug: string): string {
    return `${this.publicBaseUrl}/${slug}/`;
  }

  private prepareContent(value: unknown): Prisma.InputJsonValue {
    const serialized = JSON.stringify(value ?? {});
    if (serialized.length > 300_000) {
      throw new BadRequestException(
        'El contenido de la landing supera el tamaño permitido',
      );
    }
    const normalized = normalizeLandingDocument(value);
    if (normalized.blocks.length === 0) {
      throw new BadRequestException('La landing debe tener al menos un bloque');
    }
    const leadForms = normalized.blocks.filter(
      (block) => block.type === 'lead_form',
    ).length;
    if (leadForms > 1) {
      throw new BadRequestException(
        'Solo se permite un bloque de formulario por landing',
      );
    }
    return normalized as unknown as Prisma.InputJsonValue;
  }

  list() {
    return this.prisma.landingPage
      .findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          seoTitle: true,
          seoDescription: true,
          ogImageUrl: true,
          publishedVersion: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { name: true, email: true } },
          updatedBy: { select: { name: true, email: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          ...row,
          publicUrl:
            row.status === LandingStatus.published
              ? this.publicUrl(row.slug)
              : null,
        })),
      );
  }

  async get(id: string) {
    const row = await this.prisma.landingPage.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        updatedBy: { select: { name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Landing no encontrada');
    return {
      ...row,
      publicUrl:
        row.status === LandingStatus.published
          ? this.publicUrl(row.slug)
          : null,
    };
  }

  async create(userId: string, dto: CreateLandingDto) {
    try {
      return await this.prisma.landingPage.create({
        data: {
          slug: dto.slug.trim().toLowerCase(),
          name: dto.name.trim(),
          content: this.prepareContent(dto.content),
          seoTitle: this.blankToNull(dto.seoTitle),
          seoDescription: this.blankToNull(dto.seoDescription),
          ogImageUrl: this.blankToNull(dto.ogImageUrl),
          createdById: userId,
          updatedById: userId,
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new BadRequestException('El slug ya existe');
      }
      throw error;
    }
  }

  async update(id: string, userId: string, dto: UpdateLandingDto) {
    await this.get(id);
    return this.prisma.landingPage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.content !== undefined
          ? { content: this.prepareContent(dto.content) }
          : {}),
        ...(dto.seoTitle !== undefined
          ? { seoTitle: this.blankToNull(dto.seoTitle) }
          : {}),
        ...(dto.seoDescription !== undefined
          ? { seoDescription: this.blankToNull(dto.seoDescription) }
          : {}),
        ...(dto.ogImageUrl !== undefined
          ? { ogImageUrl: this.blankToNull(dto.ogImageUrl) }
          : {}),
        updatedById: userId,
      },
    });
  }

  async publish(id: string, userId: string) {
    const row = await this.get(id);
    const publishedVersion = row.publishedVersion + 1;
    const html = renderLandingHtml({
      slug: row.slug,
      name: row.name,
      content: row.content,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      ogImageUrl: row.ogImageUrl,
      canonicalUrl: this.publicUrl(row.slug),
      apiBase: this.appUrl,
      gtmId: this.gtmId,
    });
    return this.prisma.landingPage.update({
      where: { id },
      data: {
        status: LandingStatus.published,
        publishedHtml: html,
        publishedVersion,
        publishedAt: new Date(),
        updatedById: userId,
      },
    });
  }

  async unpublish(id: string, userId: string) {
    await this.get(id);
    return this.prisma.landingPage.update({
      where: { id },
      data: {
        status: LandingStatus.draft,
        publishedHtml: null,
        updatedById: userId,
      },
    });
  }

  async remove(id: string) {
    const row = await this.get(id);
    if (row.status === LandingStatus.published) {
      throw new BadRequestException(
        'Despublica la landing antes de eliminarla',
      );
    }
    await this.prisma.landingPage.delete({ where: { id } });
    return { ok: true };
  }

  preview(dto: PreviewLandingDto) {
    const content = this.prepareContent(dto.content);
    return {
      html: renderLandingHtml({
        slug: 'vista-previa',
        name: dto.name,
        content,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        ogImageUrl: dto.ogImageUrl,
        canonicalUrl: `${this.publicBaseUrl}/vista-previa/`,
        apiBase: this.appUrl,
        gtmId: this.gtmId,
      }),
    };
  }

  async getPublished(slug: string) {
    const row = await this.prisma.landingPage.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        status: LandingStatus.published,
        publishedHtml: { not: null },
      },
      select: {
        slug: true,
        name: true,
        publishedHtml: true,
        publishedVersion: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    if (!row?.publishedHtml) {
      throw new NotFoundException('Landing no publicada');
    }
    return {
      slug: row.slug,
      name: row.name,
      html: row.publishedHtml,
      version: row.publishedVersion,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  }

  private blankToNull(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
}
