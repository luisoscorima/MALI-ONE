import { Module } from '@nestjs/common';
import { SftpgoFilesController } from './sftpgo-files.controller';
import { SftpgoFilesService } from './sftpgo-files.service';

@Module({
  controllers: [SftpgoFilesController],
  providers: [SftpgoFilesService],
  exports: [SftpgoFilesService],
})
export class SftpgoFilesModule {}
