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
import { RequireModule } from '../../core/guards/module.decorator';
import { CatalogEducacionService } from './catalog-educacion.service';
import {
  UpsertEducacionDistrictDto,
  UpsertEducacionOfertaDto,
  UpsertEducacionSedeDto,
} from './dto/catalog-educacion.dto';

@Controller('educacion-catalog')
@RequireModule(AppModule.catalog_educacion)
export class CatalogEducacionController {
  constructor(private readonly catalog: CatalogEducacionService) {}

  @Get('options')
  options() {
    return this.catalog.options();
  }

  @Get('cursos')
  cursos() {
    return this.catalog.listCursos();
  }

  @Post('cursos')
  createCurso(@Body() body: UpsertEducacionOfertaDto) {
    return this.catalog.createCurso(body);
  }

  @Patch('cursos/:id')
  updateCurso(@Param('id') id: string, @Body() body: UpsertEducacionOfertaDto) {
    return this.catalog.updateCurso(id, body);
  }

  @Delete('cursos/:id')
  deleteCurso(@Param('id') id: string) {
    return this.catalog.deleteCurso(id);
  }

  @Get('programas')
  programas() {
    return this.catalog.listProgramas();
  }

  @Post('programas')
  createPrograma(@Body() body: UpsertEducacionOfertaDto) {
    return this.catalog.createPrograma(body);
  }

  @Patch('programas/:id')
  updatePrograma(
    @Param('id') id: string,
    @Body() body: UpsertEducacionOfertaDto,
  ) {
    return this.catalog.updatePrograma(id, body);
  }

  @Delete('programas/:id')
  deletePrograma(@Param('id') id: string) {
    return this.catalog.deletePrograma(id);
  }

  @Get('distritos')
  distritos() {
    return this.catalog.listDistritos();
  }

  @Post('distritos')
  createDistrito(@Body() body: UpsertEducacionDistrictDto) {
    return this.catalog.createDistrito(body);
  }

  @Patch('distritos/:id')
  updateDistrito(
    @Param('id') id: string,
    @Body() body: UpsertEducacionDistrictDto,
  ) {
    return this.catalog.updateDistrito(id, body);
  }

  @Delete('distritos/:id')
  deleteDistrito(@Param('id') id: string) {
    return this.catalog.deleteDistrito(id);
  }

  @Get('sedes')
  sedes() {
    return this.catalog.listSedes();
  }

  @Post('sedes')
  createSede(@Body() body: UpsertEducacionSedeDto) {
    return this.catalog.createSede(body);
  }

  @Patch('sedes/:id')
  updateSede(@Param('id') id: string, @Body() body: UpsertEducacionSedeDto) {
    return this.catalog.updateSede(id, body);
  }

  @Delete('sedes/:id')
  deleteSede(@Param('id') id: string) {
    return this.catalog.deleteSede(id);
  }
}
