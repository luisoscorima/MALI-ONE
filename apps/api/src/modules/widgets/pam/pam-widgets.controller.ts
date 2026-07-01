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
import { Request } from 'express';
import { Public } from '../../../core/guards/public.decorator';
import { PamWidgetsService } from './pam-widgets.service';
import { CreatePamRegistrationDto } from '../dto/pam.dto';

/** Endpoints públicos del embed PAM (mali.pe/es). La administración vive en /pam/*. */
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
}
