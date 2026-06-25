import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { AppModule } from '@prisma/client';
import { RequireModule } from '../../core/guards/module.decorator';
import { S3ManagerService } from './s3-manager.service';

@Controller('s3-manager')
@RequireModule(AppModule.s3_manager)
export class S3ManagerController {
  constructor(private readonly s3Manager: S3ManagerService) {}

  @Get('buckets')
  listBuckets() {
    return this.s3Manager.listBuckets();
  }

  @Get('buckets/:bucket/objects')
  listObjects(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix?: string,
    @Query('continuationToken') continuationToken?: string,
  ) {
    return this.s3Manager.listObjects(bucket, prefix ?? '', continuationToken);
  }

  @Get('buckets/:bucket/download')
  download(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
  ) {
    return this.s3Manager.getDownloadUrl(bucket, key);
  }

  @Delete('buckets/:bucket/objects')
  deleteObject(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
  ) {
    return this.s3Manager.deleteObject(bucket, key);
  }
}
