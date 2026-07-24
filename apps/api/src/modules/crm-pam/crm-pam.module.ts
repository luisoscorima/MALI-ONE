import { Module } from '@nestjs/common';
import { NewslettersModule } from '../newsletters/newsletters.module';
import { CrmPamSchedulerService } from './crm-pam-scheduler.service';
import { CrmPamController } from './crm-pam.controller';
import { CrmPamService } from './crm-pam.service';
import { SesMailService } from './ses-mail.service';

@Module({
  imports: [NewslettersModule],
  controllers: [CrmPamController],
  providers: [CrmPamService, SesMailService, CrmPamSchedulerService],
})
export class CrmPamModule {}
