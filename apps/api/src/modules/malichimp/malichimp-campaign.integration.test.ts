import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { NewsletterKind, NewsletterScope, NewsletterStatus } from '@prisma/client';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import { EmailCampaignDispatcherService } from '../../core/email-delivery/email-campaign-dispatcher.service';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { contentRevisionOf } from '../newsletters/newsletter-working-copy';
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
  let savedDraftId = '';
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
    const sender = await emailSenders.create(
      senderEmail,
      NewsletterScope.malichimp,
      user.id,
    );
    senderId = sender.id;
    const newsletter = await prisma.newsletter.create({
      data: {
        slug: `campaign-test-${suffix}`,
        title: 'Contenido original',
        subject: 'Asunto original',
        htmlBody: '<p>Contenido original</p>',
        status: NewsletterStatus.draft,
        scope: NewsletterScope.malichimp,
        kind: NewsletterKind.catalog,
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
        data: { email, firstName: 'María José', lastName: 'De la Cruz', status: 'subscribed' },
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
      audienceRevision: (await service.reviewAudience({
        groupOptionIds: [option.id, secondOption.id],
        excludeGroupOptionIds: [exclusionOption.id],
      })).audienceRevision,
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

    // Persist manual contact criteria (as the UI would on confirm) before duplicating.
    await prisma.emailCampaign.update({
      where: { id: created.id },
      data: {
        audienceExcludeContactIds: [contacts[0].id],
        audienceIncludeContactIds: [],
      },
    });
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
    assert.equal(campaign.sends[0].firstName, 'María José');
    assert.equal(campaign.sends[0].lastName, 'De la Cruz');
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
    assert.deepEqual(duplicated.excludeContactIds, [contacts[0].id]);
    assert.deepEqual(duplicated.includeContactIds ?? [], []);

    const duplicatedBeforeSend = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: duplicated.id },
      include: { sends: true, workingNewsletter: true },
    });
    assert.equal(duplicatedBeforeSend.managedByDispatcher, false);
    assert.equal(duplicatedBeforeSend.sends.length, 0);
    assert.equal(duplicatedBeforeSend.sentCount, 0);
    assert.equal(duplicatedBeforeSend.openCount, 0);
    assert.ok(duplicatedBeforeSend.workingNewsletterId);
    assert.equal(duplicatedBeforeSend.workingNewsletter?.htmlBody, '<p>Contenido original</p>');

    await prisma.newsletter.update({
      where: { id: duplicatedBeforeSend.workingNewsletterId! },
      data: { htmlBody: '<p>Copia editada</p>' },
    });
    const draftView = await service.getCampaignBrowserView(duplicated.id);
    assert.equal(draftView.html, '<p>Copia editada</p>');

    const workingFresh = await prisma.newsletter.findUniqueOrThrow({
      where: { id: duplicatedBeforeSend.workingNewsletterId! },
    });
    const draftData = {
      name: duplicated.name,
      newsletterId: duplicated.workingNewsletterId || duplicated.newsletterId,
      subject: duplicated.subject,
      fromName: duplicated.fromName,
      fromEmail: duplicated.fromEmail,
      replyTo: duplicated.replyTo,
      audienceMode: 'emails' as const,
      includeContactIds: [contacts[0].id],
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    const firstDraft = await service.saveDraftCampaign(user.id, { ...draftData, newsletterId: newsletter.id });
    savedDraftId = firstDraft.id;
    assert.equal(firstDraft.status, 'draft');
    assert.deepEqual(firstDraft.includeContactIds, [contacts[0].id]);

    const saved = await service.saveDraftCampaign(user.id, {
      ...draftData,
      contentRevision: contentRevisionOf(workingFresh),
    }, duplicated.id);
    assert.equal(saved.audienceMode, 'emails');
    assert.equal(saved.scheduledAt?.toISOString(), draftData.scheduledAt);
    assert.equal(saved.previewHtml, '<p>Copia editada</p>');

    let deliveredToTransport = 0;
    delivery.sendHtml = async () => {
      deliveredToTransport++;
      return { messageId: 'mock-ses-id' };
    };
    const testResult = await service.sendTestCampaign(user, {
      campaignId: saved.id,
      ...draftData,
      contentRevision: saved.contentRevision ?? undefined,
      emails: [user.email],
    });
    assert.equal(testResult.sends[0]?.status, 'sent');
    const resumed = await service.getCampaign(saved.id);
    assert.equal(resumed.audienceMode, 'emails');
    assert.deepEqual(resumed.includeContactIds, [contacts[0].id]);
    assert.equal(resumed.scheduledAt?.toISOString(), draftData.scheduledAt);

    const sentDuplicate = await service.sendDraftCampaign(duplicated.id, {
      audienceRevision: (await service.reviewAudience({
        audienceMode: 'emails',
        includeContactIds: [contacts[0].id],
      })).audienceRevision,
      name: duplicated.name,
      newsletterId: duplicated.workingNewsletterId || duplicated.newsletterId,
      subject: duplicated.subject,
      fromName: duplicated.fromName,
      fromEmail: duplicated.fromEmail,
      replyTo: duplicated.replyTo,
      audienceMode: 'emails',
      includeContactIds: [contacts[0].id],
      contentRevision: resumed.contentRevision ?? undefined,
    });
    assert.equal(sentDuplicate.status, 'queued');
    assert.equal(sentDuplicate.totalRecipients, 1);
    const duplicatedAfterSend = await prisma.emailCampaign.findUniqueOrThrow({
      where: { id: duplicated.id },
      include: { sends: true },
    });
    assert.equal(duplicatedAfterSend.managedByDispatcher, true);
    assert.equal(duplicatedAfterSend.htmlSnapshot, '<p>Copia editada</p>');
    assert.equal(duplicatedAfterSend.sends.filter((send) => !send.isTest).length, 1);

    await prisma.emailCampaign.update({ where: { id: created.id }, data: { managedByDispatcher: false } });
    await prisma.malichimpSuppression.create({
      data: { email: contacts[0].email, reason: 'mailchimp_cleaned', source: 'mailchimp_import' },
    });
    await new EmailCampaignDispatcherService(prisma, delivery, emailTracking, config).processQueue();
    const suppressed = await prisma.emailSend.findFirstOrThrow({
      where: { campaignId: duplicated.id, isTest: false },
    });
    assert.equal(suppressed.status, 'suppressed');
    assert.equal(deliveredToTransport, 1, 'Solo la prueba debe llegar al transporte simulado');

    const setup = await service.getCampaignSetup();
    assert.ok(setup.groups.some((item) => item.id === groupId));
    assert.ok(setup.senders.some((item) => item.email === senderEmail));
    const listing = await service.listCampaigns();
    const listed = listing.find((item) => item.id === duplicated.id);
    assert.equal(listed?.suppressed, 1);
    assert.equal(listed?.sent, 0, 'El envío de prueba no cuenta en el listado de producción');
    assert.equal(listing.find((item) => item.id === savedDraftId)?.suppressed, 0);
  } finally {
    if (savedDraftId) await service.deleteDraftCampaign(savedDraftId);
    const workingIds: string[] = [];
    if (duplicatedCampaignId) {
      const dup = await prisma.emailCampaign.findUnique({
        where: { id: duplicatedCampaignId },
        select: { workingNewsletterId: true },
      });
      if (dup?.workingNewsletterId) workingIds.push(dup.workingNewsletterId);
      await prisma.emailCampaign.deleteMany({ where: { id: duplicatedCampaignId } });
    }
    if (campaignId) {
      const camp = await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        select: { workingNewsletterId: true },
      });
      if (camp?.workingNewsletterId) workingIds.push(camp.workingNewsletterId);
      await prisma.emailCampaign.deleteMany({ where: { id: campaignId } });
    }
    if (workingIds.length) {
      await prisma.newsletter.deleteMany({ where: { id: { in: workingIds } } });
    }
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
