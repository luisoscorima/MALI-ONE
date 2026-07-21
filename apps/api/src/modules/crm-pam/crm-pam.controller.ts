import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AppModule, User } from '@prisma/client';
import type { Request } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { RequirePermission } from '../../core/guards/permission.decorator';
import { CrmPamService } from './crm-pam.service';
import {
  CreateCrmAttributeDefinitionDto,
  CreateEmailCampaignDto,
  CreatePamPaymentDto,
  CreatePamPaymentMethodDto,
  ListCrmContactsQueryDto,
  PatchCrmContactDto,
  UpdateCrmAttributeDefinitionDto,
  UpdatePamPaymentMethodDto,
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

  @Patch('contacts/:id')
  patchContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PatchCrmContactDto,
  ) {
    return this.crmPam.patchContact(id, body);
  }

  @Get('attribute-definitions')
  listAttributeDefinitions() {
    return this.crmPam.listAttributeDefinitions();
  }

  @Get('segments')
  listSegments() {
    return this.crmPam.listSegments();
  }

  @Post('attribute-definitions')
  createAttributeDefinition(@Body() body: CreateCrmAttributeDefinitionDto) {
    return this.crmPam.createAttributeDefinition(body);
  }

  @Patch('attribute-definitions/:id')
  updateAttributeDefinition(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCrmAttributeDefinitionDto,
  ) {
    return this.crmPam.updateAttributeDefinition(id, body);
  }

  @Get('payments')
  @RequirePermission('pam.registros.read')
  listPayments() {
    return this.crmPam.listPayments();
  }

  @Get('payment-methods')
  @RequirePermission('pam.registros.read')
  listPaymentMethods() {
    return this.crmPam.listPaymentMethods(true);
  }

  @Post('payment-methods')
  @RequirePermission('pam.registros.manage')
  createPaymentMethod(@Body() body: CreatePamPaymentMethodDto) {
    return this.crmPam.createPaymentMethod(body);
  }

  @Patch('payment-methods/:id')
  @RequirePermission('pam.registros.manage')
  updatePaymentMethod(
    @Param('id') id: string,
    @Body() body: UpdatePamPaymentMethodDto,
  ) {
    return this.crmPam.updatePaymentMethod(id, body);
  }

  @Delete('payment-methods/:id')
  @RequirePermission('pam.registros.manage')
  deletePaymentMethod(@Param('id') id: string) {
    return this.crmPam.deletePaymentMethod(id);
  }

  @Post('payments')
  @RequirePermission('pam.registros.manage')
  createPayment(@Body() body: CreatePamPaymentDto) {
    return this.crmPam.createPayment(body);
  }

  @Post('payments/link-by-phone')
  @RequirePermission('pam.registros.manage')
  linkPaymentsByPhone() {
    return this.crmPam.linkPaymentsByPhone();
  }

  @Post('payments/:id/link-contact')
  @RequirePermission('pam.registros.manage')
  linkPayment(@Param('id') id: string) {
    return this.crmPam.linkPayment(id);
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
