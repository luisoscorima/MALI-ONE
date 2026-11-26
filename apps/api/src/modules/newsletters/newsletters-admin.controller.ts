import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AppModule, User } from '@prisma/client';
import type { Request } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import {
  CreateNewsletterDto,
  UpdateNewsletterDto,
} from './dto/newsletter.dto';
import { NewslettersService } from './newsletters.service';

@Controller('newsletters')
@RequireModule(AppModule.email_hub)
export class NewslettersAdminController {
  constructor(private readonly newsletters: NewslettersService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.newsletters.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  /** Cross-module campaign registry (read-only). Must be registered before `:id`. */
  @Get('campaigns')
  listCampaigns() {
    return this.newsletters.listCampaignRegistry();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.newsletters.get(id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateNewsletterDto) {
    return this.newsletters.create((req.user as User).id, body);
  }

  @Post(':id/duplicate')
  duplicate(@Req() req: Request, @Param('id') id: string) {
    return this.newsletters.duplicate((req.user as User).id, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateNewsletterDto) {
    return this.newsletters.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.newsletters.remove(id);
  }
}
