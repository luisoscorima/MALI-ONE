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
} from '@nestjs/common';
import { AppModule } from '@prisma/client';
import { Public } from '../../../core/guards/public.decorator';
import { RequireModule } from '../../../core/guards/module.decorator';
import { EducacionWidgetsService } from './educacion-widgets.service';
import { UpdateEducacionSettingsDto } from '../dto/update-educacion-settings.dto';
import {
  CreateEducacionDistrictDto,
  UpdateEducacionDistrictDto,
} from '../dto/create-educacion-district.dto';
import {
  CreateEducacionSedeDto,
  UpdateEducacionSedeDto,
} from '../dto/create-educacion-sede.dto';
import {
  CreateEducacionSelectorSedeDto,
  UpdateEducacionSelectorSedeDto,
} from '../dto/create-educacion-selector-sede.dto';
import { UpdateEducacionPopupDto } from '../dto/update-educacion-popup.dto';
import {
  CreateEducacionAliadoDto,
  UpdateEducacionAliadoDto,
} from '../dto/create-educacion-aliado.dto';

@Controller('widgets/educacion')
export class EducacionWidgetsController {
  constructor(private readonly service: EducacionWidgetsService) {}

  @Public()
  @Get('config')
  getPublicConfig() {
    return this.service.getPublicConfig();
  }

  @Public()
  @Get('selector/config')
  getSelectorPublicConfig() {
    return this.service.getSelectorPublicConfig();
  }

  @Public()
  @Get('calendar/config')
  getCalendarConfig() {
    return this.service.getCalendarPublicConfig();
  }

  @Public()
  @Get('calendar/events')
  getCalendarEvents(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.service.getCalendarEvents(
      Number(month) || new Date().getMonth() + 1,
      Number(year) || new Date().getFullYear(),
    );
  }

  @Public()
  @Get('popup/config')
  getPopupPublicConfig() {
    return this.service.getPopupPublicConfig();
  }

  @Public()
  @Get('aliados/config')
  getAliadosPublicConfig() {
    return this.service.getAliadosPublicConfig();
  }

  @Get('admin')
  @RequireModule(AppModule.widget_educacion)
  getAdmin() {
    return this.service.getAdminState();
  }

  @Put('settings')
  @RequireModule(AppModule.widget_educacion)
  updateSettings(@Body() body: UpdateEducacionSettingsDto) {
    return this.service.updateSettings(body);
  }

  @Post('districts')
  @RequireModule(AppModule.widget_educacion)
  createDistrict(@Body() body: CreateEducacionDistrictDto) {
    return this.service.createDistrict(body);
  }

  @Patch('districts/:id')
  @RequireModule(AppModule.widget_educacion)
  updateDistrict(
    @Param('id') id: string,
    @Body() body: UpdateEducacionDistrictDto,
  ) {
    return this.service.updateDistrict(id, body);
  }

  @Delete('districts/:id')
  @RequireModule(AppModule.widget_educacion)
  deleteDistrict(@Param('id') id: string) {
    return this.service.deleteDistrict(id);
  }

  @Post('sedes')
  @RequireModule(AppModule.widget_educacion)
  createSede(@Body() body: CreateEducacionSedeDto) {
    return this.service.createSede(body);
  }

  @Patch('sedes/:id')
  @RequireModule(AppModule.widget_educacion)
  updateSede(@Param('id') id: string, @Body() body: UpdateEducacionSedeDto) {
    return this.service.updateSede(id, body);
  }

  @Delete('sedes/:id')
  @RequireModule(AppModule.widget_educacion)
  deleteSede(@Param('id') id: string) {
    return this.service.deleteSede(id);
  }

  @Post('selector/sedes')
  @RequireModule(AppModule.widget_educacion)
  createSelectorSede(@Body() body: CreateEducacionSelectorSedeDto) {
    return this.service.createSelectorSede(body);
  }

  @Patch('selector/sedes/:id')
  @RequireModule(AppModule.widget_educacion)
  updateSelectorSede(
    @Param('id') id: string,
    @Body() body: UpdateEducacionSelectorSedeDto,
  ) {
    return this.service.updateSelectorSede(id, body);
  }

  @Delete('selector/sedes/:id')
  @RequireModule(AppModule.widget_educacion)
  deleteSelectorSede(@Param('id') id: string) {
    return this.service.deleteSelectorSede(id);
  }

  @Put('popup')
  @RequireModule(AppModule.widget_educacion)
  updatePopup(@Body() body: UpdateEducacionPopupDto) {
    return this.service.updatePopup(body);
  }

  @Post('aliados')
  @RequireModule(AppModule.widget_educacion)
  createAliado(@Body() body: CreateEducacionAliadoDto) {
    return this.service.createAliado(body);
  }

  @Patch('aliados/:id')
  @RequireModule(AppModule.widget_educacion)
  updateAliado(
    @Param('id') id: string,
    @Body() body: UpdateEducacionAliadoDto,
  ) {
    return this.service.updateAliado(id, body);
  }

  @Delete('aliados/:id')
  @RequireModule(AppModule.widget_educacion)
  deleteAliado(@Param('id') id: string) {
    return this.service.deleteAliado(id);
  }
}
