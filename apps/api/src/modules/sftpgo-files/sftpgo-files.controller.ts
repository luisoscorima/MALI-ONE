import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule } from '@prisma/client';
import { Response } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import {
  CopyFileDto,
  MkdirDto,
  RenameFileDto,
  RestoreFileDto,
} from './dto/files.dto';
import {
  SftpgoFilesService,
  UploadedFileLike,
} from './sftpgo-files.service';

@Controller('files')
@RequireModule(AppModule.files)
export class SftpgoFilesController {
  constructor(private readonly files: SftpgoFilesService) {}

  @Get('config')
  config() {
    return this.files.getPublicConfig();
  }

  @Get('trash')
  listTrash(@Query('path') path?: string) {
    return this.files.listTrash(path);
  }

  @Get()
  list(@Query('path') path?: string) {
    return this.files.list(path ?? '/');
  }

  @Post('mkdir')
  mkdir(@Body() body: MkdirDto) {
    return this.files.mkdir(body.path);
  }

  @Post('rename')
  rename(@Body() body: RenameFileDto) {
    return this.files.rename(body.from, body.to);
  }

  @Post('copy')
  copy(@Body() body: CopyFileDto) {
    return this.files.copy(body.from, body.to);
  }

  @Post('restore')
  restore(@Body() body: RestoreFileDto) {
    return this.files.restore(body.path);
  }

  @Delete()
  remove(
    @Query('path') path: string,
    @Query('isFolder') isFolder?: string,
  ) {
    if (!path?.trim()) {
      throw new BadRequestException('path requerido');
    }
    return this.files.remove(
      path,
      isFolder === '1' || isFolder === 'true',
    );
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Query('path') path: string | undefined,
    @UploadedFile() file: UploadedFileLike,
  ) {
    if (!file) throw new BadRequestException('file requerido');
    return this.files.upload(path ?? '/', file);
  }

  @Get('preview')
  async preview(
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!path?.trim()) {
      throw new BadRequestException('path requerido');
    }
    const mime = this.files.previewMime(path);
    const { stream, fileName } = await this.files.preview(path);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Content-Type', mime);
    return stream;
  }

  @Get('download')
  async download(
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!path?.trim()) {
      throw new BadRequestException('path requerido');
    }
    const { stream, fileName } = await this.files.download(path);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    return stream;
  }
}
