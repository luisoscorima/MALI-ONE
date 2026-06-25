import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { User } from '@prisma/client';
import { Request } from 'express';
import { SuperAdminOnly } from '../../core/guards/super-admin.decorator';
import { AppUsersService } from './app-users.service';
import { UpdateUserModulesDto } from './dto/update-user-modules.dto';

@Controller('admin/app-users')
@SuperAdminOnly()
export class AppUsersController {
  constructor(private readonly appUsers: AppUsersService) {}

  @Get()
  list() {
    return this.appUsers.list();
  }

  @Patch(':id/modules')
  updateModules(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateUserModulesDto,
  ) {
    return this.appUsers.updateModules(req.user as User, id, body.modules);
  }
}
