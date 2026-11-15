import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { MalichimpContactStatus, Prisma, type MalichimpImportJob } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaService } from '../../core/prisma/prisma.service';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import {
  applyMalichimpFiles,
  inspectMalichimpFiles,
  locateMalichimpFiles,
  type MalichimpImportReport,
  type MalichimpLocatedFile,
} from './lib/malichimp-import-runner';
import { extractMailchimpZip } from './lib/mailchimp-zip';
import { MalichimpContactsQueryDto } from './dto/malichimp-query.dto';

type ImportPreview = {
  id: string;
  userId: string;
  originalName: string;
  directory: string;
  files: MalichimpLocatedFile[];
  report: MalichimpImportReport;
  expiresAt: Date;
};

const PREVIEW_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class MalichimpService implements OnModuleInit {
  private readonly logger = new Logger(MalichimpService.name);
  private readonly previews = new Map<string, ImportPreview>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: EmailDeliveryService,
  ) {}

  async onModuleInit() {
    void this.cleanupOrphanDirectories();
    await this.prisma.malichimpImportJob.updateMany({
      where: { status: { in: ['queued', 'running'] } },
      data: {
        status: 'failed',
        error: 'La API se reinició durante la importación. Verifica la audiencia antes de volver a importar el ZIP.',
        completedAt: new Date(),
        processed: 0,
      },
    });
  }

  async stats() {
    const [statuses, suppressions, tags, lastImport, eligible] = await Promise.all([
      this.prisma.malichimpContact.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.malichimpSuppression.count(),
      this.prisma.malichimpTag.count(),
      this.prisma.malichimpImportRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          sourceKey: true,
          fileFingerprint: true,
          counts: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      this.prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) AS count FROM "MalichimpContact" contact
        WHERE contact."status" = 'subscribed'::"MalichimpContactStatus"
          AND NOT EXISTS (
            SELECT 1 FROM "MalichimpSuppression" suppression
            WHERE suppression."email" = contact."email"
          )
      `),
    ]);

    const byStatus = Object.fromEntries(
      Object.values(MalichimpContactStatus).map((status) => [status, 0]),
    ) as Record<MalichimpContactStatus, number>;
    for (const row of statuses) byStatus[row.status] = row._count._all;

    return {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      eligible: Number(eligible[0].count),
      byStatus,
      suppressions,
      tags,
      delivery: this.emailDelivery.status,
      lastImport,
    };
  }

  async listContacts(query: MalichimpContactsQueryDto) {
    const q = query.q?.trim();
    const tag = query.tag?.trim();
    const where: Prisma.MalichimpContactWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(tag ? { tags: { some: { tag: { normalizedName: tag } } } } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { institutionName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.malichimpContact.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { email: 'asc' }],
        skip,
        take: query.pageSize,
        include: {
          tags: {
            select: { tag: { select: { id: true, name: true, normalizedName: true } } },
            orderBy: { tag: { name: 'asc' } },
          },
        },
      }),
      this.prisma.malichimpContact.count({ where }),
    ]);

    return {
      items: items.map(({ tags, ...contact }) => ({
        ...contact,
        tags: tags.map((entry) => entry.tag),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async listTags() {
    const tags = await this.prisma.malichimpTag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { contacts: true } } },
    });
    return tags.map(({ _count, ...tag }) => ({ ...tag, contacts: _count.contacts }));
  }

  async previewZip(userId: string, file: Express.Multer.File) {
    await this.cleanupExpiredPreviews();
    if (!file?.buffer?.length) throw new BadRequestException('Selecciona un ZIP');
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Solo se admite el ZIP completo de Mailchimp');
    }

    const directory = await mkdtemp(path.join(tmpdir(), 'mali-one-malichimp-'));
    try {
      await extractMailchimpZip(file.buffer, directory);
      const files = await locateMalichimpFiles(directory);
      const report = await inspectMalichimpFiles(files);
      if (report.errors.length) {
        throw new BadRequestException({
          message: `El ZIP contiene ${report.errors.length} error(es)`,
          errors: report.errors.slice(0, 25),
        });
      }
      const previous = await this.prisma.malichimpImportRun.findFirst({
        where: { fileFingerprint: report.fingerprint, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { id: true, completedAt: true },
      });
      const preview: ImportPreview = {
        id: randomUUID(),
        userId,
        originalName: file.originalname.slice(0, 240),
        directory,
        files,
        report,
        expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
      };
      this.previews.set(preview.id, preview);
      return {
        previewId: preview.id,
        fileName: preview.originalName,
        report,
        expiresAt: preview.expiresAt,
        previouslyImported: previous,
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo procesar el ZIP',
      );
    }
  }

  async startZipImport(userId: string, previewId: string) {
    await this.cleanupExpiredPreviews();
    const preview = this.previews.get(previewId);
    if (!preview || preview.userId !== userId) {
      throw new NotFoundException('La vista previa expiró; vuelve a subir el ZIP');
    }
    const busy = await this.prisma.malichimpImportJob.count({
      where: { status: { in: ['queued', 'running'] } },
    });
    if (busy) throw new ConflictException('Ya hay una importación en curso');

    let job: MalichimpImportJob;
    try {
      job = await this.prisma.malichimpImportJob.create({
        data: {
          userId,
          status: 'queued',
          originalName: preview.originalName,
          total: preview.report.totalUnique,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya hay una importación en curso');
      }
      throw error;
    }
    this.previews.delete(previewId);
    void this.runImport(job, preview).catch((error: unknown) => {
      this.logger.error('No se pudo finalizar el trabajo de importación', error);
    });
    return this.serializeJob(job);
  }

  async getImportJob(userId: string, jobId: string) {
    const job = await this.prisma.malichimpImportJob.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) throw new NotFoundException('Importación no encontrada');
    return this.serializeJob(job);
  }

  private async runImport(job: MalichimpImportJob, preview: ImportPreview) {
    try {
      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: { status: 'running' },
      });
      const result = await applyMalichimpFiles(
        this.prisma,
        preview.files,
        preview.report,
        {
          sourceKey: preview.originalName,
          sourceDirectory: 'temporary_ui_upload',
          onProgress: async (processed) => {
            await this.prisma.malichimpImportJob.update({
              where: { id: job.id },
              data: { processed },
            });
          },
        },
      );
      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: {
          processed: result.imported,
          runId: result.runId,
          status: 'completed',
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.malichimpImportJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          processed: 0,
          error: error instanceof Error ? error.message.slice(0, 1000) : String(error),
          completedAt: new Date(),
        },
      });
    } finally {
      await rm(preview.directory, { recursive: true, force: true });
    }
  }

  private serializeJob(job: MalichimpImportJob) {
    return {
      ...job,
      progress: job.total ? Math.round((job.processed / job.total) * 100) : 0,
    };
  }

  private async cleanupExpiredPreviews() {
    const now = Date.now();
    const expired = [...this.previews.values()].filter(
      (preview) => preview.expiresAt.getTime() <= now,
    );
    await Promise.all(
      expired.map(async (preview) => {
        this.previews.delete(preview.id);
        await rm(preview.directory, { recursive: true, force: true });
      }),
    );
  }

  private async cleanupOrphanDirectories() {
    try {
      const entries = await readdir(tmpdir(), { withFileTypes: true });
      const cutoff = Date.now() - 60 * 60 * 1000;
      await Promise.all(
        entries
          .filter(
            (entry) =>
              entry.isDirectory() && entry.name.startsWith('mali-one-malichimp-'),
          )
          .map(async (entry) => {
            const directory = path.join(tmpdir(), entry.name);
            const details = await stat(directory);
            if (details.mtimeMs < cutoff) {
              await rm(directory, { recursive: true, force: true });
            }
          }),
      );
    } catch {
      // Temporary cleanup must not prevent the API from starting.
    }
  }
}
