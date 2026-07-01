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
import { User, AppModule } from '@prisma/client';
import { Request } from 'express';
import { RequireModule } from '../../core/guards/module.decorator';
import { GoogleAdminService } from './google-admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('admin/users')
@RequireModule(AppModule.workspace_users)
export class GoogleAdminController {
  constructor(private readonly googleAdmin: GoogleAdminService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.googleAdmin.listUsers(q, pageToken);
  }

  @Get(':email')
  get(@Param('email') email: string) {
    return this.googleAdmin.getUser(email);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: CreateUserDto) {
    const actor = req.user as User;
    const user = await this.googleAdmin.createUser(body);
    await this.googleAdmin.logAction(actor, 'CREATE_USER', body.primaryEmail, {
      orgUnitPath: body.orgUnitPath,
    });
    return user;
  }

  @Patch(':email')
  async update(
    @Req() req: Request,
    @Param('email') email: string,
    @Body() body: UpdateUserDto,
  ) {
    const actor = req.user as User;
    const user = await this.googleAdmin.updateUser(email, body);
    await this.googleAdmin.logAction(actor, 'UPDATE_USER', email, {
      ...body,
    });
    return user;
  }

  @Post(':email/reset-password')
  async resetPassword(@Req() req: Request, @Param('email') email: string) {
    const actor = req.user as User;
    const result = await this.googleAdmin.resetPassword(email);
    await this.googleAdmin.logAction(actor, 'RESET_PASSWORD', email);
    return result;
  }

  @Post(':email/sign-out')
  async signOut(@Req() req: Request, @Param('email') email: string) {
    const actor = req.user as User;
    const result = await this.googleAdmin.signOutUser(email);
    await this.googleAdmin.logAction(actor, 'SIGN_OUT_USER', email);
    return result;
  }

  @Delete(':email')
  async suspend(@Req() req: Request, @Param('email') email: string) {
    const actor = req.user as User;
    const user = await this.googleAdmin.suspendUser(email);
    await this.googleAdmin.logAction(actor, 'SUSPEND_USER', email);
    return user;
  }
}
