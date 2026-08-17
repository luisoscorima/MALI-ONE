import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SftpgoFilesService } from './sftpgo-files.service';

@Injectable()
export class SftpgoFilesSchedulerService {
  private readonly logger = new Logger(SftpgoFilesSchedulerService.name);

  constructor(private readonly files: SftpgoFilesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeTrash() {
    try {
      const purged = await this.files.purgeExpiredTrash();
      if (purged > 0) {
        this.logger.log(`Papelera: ${purged} entradas purgadas`);
      }
    } catch (err) {
      this.logger.error(
        `Error purgando papelera: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
