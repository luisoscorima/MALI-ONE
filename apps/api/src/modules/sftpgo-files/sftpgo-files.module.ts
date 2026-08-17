import { Module } from '@nestjs/common';
import { SftpgoFilesController } from './sftpgo-files.controller';
import { SftpgoFilesSchedulerService } from './sftpgo-files-scheduler.service';
import { SftpgoFilesService } from './sftpgo-files.service';

@Module({
  controllers: [SftpgoFilesController],
  providers: [SftpgoFilesService, SftpgoFilesSchedulerService],
  exports: [SftpgoFilesService],
})
export class SftpgoFilesModule {}
