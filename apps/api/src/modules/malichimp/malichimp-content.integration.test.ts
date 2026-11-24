import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  NewsletterBrand,
  NewsletterKind,
  NewsletterScope,
  NewsletterStatus,
} from '@prisma/client';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { contentRevisionOf } from '../newsletters/newsletter-working-copy';
import { NewslettersService } from '../newsletters/newsletters.service';
import { MalichimpService } from './malichimp.service';

const databaseUrl = process.env.MALICHIMP_TEST_DATABASE_URL;

test('MALICHIMP library CRUD keeps brand and stays isolated from shared', {
  skip: databaseUrl ? false : 'MALICHIMP_TEST_DATABASE_URL no configurada',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaService();
  const config = new ConfigService();
  const delivery = new EmailDeliveryService(config);
  const emailSenders = new EmailSenderService(prisma);
  const newsletters = new NewslettersService(prisma, config);
  const googleAdmin = {
    listRecentlyActiveInternalUsers: async () => [],
  } as never;
  const emailTracking = {
    inject: (html: string) => html,
    publicUrl: (path: string) => path,
  } as never;
  const service = new MalichimpService(
    prisma,
    delivery,
    emailSenders,
    newsletters,
    googleAdmin,
    emailTracking,
  );

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId = '';
  let contentId = '';
  let duplicatedId = '';
  let sharedId = '';

  try {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        googleId: `malichimp-content-${suffix}`,
        email: `malichimp-content-${suffix}@mali.pe`,
        name: 'Content Test',
      },
    });
    userId = user.id;

    const shared = await prisma.newsletter.create({
      data: {
        slug: `shared-lib-${suffix}`,
        title: 'Shared published',
        subject: 'Shared',
        htmlBody: '<p>Shared</p>',
        status: NewsletterStatus.published,
        scope: NewsletterScope.shared,
        kind: NewsletterKind.library,
        brand: NewsletterBrand.museo,
        createdById: user.id,
      },
    });
    sharedId = shared.id;

    const created = await service.createLibraryContent(user.id, {
      title: 'Pieza MALICHIMP',
      subject: 'Asunto MALICHIMP',
      htmlBody: '<p>Hola</p>',
      brand: 'cursos_arte',
    });
    contentId = created.id;
    assert.equal(created.scope, NewsletterScope.malichimp);
    assert.equal(created.kind, NewsletterKind.library);
    assert.equal(created.brand, NewsletterBrand.cursos_arte);

    const listed = await service.listLibraryContent();
    assert.ok(listed.some((row) => row.id === contentId));
    assert.ok(!listed.some((row) => row.id === sharedId));
    const listedRow = listed.find((row) => row.id === contentId);
    assert.equal(listedRow?.brand, NewsletterBrand.cursos_arte);

    const loaded = await service.getContent(contentId);
    assert.equal(loaded.brand, NewsletterBrand.cursos_arte);
    const token = contentRevisionOf(loaded);

    const updated = await service.updateContent(contentId, {
      brand: 'extension_profesional',
      subject: 'Asunto editado',
      contentRevision: token,
    });
    assert.equal(updated.brand, NewsletterBrand.extension_profesional);
    assert.equal(updated.subject, 'Asunto editado');
    assert.ok(updated.contentRevisionToken);
    assert.notEqual(updated.contentRevisionToken, token);

    await assert.rejects(
      () =>
        service.updateContent(contentId, {
          title: 'Conflicto',
          contentRevision: token,
        }),
      (error: unknown) => {
        if (!error || typeof error !== 'object') return false;
        const status =
          typeof (error as { getStatus?: () => number }).getStatus === 'function'
            ? (error as { getStatus: () => number }).getStatus()
            : (error as { status?: number }).status;
        return status === 409;
      },
    );

    const duplicated = await service.duplicateLibraryContent(user.id, contentId);
    duplicatedId = duplicated.id;
    assert.equal(duplicated.brand, NewsletterBrand.extension_profesional);
    assert.equal(duplicated.scope, NewsletterScope.malichimp);
    assert.equal(duplicated.kind, NewsletterKind.library);
    assert.match(duplicated.title, /copia/i);

    const bases = await service.listPublishedNewsletters();
    assert.ok(bases.some((row) => row.id === contentId));
    assert.equal(bases.some((row) => row.id === sharedId), false);
    assert.ok(bases.every((row) => row.scope === NewsletterScope.malichimp));
    const baseIds = new Set(bases.map((row) => row.id));
    const working = await prisma.newsletter.findFirst({
      where: {
        scope: NewsletterScope.malichimp,
        kind: NewsletterKind.campaign_working_copy,
      },
      select: { id: true },
    });
    if (working) assert.equal(baseIds.has(working.id), false);
  } finally {
    if (duplicatedId) {
      await prisma.newsletter.deleteMany({ where: { id: duplicatedId } });
    }
    if (contentId) {
      await prisma.newsletter.deleteMany({ where: { id: contentId } });
    }
    if (sharedId) {
      await prisma.newsletter.deleteMany({ where: { id: sharedId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test('campaign create forks from MALICHIMP library brand', {
  skip: databaseUrl ? false : 'MALICHIMP_TEST_DATABASE_URL no configurada',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const previousEnabled = process.env.AWS_SES_ENABLED;
  process.env.AWS_SES_ENABLED = 'true';

  const prisma = new PrismaService();
  const config = new ConfigService();
  const delivery = new EmailDeliveryService(config);
  const emailSenders = new EmailSenderService(prisma);
  const newsletters = new NewslettersService(prisma, config);
  const googleAdmin = {
    listRecentlyActiveInternalUsers: async () => [],
  } as never;
  const emailTracking = {
    inject: (html: string) => html,
    publicUrl: (path: string) => path,
  } as never;
  const service = new MalichimpService(
    prisma,
    delivery,
    emailSenders,
    newsletters,
    googleAdmin,
    emailTracking,
  );

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `eligible-${suffix}@example.com`;
  const senderEmail = `sender-${suffix}@mali.pe`;
  let userId = '';
  let contentId = '';
  let campaignId = '';
  let workingId = '';
  let groupId = '';
  let senderId = '';

  try {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        googleId: `malichimp-fork-${suffix}`,
        email: `malichimp-fork-${suffix}@mali.pe`,
        name: 'Fork Test',
      },
    });
    userId = user.id;
    const sender = await emailSenders.create(
      senderEmail,
      NewsletterScope.malichimp,
      user.id,
    );
    senderId = sender.id;

    const content = await service.createLibraryContent(user.id, {
      title: 'Base con marca',
      subject: 'Asunto base',
      htmlBody: '<p>Base</p>',
      brand: 'museo',
    });
    contentId = content.id;

    const group = await prisma.malichimpGroup.create({
      data: { name: `G ${suffix}`, normalizedName: `g-${suffix}` },
    });
    groupId = group.id;
    const option = await prisma.malichimpGroupOption.create({
      data: {
        groupId: group.id,
        name: `O ${suffix}`,
        normalizedName: `o-${suffix}`,
      },
    });
    const contact = await prisma.malichimpContact.create({
      data: { email, firstName: 'A', status: 'subscribed' },
    });
    await prisma.malichimpContactGroupOption.create({
      data: { contactId: contact.id, optionId: option.id },
    });

    const created = await service.createCampaign(user.id, {
      name: 'Campaña desde MALICHIMP',
      newsletterId: content.id,
      subject: 'Asunto campaña',
      fromName: 'MALI',
      fromEmail: senderEmail,
      replyTo: senderEmail,
      groupOptionIds: [option.id],
    });
    campaignId = created.id;

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: created.id },
      include: { workingNewsletter: true },
    });
    assert.equal(campaign.newsletterId, content.id);
    assert.ok(campaign.workingNewsletterId);
    workingId = campaign.workingNewsletterId!;
    assert.equal(campaign.workingNewsletter?.scope, NewsletterScope.malichimp);
    assert.equal(
      campaign.workingNewsletter?.kind,
      NewsletterKind.campaign_working_copy,
    );
    assert.equal(campaign.workingNewsletter?.brand, NewsletterBrand.museo);
    assert.equal(campaign.brandSnapshot, NewsletterBrand.museo);
    assert.equal(campaign.htmlSnapshot, '<p>Base</p>');
  } finally {
    if (campaignId) {
      await prisma.emailCampaign.deleteMany({ where: { id: campaignId } });
    }
    if (workingId) {
      await prisma.newsletter.deleteMany({ where: { id: workingId } });
    }
    if (contentId) {
      await prisma.newsletter.deleteMany({ where: { id: contentId } });
    }
    if (senderId) await prisma.emailSender.deleteMany({ where: { id: senderId } });
    await prisma.malichimpContact.deleteMany({ where: { email } });
    if (groupId) await prisma.malichimpGroup.deleteMany({ where: { id: groupId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    if (previousEnabled === undefined) delete process.env.AWS_SES_ENABLED;
    else process.env.AWS_SES_ENABLED = previousEnabled;
  }
});
