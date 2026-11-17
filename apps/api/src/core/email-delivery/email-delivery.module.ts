import { Global, Module } from '@nestjs/common';
import { EmailDeliveryService } from './email-delivery.service';
import { SesEventConsumerService } from './ses-event-consumer.service';
import { SesEventProcessorService } from './ses-event-processor.service';
import { EmailDeliveryController } from './email-delivery.controller';
import { EmailCampaignDispatcherService } from './email-campaign-dispatcher.service';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailTrackingService } from './email-tracking.service';
import { EmailSenderService } from './email-sender.service';

@Global()
@Module({
  controllers: [EmailDeliveryController, EmailTrackingController],
  providers: [
    EmailDeliveryService,
    EmailSenderService,
    EmailTrackingService,
    EmailCampaignDispatcherService,
    SesEventProcessorService,
    SesEventConsumerService,
  ],
  exports: [
    EmailDeliveryService,
    EmailSenderService,
    EmailTrackingService,
    SesEventProcessorService,
  ],
})
export class EmailDeliveryModule {}
