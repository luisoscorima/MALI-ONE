import { Global, Module } from '@nestjs/common';
import { EmailDeliveryService } from './email-delivery.service';
import { SesEventConsumerService } from './ses-event-consumer.service';
import { SesEventProcessorService } from './ses-event-processor.service';
import { EmailDeliveryController } from './email-delivery.controller';

@Global()
@Module({
  controllers: [EmailDeliveryController],
  providers: [
    EmailDeliveryService,
    SesEventProcessorService,
    SesEventConsumerService,
  ],
  exports: [EmailDeliveryService, SesEventProcessorService],
})
export class EmailDeliveryModule {}
