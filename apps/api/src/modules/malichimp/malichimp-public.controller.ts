import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../core/guards/public.decorator';
import { MalichimpService } from './malichimp.service';

@Controller('mail/unsubscribe')
export class MalichimpPublicController {
  constructor(private readonly malichimp: MalichimpService) {}

  @Public()
  @Get(':token')
  async confirm(@Param('token') token: string, @Res() response: Response) {
    await this.malichimp.assertUnsubscribeToken(token);
    response.status(200).type('html').send(page(`
      <h1>Cancelar suscripción</h1>
      <p>Confirma que ya no deseas recibir campañas enviadas desde la audiencia MALICHIMP.</p>
      <form method="post" action="/mail/unsubscribe/${escapeAttribute(token)}">
        <button type="submit">Confirmar baja</button>
      </form>
    `, 'Cancelar suscripción'));
  }

  @Public()
  @Post(':token')
  async unsubscribe(@Param('token') token: string, @Res() response: Response) {
    await this.malichimp.unsubscribe(token);
    response.status(200).type('html').send(page(`
      <h1>Suscripción cancelada</h1>
      <p>No volverás a recibir campañas enviadas desde la audiencia MALICHIMP.</p>
    `, 'Suscripción cancelada'));
  }
}

function page(content: string, title: string): string {
  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${title} · MALI</title>
        <style>
          body{margin:0;background:#f4f4f5;color:#18181b;font-family:Arial,sans-serif}
          main{max-width:560px;margin:64px auto;padding:32px;border-radius:12px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center}
          h1{margin:0 0 12px;font-size:24px}p{margin:0;color:#52525b;line-height:1.6}
          form{margin-top:24px}button{min-height:44px;padding:10px 18px;border:0;border-radius:8px;background:#18181b;color:#fff;font-size:16px;font-weight:600;cursor:pointer}
          button:focus-visible{outline:3px solid #2563eb;outline-offset:3px}
        </style>
      </head>
      <body><main>${content}</main></body>
    </html>`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
