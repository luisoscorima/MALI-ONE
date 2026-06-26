import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AppModule } from '@prisma/client';
import { Public } from '../../../core/guards/public.decorator';
import { RequireModule } from '../../../core/guards/module.decorator';
import { BibliotecaWidgetsService } from './biblioteca-widgets.service';
import {
  CreateCarouselItemDto,
  UpdateCarouselItemDto,
} from '../dto/create-carousel-item.dto';

@Controller('widgets/biblioteca')
export class BibliotecaWidgetsController {
  constructor(private readonly service: BibliotecaWidgetsService) {}

  @Public()
  @Get('carousel')
  getPublicCarousel() {
    return this.service.getPublicCarousel();
  }

  @Get('carousel/admin')
  @RequireModule(AppModule.widget_biblioteca)
  listAdmin() {
    return this.service.listAdmin();
  }

  @Post('carousel')
  @RequireModule(AppModule.widget_biblioteca)
  create(@Body() body: CreateCarouselItemDto) {
    return this.service.create(body);
  }

  @Patch('carousel/:id')
  @RequireModule(AppModule.widget_biblioteca)
  update(@Param('id') id: string, @Body() body: UpdateCarouselItemDto) {
    return this.service.update(id, body);
  }

  @Delete('carousel/:id')
  @RequireModule(AppModule.widget_biblioteca)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
