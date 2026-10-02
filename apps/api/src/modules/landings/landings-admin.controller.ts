import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { AppModule, User } from '@prisma/client';
import type { Request } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import {
  CreateLandingDto,
  PreviewLandingDto,
  UpdateLandingDto,
} from './dto/landing.dto';
import { LandingsService } from './landings.service';

@Controller('landings')
@RequireModule(AppModule.landings)
export class LandingsAdminController {
  constructor(private readonly landings: LandingsService) {}

  @Get()
  list() {
    return this.landings.list();
  }

  @Post('preview')
  preview(@Body() body: PreviewLandingDto) {
    return this.landings.preview(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.landings.get(id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateLandingDto) {
    return this.landings.create((req.user as User).id, body);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateLandingDto,
  ) {
    return this.landings.update(id, (req.user as User).id, body);
  }

  @Post(':id/publish')
  publish(@Req() req: Request, @Param('id') id: string) {
    return this.landings.publish(id, (req.user as User).id);
  }

  @Post(':id/unpublish')
  unpublish(@Req() req: Request, @Param('id') id: string) {
    return this.landings.unpublish(id, (req.user as User).id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.landings.remove(id);
  }
}
