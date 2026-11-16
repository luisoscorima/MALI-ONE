import { Controller, Get, Header, Param, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../guards/public.decorator';
import { EmailTrackingService } from './email-tracking.service';

@Controller()
export class EmailTrackingController {
  constructor(private readonly tracking: EmailTrackingService) {}

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
