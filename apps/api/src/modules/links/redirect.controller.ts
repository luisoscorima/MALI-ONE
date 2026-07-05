import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../core/guards/public.decorator';
import { LinksService } from '../links/links.service';

@Controller()
export class RedirectController {
  constructor(private readonly links: LinksService) {}

  @Public()
  @Get('r/:slug')
  async redirect(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ua = req.headers['user-agent'];
    const target = await this.links.resolveRedirect(
      slug,
      typeof ua === 'string' ? ua : undefined,
    );
    return res.redirect(302, target);
  }
}
