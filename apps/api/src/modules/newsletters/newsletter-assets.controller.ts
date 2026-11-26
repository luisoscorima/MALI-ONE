import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule } from '@prisma/client';
import { RequireModule } from '../../core/guards/module.decorator';
import { NEWSLETTER_ASSET_MAX_BYTES, NewsletterAssetsService } from './newsletter-assets.service';

type UploadedAssetFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('newsletters')
@RequireModule(
  AppModule.email_hub,
  AppModule.malichimp,
  AppModule.google_workspace,
)
export class NewsletterAssetsController {
  constructor(private readonly assets: NewsletterAssetsService) {}

  @Get('assets/limits')
  getLimits() {
    return { maxBytes: this.assets.maxUploadBytes };
  }

  @Post('assets/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: NEWSLETTER_ASSET_MAX_BYTES + 1 },
    }),
  )
  upload(
    @UploadedFile() file: UploadedAssetFile | undefined,
    @Body('scope') scope?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona una imagen');
    }
    return this.assets.upload(file, scope);
  }
}
