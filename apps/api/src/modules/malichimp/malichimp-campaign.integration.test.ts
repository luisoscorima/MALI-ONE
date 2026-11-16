import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { NewsletterStatus } from '@prisma/client';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
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
  const newsletters = new NewslettersService(prisma, config);
  const service = new MalichimpService(prisma, delivery, newsletters);
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
  let groupId = '';

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
    });
    assert.equal(preview.eligible, 2);
    assert.equal(preview.sample[0]?.email, emails[0]);

    const created = await service.createCampaign(user.id, {
      name: 'Campaña congelada',
      newsletterId: newsletter.id,
      replyTo: 'tecnologia@mali.pe',
      groupOptionIds: [option.id, secondOption.id],
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
    assert.equal(campaign.subjectSnapshot, 'Asunto original');
    assert.equal(campaign.htmlSnapshot, '<p>Contenido original</p>');
    assert.equal(campaign.managedByDispatcher, true);
    assert.deepEqual(campaign.audienceSegments, [option.id, secondOption.id]);
    assert.equal(campaign.sends.length, 2);
    assert.deepEqual(
      campaign.sends.map((send) => send.email).sort(),
      [emails[0], emails[1]].sort(),
    );
    assert.equal(
      campaign.sends.filter((send) => send.sourceContactId === contacts[0].id).length,
      1,
    );
  } finally {
    if (campaignId) await prisma.emailCampaign.deleteMany({ where: { id: campaignId } });
    await prisma.malichimpSuppression.deleteMany({ where: { email: { in: emails } } });
    await prisma.emailGlobalSuppression.deleteMany({ where: { email: { in: emails } } });
    await prisma.malichimpContact.deleteMany({ where: { email: { in: emails } } });
    if (groupId) await prisma.malichimpGroup.deleteMany({ where: { id: groupId } });
    if (newsletterId) await prisma.newsletter.deleteMany({ where: { id: newsletterId } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
    if (previousEnabled === undefined) delete process.env.AWS_SES_ENABLED;
    else process.env.AWS_SES_ENABLED = previousEnabled;
  }
});
