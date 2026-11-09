import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { AppModule, User, UserRole } from '@prisma/client';
import { RequireModule } from '../../core/guards/module.decorator';
import { Roles } from '../../core/guards/roles.decorator';
import { CreateInternalCampaignDto } from './dto/create-internal-campaign.dto';
import { InternalCommunicationsService } from './internal-communications.service';

@Controller('internal-communications')
@RequireModule(AppModule.internal_communications)
export class InternalCommunicationsController {
  constructor(private readonly communications: InternalCommunicationsService) {}

  @Get('audience')
  audience(@Query('activeDays') activeDays?: string) {
    const days = Math.min(90, Math.max(1, Number(activeDays) || 30));
    return this.communications.audience(days);
  }

  @Get('newsletters')
  newsletters() {
    return this.communications.newsletters();
  }

  @Get('campaigns')
  campaigns() {
    return this.communications.campaigns();
  }

  @Post('campaigns')
  @Roles(UserRole.admin)
  createCampaign(@Req() req: { user: User }, @Body() body: CreateInternalCampaignDto) {
    return this.communications.createCampaign(req.user.id, body);
  }
}
