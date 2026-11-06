import { Module } from '@nestjs/common';
import { CrmPamController } from './crm-pam.controller';
import { CrmPamService } from './crm-pam.service';

@Module({
  controllers: [CrmPamController],
  providers: [CrmPamService],
})
export class CrmPamModule {}
