import { Global, Module } from '@nestjs/common';
import { EmailDeliveryService } from './email-delivery.service';

@Global()
@Module({
  providers: [EmailDeliveryService],
  exports: [EmailDeliveryService],
})
export class EmailDeliveryModule {}
