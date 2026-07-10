import { Module } from '@nestjs/common';
import { S3Module } from '../../core/s3/s3.module';
import { S3ManagerModule } from '../s3-manager/s3-manager.module';
import { ScreenCastController } from './screen-cast.controller';
import { ScreenCastGateway } from './screen-cast.gateway';
import { ScreenCastService } from './screen-cast.service';

@Module({
  imports: [S3ManagerModule, S3Module],
  controllers: [ScreenCastController],
  providers: [ScreenCastService, ScreenCastGateway],
  exports: [ScreenCastService],
})
export class ScreenCastModule {}
