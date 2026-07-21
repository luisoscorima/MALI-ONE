import { Module } from '@nestjs/common';
import { NewslettersAdminController } from './newsletters-admin.controller';
import { NewslettersPublicController } from './newsletters-public.controller';
import { NewslettersService } from './newsletters.service';

@Module({
  controllers: [NewslettersAdminController, NewslettersPublicController],
  providers: [NewslettersService],
  exports: [NewslettersService],
})
export class NewslettersModule {}
