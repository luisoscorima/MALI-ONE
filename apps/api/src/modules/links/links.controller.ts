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
import { BulkQrExportDto } from './dto/bulk-qr-export.dto';
import { BulkShortenDto } from './dto/bulk-shorten.dto';
import { BulkWhatsappDto } from './dto/bulk-whatsapp.dto';
import { CreateWhatsappLinkDto } from './dto/create-whatsapp.dto';
import { SaveQrDefaultStyleDto } from './dto/save-qr-default-style.dto';
import { ShortenUrlDto } from './dto/shorten-url.dto';
import { UpdateLinkDto } from './dto/update-link.dto';
import {
  UpdateQrStyleDto,
  UpdateQrStyleRequestDto,
} from './dto/update-qr-style.dto';
import { parseQrPreviewPayload } from './dto/qr-preview.dto';
import { LinksService } from './links.service';
import type { QrExportFormat } from '../../core/qr/qr.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

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
    @UploadedFiles() files: UploadedFile[],
  ) {
    return this.links.bulkUploadFiles(req.user as User, files ?? []);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Req() req: Request,
    @UploadedFile() file: UploadedFile,
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

  @Post('qr-preview')
  @UseInterceptors(FileInterceptor('logo'))
  async qrPreview(
    @Req() req: Request,
    @Body('payload') payloadRaw: string | undefined,
    @UploadedFile() logo: UploadedFile | undefined,
    @Res() res: Response,
    @Query('width') width?: string,
  ) {
    if (!payloadRaw) {
      throw new BadRequestException('Payload de vista previa requerido');
    }

    const parsedWidth = width ? Number(width) : 260;
    const safeWidth = Number.isFinite(parsedWidth)
      ? Math.min(Math.max(parsedWidth, 128), 1024)
      : 260;

    const { data, style, linkId } = parseQrPreviewPayload(payloadRaw);
    const buffer = await this.links.generateQrPreview(
      req.user as User,
      data,
      style,
      linkId,
      logo,
      safeWidth,
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Get()
  list(@Req() req: Request, @Query('tag') tag?: string) {
    return this.links.listLinks(req.user as User, tag);
  }

  @Post('qr/bulk')
  async qrBulk(
    @Req() req: Request,
    @Body() body: BulkQrExportDto,
    @Res() res: Response,
  ) {
    const format = body.format ?? 'png';
    const width = body.width ?? 512;
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `qrs-${format}-${stamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );

    try {
      await this.links.streamQrExportBulk(
        req.user as User,
        body.ids,
        format,
        width,
        res,
      );
    } catch (error) {
      if (!res.headersSent) {
        throw error;
      }
      res.destroy(error instanceof Error ? error : undefined);
    }
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
  async updateQrStyle(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateQrStyleRequestDto,
    @UploadedFile() logo?: UploadedFile,
    @Query('saveAsDefault') saveAsDefault?: string,
  ) {
    const input = await this.resolveQrStyleInput(body);
    return this.links.updateLinkQrStyle(
      req.user as User,
      id,
      input,
      logo,
      saveAsDefault === 'true' || saveAsDefault === '1',
    );
  }

  private async resolveQrStyleInput(
    body: UpdateQrStyleRequestDto,
  ): Promise<UpdateQrStyleDto> {
    if (body.payload) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(body.payload);
      } catch {
        throw new BadRequestException('Payload de estilo inválido');
      }
      const input = plainToInstance(UpdateQrStyleDto, parsed);
      const errors = await validate(input, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        throw new BadRequestException(
          errors.flatMap((e) => Object.values(e.constraints ?? {})),
        );
      }
      return input;
    }

    const { payload: _payload, ...style } = body;
    return style;
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
    const normalizedFormat = format?.toLowerCase();
    const fmt = (['png', 'svg', 'eps'].includes(normalizedFormat ?? '')
      ? normalizedFormat
      : 'png') as QrExportFormat;
    const parsedWidth = width ? Number(width) : 512;
    const safeWidth = Number.isFinite(parsedWidth)
      ? Math.min(Math.max(parsedWidth, 128), 2048)
      : 512;

    const { buffer, mimeType, filename } = await this.links.getQrExport(
      id,
      req.user as User,
      fmt,
      safeWidth,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }
}
