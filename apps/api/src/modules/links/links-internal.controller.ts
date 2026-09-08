import {
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../core/guards/public.decorator';
import { LinksService } from './links.service';

/**
 * Endpoints internos para mali-whatsapp (catálogo + backfill de ref).
 * Auth: header `x-links-service-token` o Bearer = LINKS_CATALOG_SERVICE_TOKEN.
 */
@Controller('links/internal')
export class LinksInternalController {
  constructor(
    private readonly links: LinksService,
    private readonly config: ConfigService,
  ) {}

  private assertServiceToken(
    headerToken?: string,
    authorization?: string,
  ): void {
    const expected = String(
      this.config.get('LINKS_CATALOG_SERVICE_TOKEN') ?? '',
    ).trim();
    if (!expected) {
      throw new UnauthorizedException(
        'LINKS_CATALOG_SERVICE_TOKEN no configurado',
      );
    }
    const bearer = String(authorization ?? '')
      .trim()
      .toLowerCase()
      .startsWith('bearer ')
      ? String(authorization).trim().slice(7).trim()
      : '';
    const provided = String(headerToken ?? '').trim() || bearer;
    if (provided !== expected) {
      throw new UnauthorizedException('Token de servicio inválido');
    }
  }

  @Public()
  @Get('whatsapp-catalog')
  whatsappCatalog(
    @Headers('x-links-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    return this.links.listWhatsappCatalog();
  }

  @Public()
  @Post('backfill-whatsapp-refs')
  backfillWhatsappRefs(
    @Headers('x-links-service-token') headerToken?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.assertServiceToken(headerToken, authorization);
    return this.links.backfillWhatsappRefs();
  }
}
