import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { AppModule } from '@prisma/client';
import { Request } from 'express';
import { Public } from '../../../core/guards/public.decorator';
import { RequireModule } from '../../../core/guards/module.decorator';
import { PamWidgetsService } from './pam-widgets.service';
import {
  CreatePamPlanDto,
  CreatePamRegistrationDto,
  UpdatePamPlanDto,
  UpdatePamSettingsDto,
} from '../dto/pam.dto';

@Controller('widgets/pam')
export class PamWidgetsController {
  constructor(private readonly service: PamWidgetsService) {}

  @Public()
  @Get('config')
  getPublicConfig() {
    return this.service.getPublicConfig();
  }

  @Public()
  @Post('registrations')
  createRegistration(@Req() req: Request, @Body() body: CreatePamRegistrationDto) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.ip ??
      'unknown';
    return this.service.createRegistration(body, ip);
  }

  @Public()
  @Post('webhooks/mercadopago')
  mercadoPagoWebhook(@Body() body: Record<string, unknown>) {
    return this.service.handleMercadoPagoWebhook(body);
  }

  @Get('admin')
  @RequireModule(AppModule.widget_pam)
  getAdmin() {
    return this.service.getAdminState();
  }

  @Get('registrations')
  @RequireModule(AppModule.widget_pam)
  listRegistrations() {
    return this.service.listRegistrations();
  }

  @Put('settings')
  @RequireModule(AppModule.widget_pam)
  updateSettings(@Body() body: UpdatePamSettingsDto) {
    return this.service.updateSettings(body);
  }

  @Post('plans')
  @RequireModule(AppModule.widget_pam)
  createPlan(@Body() body: CreatePamPlanDto) {
    return this.service.createPlan(body);
  }

  @Patch('plans/:id')
  @RequireModule(AppModule.widget_pam)
  updatePlan(@Param('id') id: string, @Body() body: UpdatePamPlanDto) {
    return this.service.updatePlan(id, body);
  }

  @Delete('plans/:id')
  @RequireModule(AppModule.widget_pam)
  deletePlan(@Param('id') id: string) {
    return this.service.deletePlan(id);
  }
}
