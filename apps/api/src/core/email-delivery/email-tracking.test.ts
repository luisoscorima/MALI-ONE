import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTrackingService } from './email-tracking.service';

test('injects shared click/open tracking and an audience-owned unsubscribe link', () => {
  const service = new EmailTrackingService(
    {} as PrismaService,
    { get: () => 'https://mali.example' } as unknown as ConfigService,
  );
  const html = service.inject(
    '<html><body><a href="https://mali.pe/agenda">Agenda</a></body></html>',
    'send-token',
    'https://mali.example/mail/unsubscribe/send-token',
  );

  assert.match(
    html,
    /https:\/\/mali\.example\/mail\/c\/send-token\?u=https%3A%2F%2Fmali\.pe%2Fagenda/,
  );
  assert.match(html, /https:\/\/mali\.example\/mail\/o\/send-token\.gif/);
  assert.match(html, /https:\/\/mali\.example\/mail\/unsubscribe\/send-token/);
});
