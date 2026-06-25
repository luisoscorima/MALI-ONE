import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule, User } from '@prisma/client';
import { Request, Response } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { ShortenUrlDto } from './dto/shorten-url.dto';
import { LinksService } from './links.service';

@Controller('links')
@RequireModule(AppModule.links)
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post('shorten')
  shorten(@Req() req: Request, @Body() body: ShortenUrlDto) {
    return this.links.shortenUrl(req.user as User, body.url, body.customSlug);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body('customSlug') customSlug?: string,
  ) {
    return this.links.uploadFile(req.user as User, file, customSlug);
  }

  @Get()
  list(@Req() req: Request) {
    return this.links.listLinks(req.user as User);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.links.deleteLink(req.user as User, id);
  }

  @Get(':id/qr')
  async qr(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.links.getQrPng(id, req.user as User);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  }
}
