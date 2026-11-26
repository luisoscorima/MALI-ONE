import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailTrackingService } from './email-tracking.service';

function trackingService(prisma: PrismaService = {} as PrismaService) {
  return new EmailTrackingService(
    prisma,
    { get: () => 'https://mali.example' } as unknown as ConfigService,
  );
}

test('injects shared click/open tracking and an audience-owned unsubscribe link', () => {
  const html = trackingService().inject(
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

test('places the open pixel before the content so clipped messages still track opens', () => {
  const html = trackingService().inject(
    '<html><body><p>Contenido</p></body></html>',
    'send-token',
    undefined,
    'https://mali.example/mail/view/send-token',
  );
  assert.match(
    html,
    /<body>\s*<div data-mali-view-in-browser[\s\S]*?<\/div><img src="https:\/\/mali\.example\/mail\/o\/send-token\.gif"[^>]*><p>Contenido/,
  );
});

test('a click marks a sent message as opened when the pixel never loaded', async () => {
  const updates: Array<Record<string, unknown>> = [];
  const campaignUpdates: Array<Record<string, unknown>> = [];
  const tx = {
    emailEvent: { create: async () => ({}) },
    emailSend: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { count: 1 };
      },
    },
    emailCampaign: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        campaignUpdates.push(data);
        return {};
      },
    },
  };
  const prisma = {
    emailSend: {
      findUnique: async () => ({ id: 's1', campaignId: 'c1', status: 'sent' }),
    },
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  } as unknown as PrismaService;

  await trackingService(prisma).recordClick('tok', 'https://mali.pe/x');

  assert.ok(updates.some((data) => 'clickedAt' in data));
  assert.ok(updates.some((data) => 'openedAt' in data));
  assert.deepEqual(campaignUpdates, [
    { clickCount: { increment: 1 } },
    { openCount: { increment: 1 } },
  ]);
});

test('preserves the exact query and fragment of tracked HTML button URLs', () => {
  const html = trackingService().inject(
    '<a href="https://mali.pe/agenda?utm_source=email&amp;utm_campaign=arte&#38;id=2&#x26;v=a%26b#entradas">Entradas</a>',
    'send-token',
  );
  const href = html.match(/href="([^"]+)"/)?.[1];
  assert.ok(href);
  assert.equal(new URL(href).searchParams.get('u'),
    'https://mali.pe/agenda?utm_source=email&utm_campaign=arte&id=2&v=a%26b#entradas');
});

test('injects standard view-in-browser block when URL is provided', () => {
  const html = trackingService().inject(
    '<html><body><p>Contenido</p></body></html>',
    'send-token',
    undefined,
    'https://mali.example/mail/view/send-token',
  );

  assert.match(html, /data-mali-view-in-browser/);
  assert.match(
    html,
    /font:12px\/1\.5 Arial,sans-serif;color:#6b7280/,
  );
  assert.match(
    html,
    /href="https:\/\/mali\.example\/mail\/view\/send-token"/,
  );
  assert.match(html, /Ver este correo en el navegador/);
  // Direct public URL (not click-tracked).
  assert.doesNotMatch(
    html,
    /mail\/c\/send-token\?u=.*mail%2Fview/,
  );
  // Inserted inside body, before content.
  assert.match(
    html,
    /<body[^>]*>\s*<div data-mali-view-in-browser[\s\S]*Contenido/,
  );
});

test('does not inject view-in-browser when URL is omitted', () => {
  const html = trackingService().inject(
    '<html><body><p>Contenido</p></body></html>',
    'send-token',
  );
  assert.doesNotMatch(html, /data-mali-view-in-browser/);
  assert.doesNotMatch(html, /Ver este correo en el navegador/);
});

test('replaces historical view-in-browser with canonical /mail/view token', () => {
  const html = trackingService().inject(
    '<html><body><div data-mali-view-in-browser><a href="https://old">Ver este correo en el navegador</a></div><p>X</p></body></html>',
    'send-token',
    undefined,
    'https://mali.example/mail/view/nuevo',
  );
  const matches = html.match(/data-mali-view-in-browser/gi) ?? [];
  assert.equal(matches.length, 1);
  assert.match(html, /mali\.example\/mail\/view\/nuevo/);
  assert.doesNotMatch(html, /https:\/\/old/);
});

