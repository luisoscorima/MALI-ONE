import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
@RequireModule(AppModule.newsletters)
export class NewslettersAdminController {
  constructor(private readonly newsletters: NewslettersService) {}

  @Get()
  list() {
    return this.newsletters.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.newsletters.get(id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateNewsletterDto) {
    return this.newsletters.create((req.user as User).id, body);
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
