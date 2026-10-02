import { Module } from '@nestjs/common';
import { LandingsAdminController } from './landings-admin.controller';
import { LandingsPublicController } from './landings-public.controller';
import { LandingsService } from './landings.service';

@Module({
  controllers: [LandingsAdminController, LandingsPublicController],
  providers: [LandingsService],
})
export class LandingsModule {}
