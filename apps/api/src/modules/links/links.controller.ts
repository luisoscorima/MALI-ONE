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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule, User } from '@prisma/client';
import { Request, Response } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { CreateWhatsappLinkDto } from './dto/create-whatsapp.dto';
import { ShortenUrlDto } from './dto/shorten-url.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { LinksService } from './links.service';

function parseTagsInput(raw?: string | string[]): string[] | undefined {
  if (raw === undefined || raw === '') return undefined;
  const values = Array.isArray(raw) ? raw : raw.split(',');
  return values.map((tag) => tag.trim()).filter(Boolean);
}

@Controller('links')
@RequireModule(AppModule.links)
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post('shorten')
  shorten(@Req() req: Request, @Body() body: ShortenUrlDto) {
    return this.links.shortenUrl(
      req.user as User,
      body.url,
      body.customSlug,
      body.tags,
    );
  }

  @Post('whatsapp')
  whatsapp(@Req() req: Request, @Body() body: CreateWhatsappLinkDto) {
    return this.links.createWhatsappLink(
      req.user as User,
      body.phone,
      body.text,
      body.customSlug,
      body.tags,
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
    @Body('customSlug') customSlug?: string,
    @Body('tags') tagsRaw?: string,
  ) {
    return this.links.uploadFile(
      req.user as User,
      file,
      customSlug,
      parseTagsInput(tagsRaw),
    );
  }

  @Get()
  list(@Req() req: Request, @Query('tag') tag?: string) {
    return this.links.listLinks(req.user as User, tag);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateLinkDto,
  ) {
    return this.links.updateLink(req.user as User, id, body);
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
