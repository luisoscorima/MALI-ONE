import { Global, Module } from '@nestjs/common';
import { WhatsappCrmClientService } from './whatsapp-crm-client.service';

@Global()
@Module({
  providers: [WhatsappCrmClientService],
  exports: [WhatsappCrmClientService],
})
export class CrmClientModule {}
