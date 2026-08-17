import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(limit = 50, cursor?: string) {
    const logs = await this.prisma.adminAuditLog.findMany({
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
    });

    return {
      logs,
      nextCursor:
        logs.length === limit ? (logs[logs.length - 1]?.id ?? null) : null,
    };
  }
}
