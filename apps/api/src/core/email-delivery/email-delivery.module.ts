import { Global, Module } from '@nestjs/common';
import { S3Module } from '../s3/s3.module';
import { EmailDeliveryService } from './email-delivery.service';
import { EmailInlineImagesService } from './email-inline-images.service';
import { SesEventConsumerService } from './ses-event-consumer.service';
import { SesEventProcessorService } from './ses-event-processor.service';
import { EmailDeliveryController } from './email-delivery.controller';
import { EmailCampaignDispatcherService } from './email-campaign-dispatcher.service';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailTrackingService } from './email-tracking.service';
import { EmailSenderService } from './email-sender.service';
import { GmailReplySyncService } from './gmail-reply-sync.service';

@Global()
@Module({
  imports: [S3Module],
  controllers: [EmailDeliveryController, EmailTrackingController],
  providers: [
    EmailDeliveryService,
    EmailInlineImagesService,
    EmailSenderService,
    EmailTrackingService,
    EmailCampaignDispatcherService,
    SesEventProcessorService,
    SesEventConsumerService,
    GmailReplySyncService,
  ],
  exports: [
    EmailDeliveryService,
    EmailSenderService,
    EmailTrackingService,
    SesEventProcessorService,
    GmailReplySyncService,
  ],
})
export class EmailDeliveryModule {}
