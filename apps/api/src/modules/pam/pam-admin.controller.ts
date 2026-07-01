import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { RequirePermission } from '../../core/guards/permission.decorator';
import { PamWidgetsService } from '../widgets/pam/pam-widgets.service';
import {
  CreatePamPlanDto,
  UpdatePamPlanDto,
  UpdatePamRegistrationDto,
  UpdatePamSettingsDto,
} from '../widgets/dto/pam.dto';

@Controller('pam')
export class PamAdminController {
  constructor(private readonly service: PamWidgetsService) {}

  @Get('settings')
  @RequirePermission('pam.settings.manage')
  getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequirePermission('pam.settings.manage')
  updateSettings(@Body() body: UpdatePamSettingsDto) {
    return this.service.updateSettings(body);
  }

  @Get('plans')
  @RequirePermission('pam.planes.manage')
  listPlans() {
    return this.service.listPlans();
  }

  @Post('plans')
  @RequirePermission('pam.planes.manage')
  createPlan(@Body() body: CreatePamPlanDto) {
    return this.service.createPlan(body);
  }

  @Patch('plans/:id')
  @RequirePermission('pam.planes.manage')
  updatePlan(@Param('id') id: string, @Body() body: UpdatePamPlanDto) {
    return this.service.updatePlan(id, body);
  }

  @Delete('plans/:id')
  @RequirePermission('pam.planes.manage')
  deletePlan(@Param('id') id: string) {
    return this.service.deletePlan(id);
  }

  @Get('registrations')
  @RequirePermission('pam.registros.read')
  listRegistrations() {
    return this.service.listRegistrations();
  }

  @Patch('registrations/:id')
  @RequirePermission('pam.registros.manage')
  updateRegistration(
    @Param('id') id: string,
    @Body() body: UpdatePamRegistrationDto,
  ) {
    return this.service.updateRegistration(id, body);
  }

  @Post('registrations/:id/resend-welcome')
  @RequirePermission('pam.registros.manage')
  resendWelcome(@Param('id') id: string) {
    return this.service.resendWelcome(id);
  }
}
