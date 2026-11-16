import { Module } from '@nestjs/common';
import { MalichimpController } from './malichimp.controller';
import { MalichimpService } from './malichimp.service';
import { NewslettersModule } from '../newsletters/newsletters.module';
import { MalichimpPublicController } from './malichimp-public.controller';

@Module({
  imports: [NewslettersModule],
  controllers: [MalichimpController, MalichimpPublicController],
  providers: [MalichimpService],
  exports: [MalichimpService],
})
export class MalichimpModule {}
