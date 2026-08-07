import { Module } from '@nestjs/common';
import { EducacionWidgetsController } from './educacion/educacion-widgets.controller';
import { EducacionWidgetsService } from './educacion/educacion-widgets.service';
import { EducacionLeadsService } from './educacion/educacion-leads.service';
import { EducacionLeadsSheetsService } from './educacion/educacion-leads-sheets.service';
import { BibliotecaWidgetsController } from './biblioteca/biblioteca-widgets.controller';
import { BibliotecaWidgetsService } from './biblioteca/biblioteca-widgets.service';
import { PamWidgetsController } from './pam/pam-widgets.controller';
import { PamWidgetsService } from './pam/pam-widgets.service';
import { PamEmailService } from './pam/pam-email.service';
import { PamSchedulerService } from './pam/pam-scheduler.service';
import { MuseoWidgetsController } from './museo/museo-widgets.controller';

@Module({
  controllers: [
    EducacionWidgetsController,
    BibliotecaWidgetsController,
    PamWidgetsController,
    MuseoWidgetsController,
  ],
  providers: [
    EducacionWidgetsService,
    EducacionLeadsService,
    EducacionLeadsSheetsService,
    BibliotecaWidgetsService,
    PamWidgetsService,
    PamEmailService,
    PamSchedulerService,
  ],
  exports: [PamWidgetsService],
})
export class WidgetsModule {}
