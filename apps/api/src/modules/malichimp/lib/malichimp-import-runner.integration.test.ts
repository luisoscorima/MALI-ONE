import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  applyMalichimpFiles,
  inspectMalichimpFiles,
  locateMalichimpFiles,
} from './malichimp-import-runner';
import { IMPORT_FILES } from './malichimp-import';

const databaseUrl = process.env.MALICHIMP_TEST_DATABASE_URL;

test('preserva supresiones de SES y revierte todos los lotes si falla una importación', {
  skip: databaseUrl ? false : 'MALICHIMP_TEST_DATABASE_URL no configurada',
}, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const directory = await mkdtemp(path.join(tmpdir(), 'malichimp-test-'));
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sesEmail = `ses-${suffix}@example.com`;
  const rollbackEmail = `rollback-${suffix}@example.com`;
  const sourceKey = `integration-${suffix}`;

  try {
    await prisma.$connect();
    for (const { prefix, status } of IMPORT_FILES) {
      const email = status === 'unsubscribed' ? sesEmail
        : status === 'subscribed' ? rollbackEmail : '';
      await writeFile(path.join(directory, `${prefix}test.csv`),
        `Email Address\n${email ? `${email}\n` : ''}`);
    }
    const files = await locateMalichimpFiles(directory);
    const report = await inspectMalichimpFiles(files);
    await prisma.malichimpSuppression.create({
      data: { email: sesEmail, reason: 'ses_bounce', source: 'aws_ses_event' },
    });

    await assert.rejects(applyMalichimpFiles(prisma, files, report, {
      sourceKey,
      sourceDirectory: directory,
      onProgress: () => { throw new Error('simulated failure'); },
    }), /simulated failure/);
    assert.equal(await prisma.malichimpContact.count({
      where: { email: { in: [sesEmail, rollbackEmail] } },
    }), 0);
    assert.equal((await prisma.malichimpSuppression.findUniqueOrThrow({
      where: { email: sesEmail },
    })).reason, 'ses_bounce');

    await applyMalichimpFiles(prisma, files, report, { sourceKey, sourceDirectory: directory });
    assert.equal((await prisma.malichimpSuppression.findUniqueOrThrow({
      where: { email: sesEmail },
    })).source, 'aws_ses_event');
  } finally {
    await prisma.malichimpContact.deleteMany({
      where: { email: { in: [sesEmail, rollbackEmail] } },
    });
    await prisma.malichimpSuppression.deleteMany({ where: { email: sesEmail } });
    await prisma.malichimpImportRun.deleteMany({ where: { sourceKey } });
    await prisma.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
