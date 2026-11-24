import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  NewsletterKind,
  NewsletterScope,
  NewsletterStatus,
} from '@prisma/client';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import { InternalCommunicationsService } from './internal-communications.service';

const databaseUrl =
  process.env.INTERNAL_COMMS_TEST_DATABASE_URL ||
  process.env.MALICHIMP_TEST_DATABASE_URL;

test('IC create/duplicate keeps exclusive working copy after Newsletter fork model', {
  skip: databaseUrl ? false : 'INTERNAL_COMMS_TEST_DATABASE_URL / MALICHIMP_TEST_DATABASE_URL no configurada',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const previousEnabled = process.env.AWS_SES_ENABLED;
  process.env.AWS_SES_ENABLED = 'true';

  const prisma = new PrismaService();
  const config = new ConfigService();
  const emailSenders = new EmailSenderService(prisma);
  const newsletters = new NewslettersService(prisma, config);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const memberEmail = `ic-member-${suffix}@mali.pe`;
  const senderEmail = `ic-sender-${suffix}@mali.pe`;
  const googleAdmin = {
    listRecentlyActiveInternalUsers: async () => [
      {
        id: `member-${suffix}`,
        email: memberEmail,
        name: 'Miembro IC',
        orgUnitPath: '/Museo',
        lastActivityAt: new Date().toISOString(),
      },
    ],
  } as never;

  const service = new InternalCommunicationsService(
    prisma,
    googleAdmin,
    newsletters,
    emailSenders,
  );

  let userId = '';
  let newsletterId = '';
  let campaignId = '';
  let duplicatedCampaignId = '';
  let senderId = '';
  const workingIds: string[] = [];

  try {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        googleId: `ic-campaign-test-${suffix}`,
        email: `ic-campaign-test-${suffix}@mali.pe`,
        name: 'IC Campaign Test',
      },
    });
    userId = user.id;

    const sender = await emailSenders.create(
      senderEmail,
      NewsletterScope.internal_communications,
      user.id,
    );
    senderId = sender.id;

    const newsletter = await prisma.newsletter.create({
      data: {
        slug: `ic-campaign-test-${suffix}`,
        title: 'Boletín IC base',
        subject: 'Asunto IC',
        htmlBody: '<p>Contenido IC</p>',
        status: NewsletterStatus.draft,
        scope: NewsletterScope.internal_communications,
        kind: NewsletterKind.library,
        createdById: user.id,
      },
    });
    newsletterId = newsletter.id;

    const created = await service.createCampaign(user.id, {
      name: 'Campaña IC congelada',
      newsletterId: newsletter.id,
      subject: 'Asunto de campaña IC',
      fromName: 'MALI interno',
      fromEmail: senderEmail,
      replyTo: 'tecnologia@mali.pe',
      orgUnitPaths: ['/Museo'],
      activeDays: 30,
    });
    campaignId = created.id;

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: created.id },
      include: { workingNewsletter: true, sends: true },
    });
    assert.ok(campaign.workingNewsletterId);
    assert.equal(campaign.workingNewsletter?.scope, NewsletterScope.internal_communications);
    assert.equal(campaign.workingNewsletter?.kind, NewsletterKind.campaign_working_copy);
    assert.equal(campaign.htmlSnapshot, '<p>Contenido IC</p>');
    assert.equal(campaign.subjectSnapshot, 'Asunto de campaña IC');
    assert.equal(campaign.audienceArea, 'internal_workspace');
    assert.equal(campaign.sends.length, 1);
    assert.equal(campaign.sends[0]?.email, memberEmail);
    workingIds.push(campaign.workingNewsletterId!);

    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { htmlBody: '<p>Biblioteca editada</p>' },
    });

    const duplicated = await service.duplicateCampaign(user.id, created.id);
    duplicatedCampaignId = duplicated.id;
    assert.equal(duplicated.status, 'draft');
    assert.ok(duplicated.workingNewsletterId);
    assert.equal(duplicated.previewHtml, '<p>Contenido IC</p>');

    const dupRow = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: duplicated.id },
      include: { workingNewsletter: true, sends: true },
    });
    assert.ok(dupRow.workingNewsletterId);
    assert.notEqual(dupRow.workingNewsletterId, campaign.workingNewsletterId);
    assert.equal(dupRow.workingNewsletter?.scope, NewsletterScope.internal_communications);
    assert.equal(dupRow.workingNewsletter?.kind, NewsletterKind.campaign_working_copy);
    assert.equal(dupRow.htmlSnapshot, '<p>Contenido IC</p>');
    assert.equal(dupRow.sends.length, 0);
    workingIds.push(dupRow.workingNewsletterId!);

    const publicHit = await prisma.newsletter.findFirst({
      where: {
        id: dupRow.workingNewsletterId!,
        scope: NewsletterScope.shared,
        kind: NewsletterKind.library,
        status: NewsletterStatus.published,
      },
    });
    assert.equal(publicHit, null);
  } finally {
    if (duplicatedCampaignId) {
      await prisma.emailCampaign.deleteMany({ where: { id: duplicatedCampaignId } });
    }
    if (campaignId) {
      await prisma.emailCampaign.deleteMany({ where: { id: campaignId } });
    }
    if (workingIds.length) {
      await prisma.newsletter.deleteMany({ where: { id: { in: workingIds } } });
    }
    if (senderId) await prisma.emailSender.deleteMany({ where: { id: senderId } });
    if (newsletterId) await prisma.newsletter.deleteMany({ where: { id: newsletterId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    if (previousEnabled === undefined) delete process.env.AWS_SES_ENABLED;
    else process.env.AWS_SES_ENABLED = previousEnabled;
  }
});
