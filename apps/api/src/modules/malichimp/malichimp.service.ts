import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { MalichimpContactStatus, Prisma } from '@prisma/client';
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
} from '../../../prisma/lib/malichimp-import-runner';
import { extractMailchimpZip } from '../../../prisma/lib/mailchimp-zip';
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

type ImportJob = {
  id: string;
  userId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  originalName: string;
  processed: number;
  total: number;
  runId: string | null;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

const PREVIEW_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class MalichimpService implements OnModuleInit {
  private readonly previews = new Map<string, ImportPreview>();
  private readonly jobs = new Map<string, ImportJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailDelivery: EmailDeliveryService,
  ) {}

  onModuleInit() {
    void this.cleanupOrphanDirectories();
  }

  async stats() {
    const [statuses, suppressions, tags, lastImport] = await Promise.all([
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
    ]);

    const byStatus = Object.fromEntries(
      Object.values(MalichimpContactStatus).map((status) => [status, 0]),
    ) as Record<MalichimpContactStatus, number>;
    for (const row of statuses) byStatus[row.status] = row._count._all;

    return {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      eligible: byStatus.subscribed,
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
    const busy = [...this.jobs.values()].some(
      (job) => job.status === 'queued' || job.status === 'running',
    );
    if (busy) throw new ConflictException('Ya hay una importación en curso');

    this.previews.delete(previewId);
    const job: ImportJob = {
      id: randomUUID(),
      userId,
      status: 'queued',
      originalName: preview.originalName,
      processed: 0,
      total: preview.report.totalUnique,
      runId: null,
      error: null,
      startedAt: new Date(),
      completedAt: null,
    };
    this.jobs.set(job.id, job);
    void this.runImport(job, preview);
    return this.serializeJob(job);
  }

  getImportJob(userId: string, jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) throw new NotFoundException('Importación no encontrada');
    return this.serializeJob(job);
  }

  private async runImport(job: ImportJob, preview: ImportPreview) {
    job.status = 'running';
    try {
      const result = await applyMalichimpFiles(
        this.prisma,
        preview.files,
        preview.report,
        {
          sourceKey: preview.originalName,
          sourceDirectory: 'temporary_ui_upload',
          onProgress: (processed) => {
            job.processed = processed;
          },
        },
      );
      job.processed = result.imported;
      job.runId = result.runId;
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message.slice(0, 1000) : String(error);
    } finally {
      job.completedAt = new Date();
      await rm(preview.directory, { recursive: true, force: true });
    }
  }

  private serializeJob(job: ImportJob) {
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
