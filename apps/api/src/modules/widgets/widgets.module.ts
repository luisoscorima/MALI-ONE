import { Module } from '@nestjs/common';
import { EducacionWidgetsController } from './educacion/educacion-widgets.controller';
import { EducacionWidgetsService } from './educacion/educacion-widgets.service';
import { BibliotecaWidgetsController } from './biblioteca/biblioteca-widgets.controller';
import { BibliotecaWidgetsService } from './biblioteca/biblioteca-widgets.service';
import { PamWidgetsController } from './pam/pam-widgets.controller';
import { PamWidgetsService } from './pam/pam-widgets.service';
import { PamEmailService } from './pam/pam-email.service';
import { PamSchedulerService } from './pam/pam-scheduler.service';

@Module({
  controllers: [
    EducacionWidgetsController,
    BibliotecaWidgetsController,
    PamWidgetsController,
  ],
  providers: [
    EducacionWidgetsService,
    BibliotecaWidgetsService,
    PamWidgetsService,
    PamEmailService,
    PamSchedulerService,
  ],
})
export class WidgetsModule {}
