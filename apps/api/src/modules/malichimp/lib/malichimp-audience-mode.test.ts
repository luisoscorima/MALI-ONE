import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MALICHIMP_RESOLVE_EMAILS_MAX } from '@mali-one/shared';
import { MalichimpService } from '../malichimp.service';
import {
  MALICHIMP_AUDIENCE_MODE,
  resolveMalichimpAudienceMode,
} from './malichimp-audience-mode';

test('resolveMalichimpAudienceMode defaults legacy null/undefined to groups', () => {
  assert.equal(resolveMalichimpAudienceMode(null), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode(undefined), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode(''), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode('weird'), MALICHIMP_AUDIENCE_MODE.groups);
});

test('resolveMalichimpAudienceMode accepts groups tags emails', () => {
  assert.equal(resolveMalichimpAudienceMode('groups'), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode('tags'), MALICHIMP_AUDIENCE_MODE.tags);
  assert.equal(resolveMalichimpAudienceMode('emails'), MALICHIMP_AUDIENCE_MODE.emails);
});

test('resolveEmails rechaza más de 10000 únicos sin consultar la base', async () => {
  const prisma = {
    malichimpContact: {
      findMany: async () => {
        throw new Error('no debería consultar contactos');
      },
    },
    $queryRaw: async () => {
      throw new Error('no debería consultar suppressions');
    },
  };
  const service = new MalichimpService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const emails = Array.from(
    { length: MALICHIMP_RESOLVE_EMAILS_MAX + 1 },
    (_, index) => `limit-${index}@example.com`,
  );
  await assert.rejects(
    () => service.resolveEmails(emails),
    (err: unknown) => err instanceof BadRequestException,
  );
});

test('un correo suprimido sin ficha no se ofrece para importar', async () => {
  const blockedEmail = 'suprimido@example.test';
  const missingEmail = 'faltante@example.test';
  const service = new MalichimpService(
    {
      malichimpContact: { findMany: async () => [] },
      $queryRaw: async () => [{ email: blockedEmail }],
    } as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  const result = await service.resolveEmails([blockedEmail, missingEmail]);
  assert.deepEqual(result.blocked, [{ email: blockedEmail, reason: 'suppressed' }]);
  assert.deepEqual(result.notFound, [missingEmail]);
});

test('rechaza una audiencia cambiada aunque conserve el total revisado', async () => {
  let contact = { id: 'contact-1', email: 'uno@example.test', firstName: null, lastName: null };
  const service = new MalichimpService(
    {
      $queryRaw: async () => [contact],
      $transaction: async () => assert.fail('No debe escribir una campaña con audiencia distinta'),
    } as never,
    { status: { configured: true } } as never,
    { assertEnabled: async () => undefined } as never,
    {} as never, {} as never, {} as never,
  );
  const filters = { audienceMode: 'emails' as const, includeContactIds: [contact.id] };
  const reviewed = await service.reviewAudience(filters);
  assert.equal(reviewed.totalRecipients, 1);
  contact = { ...contact, email: 'dos@example.test' };
  await assert.rejects(
    service.createCampaign('operator', {
      ...filters,
      name: 'Campaña',
      subject: 'Asunto',
      newsletterId: 'base',
      fromName: 'MALI',
      fromEmail: 'boletines@mali.pe',
      replyTo: 'boletines@mali.pe',
      audienceRevision: reviewed.audienceRevision,
    }),
    (error: unknown) => error instanceof ConflictException
      && (error.getResponse() as { code: string }).code === 'MALICHIMP_AUDIENCE_CHANGED',
  );
});
