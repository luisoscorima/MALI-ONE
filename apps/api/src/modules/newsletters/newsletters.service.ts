import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailCampaignStatus,
  NewsletterBrand,
  NewsletterKind,
  NewsletterScope,
  NewsletterStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateNewsletterDto,
  UpdateNewsletterDto,
} from './dto/newsletter.dto';
import {
  WorkingCopyScope,
  buildModuleLibraryCreateData,
  buildWorkingCopyCreateData,
  contentRevisionOf,
  duplicateLabel,
  duplicateNewsletterSlug as makeLibraryCopySlug,
  libraryListWhere,
  moduleLibraryListWhere,
  publishedLibraryWhere,
  workingCopyListWhere,
} from './newsletter-working-copy';

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

  /**
   * Hub Campañas y Boletines: library metadata only (no htmlBody/designJson).
   * Editor loads full content via get(id).
   */
  async list(options?: { page?: number; pageSize?: number }) {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 50));
    const where = { kind: NewsletterKind.library } as const;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.newsletter.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          subject: true,
          brand: true,
          status: true,
          scope: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { campaigns: true } },
          createdBy: { select: { email: true, name: true } },
        },
      }),
      this.prisma.newsletter.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        subject: row.subject,
        brand: row.brand,
        status: row.status,
        scope: row.scope,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        campaignsCount: row._count.campaigns,
        createdBy: row.createdBy,
        publicUrl:
          row.scope === NewsletterScope.shared &&
          row.status === NewsletterStatus.published
            ? `${this.appUrl}/n/${row.slug}`
            : null,
        editable: row.scope === NewsletterScope.shared,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Cross-module campaign registry (read-only hub). */
  listCampaignRegistry(limit = 200) {
    return this.prisma.emailCampaign.findMany({
      take: Math.min(Math.max(limit, 1), 500),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        audienceArea: true,
        fromEmail: true,
        fromName: true,
        subjectSnapshot: true,
        totalRecipients: true,
        sentCount: true,
        openCount: true,
        clickCount: true,
        errorCount: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        newsletter: { select: { id: true, title: true, scope: true, slug: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
  }

  /** Published shared library bases for campaign wizards (read-only). */
  listPublished() {
    return this.prisma.newsletter.findMany({
      where: publishedLibraryWhere(),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subject: true,
        htmlBody: true,
        designJson: true,
        brand: true,
        status: true,
        contentRevision: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Module library pieces (e.g. MALICHIMP Contenido).
   * Still includes bodies so contentRevisionOf() and campaign pickers stay correct;
   * hub list() above is the slim metadata endpoint.
   */
  listModuleLibrary(scope: WorkingCopyScope) {
    return this.prisma.newsletter.findMany({
      where: moduleLibraryListWhere(scope),
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { campaigns: true } },
        createdBy: { select: { email: true, name: true } },
      },
    });
  }

  /** Campaign content picker: only the module's own library. */
  listCampaignContentBases(scope: WorkingCopyScope) {
    return this.prisma.newsletter.findMany({
      where: moduleLibraryListWhere(scope),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        subject: true,
        htmlBody: true,
        designJson: true,
        brand: true,
        status: true,
        scope: true,
        contentRevision: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  listWorkingCopies(scope: WorkingCopyScope) {
    return this.prisma.newsletter.findMany({
      where: workingCopyListWhere(scope),
      orderBy: { updatedAt: 'desc' },
      include: {
        workingForCampaign: {
          select: {
            id: true,
            name: true,
            status: true,
            updatedAt: true,
          },
        },
        createdBy: { select: { email: true, name: true } },
      },
    });
  }

  async getModuleLibrary(id: string, scope: WorkingCopyScope) {
    const row = await this.prisma.newsletter.findFirst({
      where: { id, ...moduleLibraryListWhere(scope) },
      include: {
        _count: { select: { campaigns: true } },
        createdBy: { select: { email: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Contenido no encontrado');
    return {
      ...row,
      contentRevisionToken: contentRevisionOf(row),
      editable: true,
    };
  }

  async createModuleLibrary(
    userId: string,
    scope: WorkingCopyScope,
    dto: {
      title: string;
      subject: string;
      htmlBody: string;
      designJson?: string | null;
      brand?: NewsletterBrand | null;
    },
  ) {
    return this.prisma.newsletter.create({
      data: buildModuleLibraryCreateData({
        userId,
        scope,
        title: dto.title.trim(),
        subject: dto.subject.trim(),
        htmlBody: dto.htmlBody,
        designJson: dto.designJson,
        brand: dto.brand,
        slugBase: dto.title.trim(),
      }),
    });
  }

  async updateModuleLibrary(
    id: string,
    scope: WorkingCopyScope,
    dto: UpdateNewsletterDto & { contentRevision?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.newsletter.findFirst({
        where: { id, ...moduleLibraryListWhere(scope) },
      });
      if (!current) throw new NotFoundException('Contenido no encontrado');
      this.assertContentRevision(current, dto.contentRevision, {
        required: true,
      });
      const bumped = await tx.newsletter.updateMany({
        where: {
          id,
          contentRevision: current.contentRevision,
        },
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
          contentRevision: { increment: 1 },
        },
      });
      if (!bumped.count) {
        throw new ConflictException(
          'El contenido cambió después de tu revisión. Revísalo nuevamente antes de guardar.',
        );
      }
      return tx.newsletter.findUniqueOrThrow({ where: { id } });
    });
  }

  async removeModuleLibrary(id: string, scope: WorkingCopyScope) {
    const row = await this.prisma.newsletter.findFirst({
      where: { id, ...moduleLibraryListWhere(scope) },
      include: { _count: { select: { campaigns: true } } },
    });
    if (!row) throw new NotFoundException('Contenido no encontrado');
    if (row._count.campaigns) {
      throw new BadRequestException(
        'Este contenido ya fue usado en una campaña y debe conservarse como historial',
      );
    }
    await this.prisma.newsletter.delete({ where: { id } });
    return { ok: true as const };
  }

  async duplicateModuleLibrary(
    userId: string,
    id: string,
    scope: WorkingCopyScope,
  ) {
    const source = await this.getModuleLibrary(id, scope);
    return this.prisma.newsletter.create({
      data: buildModuleLibraryCreateData({
        userId,
        scope,
        title: duplicateLabel(source.title, 200),
        subject: source.subject.slice(0, 200),
        htmlBody: source.htmlBody,
        designJson: source.designJson,
        brand: source.brand,
        slugBase: source.slug,
      }),
    });
  }

  async get(id: string) {
    const row = await this.prisma.newsletter.findFirst({
      where: { id, kind: NewsletterKind.library },
      include: {
        createdBy: { select: { email: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Boletín no encontrado');
    return {
      ...row,
      publicUrl:
        row.scope === NewsletterScope.shared &&
        row.status === NewsletterStatus.published
          ? `${this.appUrl}/n/${row.slug}`
          : null,
      editable: row.scope === NewsletterScope.shared,
    };
  }

  async getPublishedBySlug(slug: string) {
    const row = await this.prisma.newsletter.findFirst({
      where: {
        slug,
        ...publishedLibraryWhere(),
      },
    });
    if (!row) throw new NotFoundException('Boletín no publicado');
    return row;
  }

  async getWorkingCopy(id: string, scope: WorkingCopyScope) {
    const row = await this.prisma.newsletter.findFirst({
      where: { id, ...workingCopyListWhere(scope) },
      include: {
        workingForCampaign: {
          select: {
            id: true,
            name: true,
            status: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Contenido no encontrado');
    return {
      ...row,
      contentRevisionToken: contentRevisionOf(row),
      editable: row.workingForCampaign?.status === EmailCampaignStatus.draft,
    };
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
          scope: NewsletterScope.shared,
          kind: NewsletterKind.library,
          contentRevision: 1,
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
    const current = await this.get(id);
    if (current.scope !== NewsletterScope.shared) {
      throw new BadRequestException(
        'Los boletines de módulo se editan en su módulo (MALICHIMP o Usuarios Workspace)',
      );
    }
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
        contentRevision: { increment: 1 },
      },
    });
  }

  async updateWorkingCopy(
    id: string,
    scope: WorkingCopyScope,
    dto: UpdateNewsletterDto & { contentRevision?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.newsletter.findFirst({
        where: { id, ...workingCopyListWhere(scope) },
        include: {
          workingForCampaign: { select: { status: true } },
        },
      });
      if (!current) throw new NotFoundException('Contenido no encontrado');
      if (current.workingForCampaign?.status !== EmailCampaignStatus.draft) {
        throw new ConflictException(
          'Solo se puede editar el contenido mientras la campaña esté en preparación',
        );
      }
      this.assertContentRevision(current, dto.contentRevision, {
        required: true,
      });
      const bumped = await tx.newsletter.updateMany({
        where: {
          id,
          contentRevision: current.contentRevision,
        },
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
          contentRevision: { increment: 1 },
        },
      });
      if (!bumped.count) {
        throw new ConflictException(
          'El contenido cambió después de tu revisión. Revísalo nuevamente antes de guardar.',
        );
      }
      return tx.newsletter.findUniqueOrThrow({ where: { id } });
    });
  }

  async createWorkingCopy(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      scope: WorkingCopyScope;
      sourceNewsletterId: string | null;
      title: string;
      subject: string;
      htmlBody: string;
      designJson?: string | null;
      brand?: NewsletterBrand | null;
      slugBase: string;
    },
  ) {
    return tx.newsletter.create({
      data: buildWorkingCopyCreateData(input),
    });
  }

  /**
   * Snapshot payload from the exclusive working copy (never from library base).
   */
  async snapshotFromWorkingCopy(workingNewsletterId: string) {
    const row = await this.prisma.newsletter.findUnique({
      where: { id: workingNewsletterId },
    });
    if (!row || row.kind !== NewsletterKind.campaign_working_copy) {
      throw new BadRequestException(
        'La campaña no tiene un contenido de trabajo válido',
      );
    }
    return {
      subjectSnapshot: row.subject.slice(0, 300),
      htmlSnapshot: row.htmlBody,
      designJsonSnapshot: row.designJson,
      brandSnapshot: row.brand,
      contentRevision: row.contentRevision,
      contentRevisionToken: contentRevisionOf(row),
      updatedAt: row.updatedAt,
    };
  }

  assertContentRevision(
    row: {
      contentRevision: number;
      updatedAt: Date;
      htmlBody: string;
      designJson: string | null;
    },
    expected: string | undefined,
    options?: { required?: boolean },
  ) {
    if (!expected) {
      if (options?.required) {
        throw new ConflictException(
          'El contenido cambió después de tu revisión. Revísalo nuevamente antes de enviar.',
        );
      }
      return;
    }
    const current = contentRevisionOf(row);
    if (current !== expected) {
      throw new ConflictException(
        'El contenido cambió después de tu revisión. Revísalo nuevamente antes de enviar.',
      );
    }
  }

  /**
   * Atomically verify the review token and bump contentRevision.
   * If another writer changed the row, updateMany matches 0 → 409.
   */
  async claimWorkingCopyRevision(
    tx: Prisma.TransactionClient,
    workingId: string,
    expectedToken: string | undefined,
    options?: { required?: boolean; subject?: string },
  ) {
    const working = await tx.newsletter.findUnique({ where: { id: workingId } });
    if (!working || working.kind !== NewsletterKind.campaign_working_copy) {
      throw new BadRequestException(
        'La campaña no tiene un contenido de trabajo válido',
      );
    }
    this.assertContentRevision(working, expectedToken, {
      required: options?.required,
    });
    const bumped = await tx.newsletter.updateMany({
      where: {
        id: workingId,
        contentRevision: working.contentRevision,
      },
      data: {
        ...(options?.subject !== undefined
          ? { subject: options.subject.slice(0, working.scope === NewsletterScope.malichimp ? 300 : 200) }
          : {}),
        contentRevision: { increment: 1 },
      },
    });
    if (!bumped.count) {
      throw new ConflictException(
        'El contenido cambió después de tu revisión. Revísalo nuevamente antes de enviar.',
      );
    }
    return tx.newsletter.findUniqueOrThrow({ where: { id: workingId } });
  }

  async duplicate(userId: string, id: string) {
    const source = await this.prisma.newsletter.findFirst({
      where: { id, ...libraryListWhere() },
    });
    if (!source) throw new NotFoundException('Boletín no encontrado');

    return this.prisma.newsletter.create({
      data: {
        slug: makeLibraryCopySlug(source.slug, 'copia'),
        title: duplicateLabel(source.title, 200),
        subject: source.subject.slice(0, 200),
        htmlBody: source.htmlBody,
        designJson: source.designJson,
        brand: source.brand,
        status: NewsletterStatus.draft,
        scope: NewsletterScope.shared,
        kind: NewsletterKind.library,
        contentRevision: 1,
        createdById: userId,
      },
    });
  }

  async remove(id: string) {
    const newsletter = await this.prisma.newsletter.findFirst({
      where: { id, ...libraryListWhere() },
      include: { _count: { select: { campaigns: true } } },
    });
    if (!newsletter) throw new NotFoundException('Boletín no encontrado');
    if (newsletter.scope !== NewsletterScope.shared) {
      throw new BadRequestException(
        'Los boletines de módulo se eliminan en su módulo',
      );
    }
    if (newsletter._count.campaigns) {
      throw new BadRequestException(
        'Este boletín ya fue usado en una campaña y debe conservarse como historial',
      );
    }
    await this.prisma.newsletter.delete({ where: { id } });
    return { ok: true };
  }
}
