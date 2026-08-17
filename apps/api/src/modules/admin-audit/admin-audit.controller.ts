import { Controller, Get, Query } from '@nestjs/common';
import { SuperAdminOnly } from '../../core/guards/super-admin.decorator';
import { AdminAuditService } from './admin-audit.service';

@Controller('admin/audit-logs')
@SuperAdminOnly()
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 50;
    return this.audit.list(parsedLimit, cursor || undefined);
  }
}