test('scrubs legacy /n/:slug view links and span-wrapped labels before inject', () => {
  const html = trackingService().inject(
    [
      '<html><body>',
      '<p><a href="https://mali.pe/n/boletin-viejo"><span>Ver este correo en el navegador</span></a></p>',
      '<p>Contenido histórico</p>',
      '</body></html>',
    ].join(''),
    'hist-token',
    undefined,
    'https://mali.example/mail/view/hist-token',
  );
  assert.match(html, /mail\/view\/hist-token/);
  assert.doesNotMatch(html, /\/n\/boletin-viejo/);
  assert.equal((html.match(/Ver este correo en el navegador/gi) ?? []).length, 1);
});

test('browser mode keeps unsubscribe and personalization chrome without tracking', () => {
  const html = trackingService().composeHtml(
    '<html><body><a href="https://mali.pe/agenda">Agenda</a><p>Hola {{first_name}}</p></body></html>',
    {
      openToken: 'send-token',
      unsubscribeUrl: 'https://mali.example/mail/unsubscribe/send-token',
      viewInBrowserUrl: 'https://mali.example/mail/view/send-token',
      mode: 'browser',
    },
  );

  assert.match(html, /https:\/\/mali\.pe\/agenda/);
  assert.doesNotMatch(html, /mail\/c\//);
  assert.doesNotMatch(html, /mail\/o\//);
  assert.doesNotMatch(html, /data-mali-view-in-browser/);
  assert.doesNotMatch(html, /Ver este correo en el navegador/);
  assert.match(html, /mail\/unsubscribe\/send-token/);
});

test('browser mode strips a leftover view-in-browser block from the snapshot', () => {
  const html = trackingService().composeHtml(
    '<html><body><div data-mali-view-in-browser><a href="https://x">Ver este correo en el navegador</a></div><p>Hola</p></body></html>',
    { openToken: 'tok', mode: 'browser' },
  );
  assert.doesNotMatch(html, /data-mali-view-in-browser/);
  assert.doesNotMatch(html, /Ver este correo en el navegador/);
  assert.match(html, /Hola/);
});

test('renderBrowserView serves snapshot with merge tags and requires sentAt', async () => {
  const prisma = {
    emailSend: {
      findUnique: async ({ where }: { where: { openToken: string } }) => {
        if (where.openToken === 'missing') return null;
        if (where.openToken === 'pending') {
          return {
            openToken: 'pending',
            sentAt: null,
            name: 'Ana Pérez',
            campaign: {
              htmlSnapshot: '<html><body><p>Hola {{first_name}}</p></body></html>',
              unsubscribePath: 'mail/unsubscribe',
            },
          };
        }
        return {
          openToken: 'sent-tok',
          sentAt: new Date('2026-01-01T00:00:00Z'),
          name: 'Ana Pérez',
          campaign: {
            htmlSnapshot:
              '<html><body><a href="https://mali.pe/x">X</a><p>Hola {{first_name}}</p></body></html>',
            unsubscribePath: 'mail/unsubscribe',
          },
        };
      },
    },
  } as unknown as PrismaService;

  const service = trackingService(prisma);

  await assert.rejects(
    () => service.renderBrowserView('missing'),
    (error: unknown) => error instanceof NotFoundException,
  );
  await assert.rejects(
    () => service.renderBrowserView('pending'),
    (error: unknown) => error instanceof NotFoundException,
  );

  const html = await service.renderBrowserView('sent-tok');
  assert.match(html, /Hola Ana/);
  assert.match(html, /https:\/\/mali\.pe\/x/);
  assert.doesNotMatch(html, /mail\/c\//);
  assert.doesNotMatch(html, /mail\/o\//);
  assert.doesNotMatch(html, /data-mali-view-in-browser/);
  assert.match(html, /mail\/unsubscribe\/sent-tok/);
});
