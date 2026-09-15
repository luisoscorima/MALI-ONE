import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AppModule, User } from '@prisma/client';
import { Request } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import {
  CreateOperationalServiceDto,
  CreatePortfolioProjectDto,
  ListProjectsQueryDto,
  ReorderProjectsDto,
  UpdateOperationalServiceDto,
  UpdatePortfolioProjectDto,
} from './dto/portfolio.dto';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
@RequireModule(AppModule.portfolio)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get('meta')
  getMeta() {
    return this.portfolio.getMeta();
  }

  @Get('dashboard')
  dashboard(
    @Req() req: Request,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.portfolio.dashboard(req.user as User, ownerId);
  }

  @Get('projects')
  listProjects(@Req() req: Request, @Query() query: ListProjectsQueryDto) {
    return this.portfolio.list(req.user as User, query);
  }

  @Patch('projects/reorder')
  reorderProjects(@Req() req: Request, @Body() body: ReorderProjectsDto) {
    return this.portfolio.reorder(req.user as User, body);
  }

  @Get('projects/:id')
  getProject(@Req() req: Request, @Param('id') id: string) {
    return this.portfolio.getOne(req.user as User, id);
  }

  @Post('projects')
  createProject(
    @Req() req: Request,
    @Body() body: CreatePortfolioProjectDto,
  ) {
    return this.portfolio.create(req.user as User, body);
  }

  @Patch('projects/:id')
  updateProject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdatePortfolioProjectDto,
  ) {
    return this.portfolio.update(req.user as User, id, body);
  }

  @Delete('projects/:id')
  removeProject(@Req() req: Request, @Param('id') id: string) {
    return this.portfolio.remove(req.user as User, id);
  }

  @Get('services')
  listServices(
    @Req() req: Request,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.portfolio.listServices(req.user as User, ownerId);
  }

  @Post('services')
  createService(
    @Req() req: Request,
    @Body() body: CreateOperationalServiceDto,
  ) {
    return this.portfolio.createService(req.user as User, body);
  }

  @Patch('services/:id')
  updateService(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateOperationalServiceDto,
  ) {
    return this.portfolio.updateService(req.user as User, id, body);
  }

  @Delete('services/:id')
  removeService(@Req() req: Request, @Param('id') id: string) {
    return this.portfolio.removeService(req.user as User, id);
  }
}
