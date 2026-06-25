import { Controller, Get } from '@nestjs/common';
import { Public } from './core/guards/public.decorator';
import { GoogleAdminService } from './modules/google-admin/google-admin.service';

@Controller('health')
export class HealthController {
  constructor(private readonly googleAdmin: GoogleAdminService) {}

  @Public()
  @Get()
  health() {
    return { status: 'ok', service: 'mali-one-api' };
  }

  @Public()
  @Get('google-admin')
  async googleAdminHealth() {
    return this.googleAdmin.healthCheck();
  }
}
