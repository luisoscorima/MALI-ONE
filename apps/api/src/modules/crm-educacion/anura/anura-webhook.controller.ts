import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../../../core/guards/public.decorator';
import { AnuraIngestService } from './anura-ingest.service';

/**
 * Receptor de webhooks Anura (panel → ONE).
 * No usa ANURA_REFRESH_TOKEN: Anura empuja el JSON.
 * Auth: Bearer = ANURA_WEBHOOK_SECRET (configurado en la plantilla del panel).
 */
@Controller('crm-educacion/webhooks')
export class AnuraWebhookController {
  constructor(private readonly anuraIngest: AnuraIngestService) {}

  private assertWebhookSecret(authorization?: string): void {
    const expected = String(process.env.ANURA_WEBHOOK_SECRET ?? '').trim();
    if (!expected) {
      throw new UnauthorizedException('ANURA_WEBHOOK_SECRET no configurado');
    }
    const bearer = String(authorization ?? '').trim();
    const token = bearer.toLowerCase().startsWith('bearer ')
      ? bearer.slice(7).trim()
      : bearer;
    if (!token || token !== expected) {
      throw new UnauthorizedException('Webhook Anura no autorizado');
    }
  }

  @Public()
  @Post('anura')
  receive(
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertWebhookSecret(authorization);
    const payload = body && typeof body === 'object' ? body : {};
    return this.anuraIngest.ingestWebhook(payload);
  }
}
