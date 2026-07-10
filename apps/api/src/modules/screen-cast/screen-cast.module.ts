import { Module } from '@nestjs/common';
import { S3ManagerModule } from '../s3-manager/s3-manager.module';
import { ScreenCastController } from './screen-cast.controller';
import { ScreenCastGateway } from './screen-cast.gateway';
import { ScreenCastService } from './screen-cast.service';

@Module({
  imports: [S3ManagerModule],
  controllers: [ScreenCastController],
  providers: [ScreenCastService, ScreenCastGateway],
  exports: [ScreenCastService],
})
export class ScreenCastModule {}
