import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AppModule, User } from '@prisma/client';
import { Request, Response } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { BulkShortenDto } from './dto/bulk-shorten.dto';
import { BulkWhatsappDto } from './dto/bulk-whatsapp.dto';
import { CreateWhatsappLinkDto } from './dto/create-whatsapp.dto';
import { SaveQrDefaultStyleDto } from './dto/save-qr-default-style.dto';
import { ShortenUrlDto } from './dto/shorten-url.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import { UpdateQrStyleDto } from './dto/update-qr-style.dto';
import { LinksService } from './links.service';
import type { QrExportFormat } from '../../core/qr/qr.service';

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

  @Post('bulk/shorten')
  bulkShorten(@Req() req: Request, @Body() body: BulkShortenDto) {
    return this.links.bulkShortenUrls(req.user as User, body.items);
  }

  @Post('bulk/whatsapp')
  bulkWhatsapp(@Req() req: Request, @Body() body: BulkWhatsappDto) {
    return this.links.bulkCreateWhatsappLinks(req.user as User, body.items);
  }

  @Post('bulk/upload')
  @UseInterceptors(FilesInterceptor('files', 50))
  bulkUpload(
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.links.bulkUploadFiles(req.user as User, files ?? []);
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

  @Get('me/qr-default-style')
  getQrDefaultStyle(@Req() req: Request) {
    return this.links.getQrDefaultStyle(req.user as User);
  }

  @Put('me/qr-default-style')
  saveQrDefaultStyle(
    @Req() req: Request,
    @Body() body: SaveQrDefaultStyleDto,
  ) {
    return this.links.saveQrDefaultStyle(req.user as User, body);
  }

  @Get()
  list(@Req() req: Request, @Query('tag') tag?: string) {
    return this.links.listLinks(req.user as User, tag);
  }

  @Get(':id/stats')
  stats(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const parsedDays = days ? Number(days) : 30;
    return this.links.getLinkStats(
      req.user as User,
      id,
      Number.isFinite(parsedDays) ? parsedDays : 30,
    );
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateLinkDto,
  ) {
    return this.links.updateLink(req.user as User, id, body);
  }

  @Patch(':id/qr-style')
  @UseInterceptors(FileInterceptor('logo'))
  updateQrStyle(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('payload') payloadRaw: string | undefined,
    @Body() body: UpdateQrStyleDto,
    @UploadedFile() logo?: Express.Multer.File,
    @Query('saveAsDefault') saveAsDefault?: string,
  ) {
    let input: UpdateQrStyleDto = body;
    if (payloadRaw) {
      try {
        input = JSON.parse(payloadRaw) as UpdateQrStyleDto;
      } catch {
        throw new BadRequestException('Payload de estilo inválido');
      }
    }
    return this.links.updateLinkQrStyle(
      req.user as User,
      id,
      input,
      logo,
      saveAsDefault === 'true' || saveAsDefault === '1',
    );
  }

  @Delete(':id/qr-logo')
  removeQrLogo(@Req() req: Request, @Param('id') id: string) {
    return this.links.removeLinkQrLogo(req.user as User, id);
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
    @Query('format') format?: string,
    @Query('width') width?: string,
  ) {
    const fmt = (['png', 'svg', 'eps'].includes(format ?? '')
      ? format
      : 'png') as QrExportFormat;
    const parsedWidth = width ? Number(width) : 512;
    const safeWidth = Number.isFinite(parsedWidth)
      ? Math.min(Math.max(parsedWidth, 128), 2048)
      : 512;

    const { buffer, mimeType, extension } = await this.links.getQrExport(
      id,
      req.user as User,
      fmt,
      safeWidth,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="qr-${id.slice(-8)}.${extension}"`,
    );
    res.send(buffer);
  }
}
