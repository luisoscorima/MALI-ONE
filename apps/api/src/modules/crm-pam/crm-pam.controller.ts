import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { AppModule, User } from '@prisma/client';
import type { Request } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { CrmPamService } from './crm-pam.service';
import {
  CreateEmailCampaignDto,
  ListCrmContactsQueryDto,
} from './dto/crm-pam.dto';

@Controller('crm-pam')
@RequireModule(AppModule.crm_pam)
export class CrmPamController {
  constructor(private readonly crmPam: CrmPamService) {}

  @Get('contacts')
  listContacts(@Query() query: ListCrmContactsQueryDto) {
    return this.crmPam.listContacts({
      q: query.q,
      segment: query.segment,
      attr_key: query.attr_key,
      attr_value: query.attr_value,
      has_email:
        query.has_email === undefined
          ? undefined
          : query.has_email === 'true' || query.has_email === '1',
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 100,
    });
  }

  @Get('newsletters')
  listPublishedNewsletters() {
    return this.crmPam.listPublishedNewsletters();
  }

  @Get('campaigns')
  listCampaigns() {
    return this.crmPam.listCampaigns();
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.crmPam.getCampaign(id);
  }

  @Get('campaigns/:id/stats')
  getCampaignStats(@Param('id') id: string) {
    return this.crmPam.getCampaignStats(id);
  }

  @Post('campaigns')
  createCampaign(@Req() req: Request, @Body() body: CreateEmailCampaignDto) {
    return this.crmPam.createCampaign((req.user as User).id, body);
  }

  @Get('campaigns/:id/audience-preview')
  previewAudience(@Param('id') id: string) {
    return this.crmPam.previewAudience(id);
  }

  @Post('campaigns/:id/send')
  startCampaign(@Param('id') id: string) {
    return this.crmPam.startCampaign(id);
  }
}
