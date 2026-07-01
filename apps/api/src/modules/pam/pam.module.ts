import { Module } from '@nestjs/common';
import { WidgetsModule } from '../widgets/widgets.module';
import { PamAdminController } from './pam-admin.controller';

@Module({
  imports: [WidgetsModule],
  controllers: [PamAdminController],
})
export class PamModule {}
