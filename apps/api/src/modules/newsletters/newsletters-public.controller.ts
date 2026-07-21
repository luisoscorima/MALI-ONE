import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
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

  @Public()
  @Get('mail/o/:token')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Content-Type', 'image/gif')
  async openPixel(
    @Param('token') token: string,
    @Req() req: { headers: { 'user-agent'?: string } },
    @Res() res: Response,
  ) {
    const openToken = token.replace(/\.gif$/i, '');
    await this.newsletters.recordOpen(openToken, req.headers['user-agent']);
    res.status(200).send(this.newsletters.getPixelBuffer());
  }

  @Public()
  @Get('mail/c/:token')
  async clickRedirect(
    @Param('token') token: string,
    @Query('u') u: string,
    @Req() req: { headers: { 'user-agent'?: string } },
    @Res() res: Response,
  ) {
    const result = await this.newsletters.recordClick(
      token,
      u || '/',
      req.headers['user-agent'],
    );
    res.redirect(302, result.url);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
