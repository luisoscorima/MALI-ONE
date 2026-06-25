import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../../core/guards/public.decorator';
import { LinksService } from '../links/links.service';

@Controller()
export class RedirectController {
  constructor(private readonly links: LinksService) {}

  @Public()
  @Get('r/:slug')
  async redirect(@Param('slug') slug: string, @Res() res: Response) {
    const target = await this.links.resolveRedirect(slug);
    return res.redirect(302, target);
  }
}
