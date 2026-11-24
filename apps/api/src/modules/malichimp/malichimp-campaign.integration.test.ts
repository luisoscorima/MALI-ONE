import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { NewsletterStatus } from '@prisma/client';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import { MalichimpService } from './malichimp.service';

const databaseUrl = process.env.MALICHIMP_TEST_DATABASE_URL;

test('crea una campaña desde MALICHIMP con audiencia y contenido congelados', {
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
  const emails = [
    `eligible-${suffix}@example.com`,
    `second-${suffix}@example.com`,
    `domain-${suffix}@example.com`,
    `global-${suffix}@example.com`,
  ];
  let userId = '';
  let newsletterId = '';
  let campaignId = '';
  let duplicatedCampaignId = '';
  let duplicatedNewsletterId = '';
  let groupId = '';
  let senderId = '';
  const senderEmail = `sender-${suffix}@mali.pe`;

  try {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        googleId: `campaign-test-${suffix}`,
        email: `campaign-test-${suffix}@mali.pe`,
        name: 'Campaign Test',
      },
    });
    userId = user.id;
    const sender = await emailSenders.create(senderEmail);
    senderId = sender.id;
    const newsletter = await prisma.newsletter.create({
      data: {
        slug: `campaign-test-${suffix}`,
        title: 'Contenido original',
        subject: 'Asunto original',
        htmlBody: '<p>Contenido original</p>',
        status: NewsletterStatus.published,
        createdById: user.id,
      },
    });
    newsletterId = newsletter.id;
    const group = await prisma.malichimpGroup.create({
      data: { name: `Grupo ${suffix}`, normalizedName: `grupo-${suffix}` },
    });
    groupId = group.id;
    const option = await prisma.malichimpGroupOption.create({
      data: {
        groupId: group.id,
        name: `Opción ${suffix}`,
        normalizedName: `opcion-${suffix}`,
      },
    });
    const secondOption = await prisma.malichimpGroupOption.create({
      data: {
        groupId: group.id,
        name: `Segunda opción ${suffix}`,
        normalizedName: `segunda-opcion-${suffix}`,
      },
    });
    const exclusionOption = await prisma.malichimpGroupOption.create({
      data: {
        groupId: group.id,
        name: `Exclusión ${suffix}`,
        normalizedName: `exclusion-${suffix}`,
      },
    });
    const contacts = await Promise.all(emails.map((email) =>
      prisma.malichimpContact.create({
        data: { email, firstName: 'Persona', status: 'subscribed' },
      })));
    await prisma.malichimpContactGroupOption.createMany({
      data: [
        { contactId: contacts[0].id, optionId: option.id },
        { contactId: contacts[2].id, optionId: option.id },
        { contactId: contacts[3].id, optionId: option.id },
        { contactId: contacts[0].id, optionId: secondOption.id },
        { contactId: contacts[1].id, optionId: secondOption.id },
        { contactId: contacts[1].id, optionId: exclusionOption.id },
      ],
    });
    await prisma.malichimpSuppression.create({
      data: { email: emails[2], reason: 'manual', source: 'test' },
    });
    await prisma.emailGlobalSuppression.create({
      data: { email: emails[3], reason: 'bounce', source: 'test' },
    });

    const groupSummary = (await service.listGroups()).find((item) => item.id === group.id);
    assert.equal(groupSummary?.contacts, 2);
    assert.equal(
      groupSummary?.options.find((item) => item.id === option.id)?.contacts,
      1,
    );
    assert.equal(
      groupSummary?.options.find((item) => item.id === secondOption.id)?.contacts,
      2,
    );

    const preview = await service.previewAudience({
      groupOptionIds: [option.id, secondOption.id],
      excludeGroupOptionIds: [exclusionOption.id],
    });
    assert.equal(preview.included, 2);
    assert.equal(preview.excluded, 1);
    assert.equal(preview.eligible, 1);
    assert.equal(preview.recipients[0]?.email, emails[0]);
    assert.equal(preview.sample[0]?.email, emails[0]);

    const created = await service.createCampaign(user.id, {
      name: 'Campaña congelada',
      newsletterId: newsletter.id,
      subject: 'Asunto de la campaña',
      fromName: 'Museo de Arte de Lima - MALI',
      fromEmail: senderEmail,
      replyTo: 'evelazco@mali.pe',
      groupOptionIds: [option.id, secondOption.id],
      excludeGroupOptionIds: [exclusionOption.id],
    });
    campaignId = created.id;
    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { subject: 'Asunto editado', htmlBody: '<p>Editado</p>' },
    });

    const campaign = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: created.id },
      include: { sends: true },
    });
    assert.equal(campaign.subjectSnapshot, 'Asunto de la campaña');
    assert.equal(campaign.htmlSnapshot, '<p>Contenido original</p>');
    assert.equal(campaign.fromName, 'Museo de Arte de Lima - MALI');
    assert.equal(campaign.fromEmail, senderEmail);
    assert.equal(campaign.managedByDispatcher, true);
    assert.deepEqual(campaign.audienceSegments, [option.id, secondOption.id]);
    assert.deepEqual(campaign.audienceExcludeSegments, [exclusionOption.id]);
    assert.equal(campaign.sends.length, 1);
    assert.deepEqual(
      campaign.sends.map((send) => send.email).sort(),
      [emails[0]],
    );
    assert.equal(
      campaign.sends.filter((send) => send.sourceContactId === contacts[0].id).length,
      1,
    );

    const duplicated = await service.duplicateCampaign(user.id, created.id);
    duplicatedCampaignId = duplicated.id;
    duplicatedNewsletterId = duplicated.newsletterId;
    assert.equal(duplicated.status, 'draft');
    assert.equal(duplicated.previewHtml, '<p>Contenido original</p>');
    assert.equal(duplicated.newsletter.status, 'draft');
    assert.equal(duplicated.scheduledAt, null);
    assert.deepEqual(duplicated.groupOptionIds, [option.id, secondOption.id]);
    assert.deepEqual(duplicated.excludeGroupOptionIds, [exclusionOption.id]);

    const duplicatedBeforeSend = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: duplicated.id },
      include: { sends: true, newsletter: true },
    });
    assert.equal(duplicatedBeforeSend.managedByDispatcher, false);
    assert.equal(duplicatedBeforeSend.sends.length, 0);
    assert.equal(duplicatedBeforeSend.sentCount, 0);
    assert.equal(duplicatedBeforeSend.openCount, 0);
    assert.equal(duplicatedBeforeSend.newsletter.htmlBody, '<p>Contenido original</p>');

    await prisma.newsletter.update({
      where: { id: duplicated.newsletterId },
      data: { htmlBody: '<p>Copia editada</p>' },
    });
    const draftView = await service.getCampaignBrowserView(duplicated.id);
    assert.equal(draftView.html, '<p>Copia editada</p>');

    const sentDuplicate = await service.sendDraftCampaign(duplicated.id, {
      name: duplicated.name,
      newsletterId: duplicated.newsletterId,
      subject: duplicated.subject,
      fromName: duplicated.fromName,
      fromEmail: duplicated.fromEmail,
      replyTo: duplicated.replyTo,
      groupOptionIds: duplicated.groupOptionIds,
      excludeGroupOptionIds: duplicated.excludeGroupOptionIds,
    });
    assert.equal(sentDuplicate.status, 'queued');
    assert.equal(sentDuplicate.totalRecipients, 1);
    const duplicatedAfterSend = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: duplicated.id },
      include: { sends: true },
    });
    assert.equal(duplicatedAfterSend.managedByDispatcher, true);
    assert.equal(duplicatedAfterSend.htmlSnapshot, '<p>Copia editada</p>');
    assert.equal(duplicatedAfterSend.sends.length, 1);
  } finally {
    if (duplicatedCampaignId) {
      await prisma.emailCampaign.deleteMany({ where: { id: duplicatedCampaignId } });
    }
    if (campaignId) await prisma.emailCampaign.deleteMany({ where: { id: campaignId } });
    if (senderId) await prisma.emailSender.deleteMany({ where: { id: senderId } });
    await prisma.malichimpSuppression.deleteMany({ where: { email: { in: emails } } });
    await prisma.emailGlobalSuppression.deleteMany({ where: { email: { in: emails } } });
    await prisma.malichimpContact.deleteMany({ where: { email: { in: emails } } });
    if (groupId) await prisma.malichimpGroup.deleteMany({ where: { id: groupId } });
    if (duplicatedNewsletterId) {
      await prisma.newsletter.deleteMany({ where: { id: duplicatedNewsletterId } });
    }
    if (newsletterId) await prisma.newsletter.deleteMany({ where: { id: newsletterId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    if (previousEnabled === undefined) delete process.env.AWS_SES_ENABLED;
    else process.env.AWS_SES_ENABLED = previousEnabled;
  }
});
