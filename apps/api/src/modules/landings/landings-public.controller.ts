import { Controller, Get, Header, Param } from '@nestjs/common';
import { Public } from '../../core/guards/public.decorator';
import { LandingsService } from './landings.service';

@Controller('landings/public')
export class LandingsPublicController {
  constructor(private readonly landings: LandingsService) {}

  @Public()
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60, stale-if-error=86400')
  get(@Param('slug') slug: string) {
    return this.landings.getPublished(slug);
  }
}
