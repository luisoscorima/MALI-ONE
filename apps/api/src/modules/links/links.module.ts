import { Module } from '@nestjs/common';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';
import { RedirectController } from './redirect.controller';

@Module({
  controllers: [LinksController, RedirectController],
  providers: [LinksService],
})
export class LinksModule {}
