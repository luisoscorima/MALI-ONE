import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../core/guards/public.decorator';
import { AnuraIngestService } from './anura-ingest.service';

/**
 * Receptor de webhooks Anura (panel → ONE).
 * Auth (cualquiera de las dos, misma ANURA_WEBHOOK_SECRET):
 * - Bearer (Authorization)
 * - X-Hub-Signature HMAC SHA1 (panel Anura suele fijarse en esto)
 */
@Controller('crm-educacion/webhooks')
export class AnuraWebhookController {
  constructor(private readonly anuraIngest: AnuraIngestService) {}

  private secret(): string {
    const expected = String(process.env.ANURA_WEBHOOK_SECRET ?? '').trim();
    if (!expected) {
      throw new UnauthorizedException('ANURA_WEBHOOK_SECRET no configurado');
    }
    return expected;
  }

  private assertBearer(authorization: string | undefined, expected: string): boolean {
    const bearer = String(authorization ?? '').trim();
    const token = bearer.toLowerCase().startsWith('bearer ')
      ? bearer.slice(7).trim()
      : '';
    if (!token) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private assertHubSignature(
    signatureHeader: string | undefined,
    rawBody: Buffer | undefined,
    expectedSecret: string,
  ): boolean {
    const header = String(signatureHeader ?? '').trim();
    if (!header || !rawBody?.length) return false;
    const provided = header.toLowerCase().startsWith('sha1=')
      ? header.slice(5).trim()
      : header;
    const digest = createHmac('sha1', expectedSecret).update(rawBody).digest('hex');
    try {
      const a = Buffer.from(provided, 'hex');
      const b = Buffer.from(digest, 'hex');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private assertAuthorized(
    req: RawBodyRequest<Request>,
    authorization?: string,
    xHubSignature?: string,
  ): void {
    const expected = this.secret();
    if (this.assertBearer(authorization, expected)) return;
    if (this.assertHubSignature(xHubSignature, req.rawBody, expected)) return;
    throw new UnauthorizedException('Webhook Anura no autorizado');
  }

  @Public()
  @Post('anura')
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers('authorization') authorization?: string,
    @Headers('x-hub-signature') xHubSignature?: string,
  ) {
    this.assertAuthorized(req, authorization, xHubSignature);
    const payload = body && typeof body === 'object' ? body : {};
    return this.anuraIngest.ingestWebhook(payload);
  }
}
