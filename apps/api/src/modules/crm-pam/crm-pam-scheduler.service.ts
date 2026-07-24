import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrmPamService } from './crm-pam.service';

@Injectable()
export class CrmPamSchedulerService {
  private readonly logger = new Logger(CrmPamSchedulerService.name);

  constructor(private readonly crmPam: CrmPamService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCampaigns() {
    try {
      await this.crmPam.processDueScheduledCampaigns();
    } catch (err) {
      this.logger.error(
        `Error procesando campañas programadas: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
