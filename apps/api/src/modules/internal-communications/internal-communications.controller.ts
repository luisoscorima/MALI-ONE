import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AppModule, User } from '@prisma/client';
import type { Response } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import {
  CreateInternalCampaignDto,
  PreviewInternalAudienceDto,
} from './dto/create-internal-campaign.dto';
import { InternalCommunicationsService } from './internal-communications.service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Controller('internal-communications')
@RequireModule(AppModule.workspace_users)
export class InternalCommunicationsController {
  constructor(private readonly communications: InternalCommunicationsService) {}

  @Get('audience')
  audience(@Query('activeDays') activeDays?: string) {
    const days = Math.min(90, Math.max(1, Number(activeDays) || 30));
    return this.communications.audience(days);
  }

  @Post('audience/preview')
  previewAudience(@Body() body: PreviewInternalAudienceDto) {
    return this.communications.previewAudience(body);
  }

  @Get('newsletters')
  newsletters() {
    return this.communications.newsletters();
  }

  @Get('campaigns')
  campaigns() {
    return this.communications.campaigns();
  }

  @Get('campaigns/:id/view')
  async viewCampaign(@Param('id') id: string, @Res() res: Response) {
    const campaign = await this.communications.getCampaignBrowserView(id);
    res
      .status(200)
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy':
          "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline' https:; font-src https: data:; script-src 'none'; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      })
      .type('html')
      .send(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(campaign.title)}</title></head><body>${campaign.html}</body></html>`,
      );
  }

  @Get('campaigns/:id/stats')
  campaignStats(@Param('id') id: string, @Query('days') days?: string) {
    const parsedDays = days ? Number(days) : 30;
    return this.communications.getCampaignStats(
      id,
      Number.isFinite(parsedDays) ? parsedDays : 30,
    );
  }

  @Get('campaigns/:id')
  campaign(@Param('id') id: string) {
    return this.communications.getCampaign(id);
  }

  @Post('campaigns')
  createCampaign(@Req() req: { user: User }, @Body() body: CreateInternalCampaignDto) {
    return this.communications.createCampaign(req.user.id, body);
  }
}
