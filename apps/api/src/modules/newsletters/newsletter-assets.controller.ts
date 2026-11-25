import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule } from '@prisma/client';
import { RequireModule } from '../../core/guards/module.decorator';
import { NewsletterAssetsService } from './newsletter-assets.service';

/** Allow ~30MB camera exports before sharp shrinks them for email. */
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

type UploadedAssetFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('newsletters')
@RequireModule(
  AppModule.newsletters,
  AppModule.malichimp,
  AppModule.workspace_users,
)
export class NewsletterAssetsController {
  constructor(private readonly assets: NewsletterAssetsService) {}

  @Post('assets/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: MAX_UPLOAD_BYTES },
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
