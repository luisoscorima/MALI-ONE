import { Module } from '@nestjs/common';
import { S3Module } from '../../core/s3/s3.module';
import { NewsletterAssetsController } from './newsletter-assets.controller';
import { NewsletterAssetsService } from './newsletter-assets.service';
import { NewslettersAdminController } from './newsletters-admin.controller';
import { NewslettersPublicController } from './newsletters-public.controller';
import { NewslettersService } from './newsletters.service';

@Module({
  imports: [S3Module],
  controllers: [
    NewsletterAssetsController,
    NewslettersAdminController,
    NewslettersPublicController,
  ],
  providers: [NewslettersService, NewsletterAssetsService],
  exports: [NewslettersService],
})
export class NewslettersModule {}
