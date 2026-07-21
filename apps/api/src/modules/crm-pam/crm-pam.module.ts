import { Module } from '@nestjs/common';
import { NewslettersModule } from '../newsletters/newsletters.module';
import { CrmPamController } from './crm-pam.controller';
import { CrmPamService } from './crm-pam.service';
import { SesMailService } from './ses-mail.service';

@Module({
  imports: [NewslettersModule],
  controllers: [CrmPamController],
  providers: [CrmPamService, SesMailService],
})
export class CrmPamModule {}
