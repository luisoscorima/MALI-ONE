import { Module } from '@nestjs/common';
import { LinksController } from './links.controller';
import { LinksInternalController } from './links-internal.controller';
import { LinksService } from './links.service';
import { RedirectController } from './redirect.controller';

@Module({
  controllers: [LinksController, LinksInternalController, RedirectController],
  providers: [LinksService],
})
export class LinksModule {}
