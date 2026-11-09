import { Module } from '@nestjs/common';
import { GoogleAdminModule } from '../google-admin/google-admin.module';
import { NewslettersModule } from '../newsletters/newsletters.module';
import { InternalCommunicationsController } from './internal-communications.controller';
import { InternalCommunicationsService } from './internal-communications.service';

@Module({
  imports: [GoogleAdminModule, NewslettersModule],
  controllers: [InternalCommunicationsController],
  providers: [InternalCommunicationsService],
})
export class InternalCommunicationsModule {}
