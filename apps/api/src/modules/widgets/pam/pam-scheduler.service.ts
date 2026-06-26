import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PamWidgetsService } from './pam-widgets.service';

@Injectable()
export class PamSchedulerService {
  private readonly logger = new Logger(PamSchedulerService.name);

  constructor(private readonly pam: PamWidgetsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyPamEmails() {
    this.logger.log('Procesando correos PAM pendientes');
    await this.pam.processPendingEmails();
  }
}
