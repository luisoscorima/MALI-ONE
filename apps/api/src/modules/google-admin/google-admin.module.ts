import { Module } from '@nestjs/common';
import { GoogleAdminController } from './google-admin.controller';
import { GoogleAdminService } from './google-admin.service';

@Module({
  controllers: [GoogleAdminController],
  providers: [GoogleAdminService],
  exports: [GoogleAdminService],
})
export class GoogleAdminModule {}
