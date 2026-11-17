import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule, User, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { Roles } from '../../core/guards/roles.decorator';
import { MalichimpContactsQueryDto } from './dto/malichimp-query.dto';
import {
  CreateMalichimpCampaignDto,
  CreateMalichimpNewsletterDraftDto,
  MalichimpAudienceDto,
} from './dto/malichimp-campaign.dto';
import { MalichimpService } from './malichimp.service';

@Controller('malichimp')
@RequireModule(AppModule.malichimp)
export class MalichimpController {
  constructor(private readonly malichimp: MalichimpService) {}

  @Get('stats')
  stats() {
    return this.malichimp.stats();
  }

  @Get('contacts')
  contacts(@Query() query: MalichimpContactsQueryDto) {
    return this.malichimp.listContacts(query);
  }

  @Get('tags')
  tags() {
    return this.malichimp.listTags();
  }

  @Get('groups')
  groups() {
    return this.malichimp.listGroups();
  }

  @Get('newsletters')
  newsletters() {
    return this.malichimp.listPublishedNewsletters();
  }

  @Get('newsletters/:id')
  newsletter(@Param('id') id: string) {
    return this.malichimp.getCampaignNewsletter(id);
  }

  @Post('newsletters/draft')
  @Roles(UserRole.admin)
  createNewsletterDraft(
    @Req() req: { user: User },
    @Body() body: CreateMalichimpNewsletterDraftDto,
  ) {
    return this.malichimp.createNewsletterDraft(req.user.id, body);
  }

  @Get('campaigns')
  campaigns() {
    return this.malichimp.listCampaigns();
  }

  @Get('campaigns/:id/view')
  async viewCampaign(@Param('id') id: string, @Res() res: Response) {
    const campaign = await this.malichimp.getCampaignBrowserView(id);
    res
      .status(200)
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline' https:; font-src https: data:; script-src 'none'; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      })
      .type('html')
      .send(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(campaign.title)}</title></head><body>${campaign.html}</body></html>`,
      );
  }

  @Get('campaigns/:id')
  campaign(@Param('id') id: string) {
    return this.malichimp.getCampaign(id);
  }

  @Post('campaigns/preview')
  previewCampaign(@Body() body: MalichimpAudienceDto) {
    return this.malichimp.previewAudience(body);
  }

  @Post('campaigns')
  @Roles(UserRole.admin)
  createCampaign(
    @Req() req: { user: User },
    @Body() body: CreateMalichimpCampaignDto,
  ) {
    return this.malichimp.createCampaign(req.user.id, body);
  }

  @Post('campaigns/:id/duplicate')
  @Roles(UserRole.admin)
  duplicateCampaign(
    @Req() req: { user: User },
    @Param('id') id: string,
  ) {
    return this.malichimp.duplicateCampaign(req.user.id, id);
  }

  @Post('campaigns/:id/send')
  @Roles(UserRole.admin)
  sendDraftCampaign(
    @Param('id') id: string,
    @Body() body: CreateMalichimpCampaignDto,
  ) {
    return this.malichimp.sendDraftCampaign(id, body);
  }

  @Post('imports/preview')
  @Roles(UserRole.admin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 100 * 1024 * 1024 },
    }),
  )
  previewImport(
    @Req() req: { user: User },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Selecciona un ZIP');
    return this.malichimp.previewZip(req.user.id, file);
  }

  @Post('imports/xlsx/preview')
  @Roles(UserRole.admin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    }),
  )
  previewXlsxImport(
    @Req() req: { user: User },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('groupOptionIds') groupOptionIds?: string,
    @Body('consentConfirmed') consentConfirmed?: string,
  ) {
    if (!file) throw new BadRequestException('Selecciona un XLSX');
    return this.malichimp.previewXlsx(
      req.user.id,
      file,
      groupOptionIds,
      consentConfirmed,
    );
  }

  @Post('imports/xlsx/:previewId/apply')
  @Roles(UserRole.admin)
  applyXlsxImport(
    @Req() req: { user: User },
    @Param('previewId') previewId: string,
  ) {
    return this.malichimp.applyXlsxImport(req.user.id, previewId);
  }

  @Post('imports/:previewId/apply')
  @Roles(UserRole.admin)
  applyImport(
    @Req() req: { user: User },
    @Param('previewId') previewId: string,
  ) {
    return this.malichimp.startZipImport(req.user.id, previewId);
  }

  @Get('imports/jobs/:jobId')
  @Roles(UserRole.admin)
  importJob(
    @Req() req: { user: User },
    @Param('jobId') jobId: string,
  ) {
    return this.malichimp.getImportJob(req.user.id, jobId);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
