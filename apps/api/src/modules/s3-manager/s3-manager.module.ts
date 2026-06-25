import { Module } from '@nestjs/common';
import { S3ManagerController } from './s3-manager.controller';
import { S3ManagerService } from './s3-manager.service';

@Module({
  controllers: [S3ManagerController],
  providers: [S3ManagerService],
})
export class S3ManagerModule {}
