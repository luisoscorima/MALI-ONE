import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppModule, User, UserRole } from '@prisma/client';
import { RequireModule } from '../../core/guards/module.decorator';
import { Roles } from '../../core/guards/roles.decorator';
import { MalichimpContactsQueryDto } from './dto/malichimp-query.dto';
import { MalichimpService } from './malichimp.service';

@Controller('malichimp')
@RequireModule(AppModule.malichimp)
export class MalichimpController {
  constructor(private readonly malichimp: MalichimpService) {}

  @Get('stats')
  stats() {
    return this.malichimp.stats();
  }

  @Get('contacts')
  contacts(@Query() query: MalichimpContactsQueryDto) {
    return this.malichimp.listContacts(query);
  }

  @Get('tags')
  tags() {
    return this.malichimp.listTags();
  }

  @Post('imports/preview')
  @Roles(UserRole.admin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: 100 * 1024 * 1024 },
    }),
  )
  previewImport(
    @Req() req: { user: User },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Selecciona un ZIP');
    return this.malichimp.previewZip(req.user.id, file);
  }

  @Post('imports/:previewId/apply')
  @Roles(UserRole.admin)
  applyImport(
    @Req() req: { user: User },
    @Param('previewId') previewId: string,
  ) {
    return this.malichimp.startZipImport(req.user.id, previewId);
  }

  @Get('imports/jobs/:jobId')
  @Roles(UserRole.admin)
  importJob(
    @Req() req: { user: User },
    @Param('jobId') jobId: string,
  ) {
    return this.malichimp.getImportJob(req.user.id, jobId);
  }
}
