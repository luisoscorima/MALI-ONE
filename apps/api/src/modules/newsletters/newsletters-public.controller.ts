import {
  Controller,
  Get,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../core/guards/public.decorator';
import { NewslettersService } from './newsletters.service';

@Controller()
export class NewslettersPublicController {
  constructor(private readonly newsletters: NewslettersService) {}

  @Public()
  @Get('n/:slug')
  async viewNewsletter(@Param('slug') slug: string, @Res() res: Response) {
    const newsletter = await this.newsletters.getPublishedBySlug(slug);
    res
      .status(200)
      .type('html')
      .send(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(newsletter.title)}</title></head><body>${newsletter.htmlBody}</body></html>`,
      );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
