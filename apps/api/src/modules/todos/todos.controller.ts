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
import { AppModule, User, UserRole } from '@prisma/client';
import { Request } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { Roles } from '../../core/guards/roles.decorator';
import {
  AddTodoTimeDto,
  CreateTodoItemDto,
  CreateTodoStatusDto,
  CreateTodoTypeDto,
  UpdateTodoItemDto,
  UpdateTodoStatusDto,
  UpdateTodoTypeDto,
} from './dto/todos.dto';
import { TodosService } from './todos.service';

@Controller('todos')
@RequireModule(AppModule.todos)
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Get('meta')
  getMeta() {
    return this.todos.getMeta();
  }

  @Post('meta/types')
  @Roles(UserRole.admin)
  createType(@Body() body: CreateTodoTypeDto) {
    return this.todos.createType(body);
  }

  @Patch('meta/types/:id')
  @Roles(UserRole.admin)
  updateType(@Param('id') id: string, @Body() body: UpdateTodoTypeDto) {
    return this.todos.updateType(id, body);
  }

  @Post('meta/statuses')
  @Roles(UserRole.admin)
  createStatus(@Body() body: CreateTodoStatusDto) {
    return this.todos.createStatus(body);
  }

  @Patch('meta/statuses/:id')
  @Roles(UserRole.admin)
  updateStatus(@Param('id') id: string, @Body() body: UpdateTodoStatusDto) {
    return this.todos.updateStatus(id, body);
  }

  @Get()
  list(@Req() req: Request, @Query('ownerId') ownerId?: string) {
    return this.todos.list(req.user as User, ownerId);
  }

  @Get(':id')
  getOne(@Req() req: Request, @Param('id') id: string) {
    return this.todos.getOne(req.user as User, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: CreateTodoItemDto) {
    return this.todos.create(req.user as User, body);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateTodoItemDto,
  ) {
    return this.todos.update(req.user as User, id, body);
  }

  @Post(':id/time')
  addTime(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: AddTodoTimeDto,
  ) {
    return this.todos.addTime(req.user as User, id, body);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.todos.remove(req.user as User, id);
  }
}
