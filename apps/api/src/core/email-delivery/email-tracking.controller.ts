import { Controller, Get, Header, Param, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../guards/public.decorator';
import { EmailTrackingService } from './email-tracking.service';

/** CSP for frozen email HTML: images + inline CSS only; no scripts/forms/frames. */
const BROWSER_VIEW_CSP = [
  "default-src 'none'",
  "img-src https: http: data:",
  "style-src 'unsafe-inline'",
  "font-src https: http: data:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

@Controller()
export class EmailTrackingController {
  constructor(private readonly tracking: EmailTrackingService) {}

  @Public()
  @Get('mail/view/:token')
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @Header('Content-Security-Policy', BROWSER_VIEW_CSP)
  @Header('X-Content-Type-Options', 'nosniff')
  async viewInBrowser(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const html = await this.tracking.renderBrowserView(token);
    res.status(200).type('html').send(html);
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
    await this.tracking.recordOpen(
      token.replace(/\.gif$/i, ''),
      req.headers['user-agent'],
    );
    res.status(200).send(this.tracking.getPixelBuffer());
  }

  @Public()
  @Get('mail/c/:token')
  async clickRedirect(
    @Param('token') token: string,
    @Query('u') url: string,
    @Req() req: { headers: { 'user-agent'?: string } },
    @Res() res: Response,
  ) {
    const result = await this.tracking.recordClick(
      token,
      url || '/',
      req.headers['user-agent'],
    );
    res.redirect(302, result.url);
  }
}
