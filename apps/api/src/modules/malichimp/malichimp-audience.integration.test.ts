import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailCampaignStatus,
  MalichimpContactStatus,
  NewsletterKind,
  NewsletterScope,
  NewsletterStatus,
} from '@prisma/client';
import { MALICHIMP_RESOLVE_EMAILS_MAX } from '@mali-one/shared';
import { EmailDeliveryService } from '../../core/email-delivery/email-delivery.service';
import { EmailSenderService } from '../../core/email-delivery/email-sender.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NewslettersService } from '../newsletters/newsletters.service';
import { MalichimpService } from './malichimp.service';

const databaseUrl = process.env.MALICHIMP_TEST_DATABASE_URL;

function buildService(prisma: PrismaService) {
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
  return new MalichimpService(
    prisma,
    delivery,
    emailSenders,
    newsletters,
    googleAdmin,
    emailTracking,
  );
}

test('audience tags: unión OR, exclusiones prevalecen, DTO sin mode=groups, legacy null', {
  skip: databaseUrl ? false : 'MALICHIMP_TEST_DATABASE_URL no configurada',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaService();
  const service = buildService(prisma);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emails = {
    a: `tag-a-${suffix}@example.com`,
    b: `tag-b-${suffix}@example.com`,
    both: `tag-both-${suffix}@example.com`,
    excluded: `tag-ex-${suffix}@example.com`,
    suppressed: `tag-sup-${suffix}@example.com`,
  };
  let userId = '';
  let newsletterId = '';
  let campaignId = '';
  let workingId = '';
  let tagAId = '';
  let tagBId = '';
  let tagExcludeId = '';
  let groupId = '';
  let senderId = '';
  const allEmails = Object.values(emails);

  try {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        googleId: `audience-tags-${suffix}`,
        email: `audience-tags-${suffix}@mali.pe`,
        name: 'Audience Tags Test',
      },
    });
    userId = user.id;

    const [tagA, tagB, tagExclude] = await Promise.all([
      prisma.malichimpTag.create({
        data: { name: `Tag A ${suffix}`, normalizedName: `tag-a-${suffix}` },
      }),
      prisma.malichimpTag.create({
        data: { name: `Tag B ${suffix}`, normalizedName: `tag-b-${suffix}` },
      }),
      prisma.malichimpTag.create({
        data: { name: `Tag Ex ${suffix}`, normalizedName: `tag-ex-${suffix}` },
      }),
    ]);
    tagAId = tagA.id;
    tagBId = tagB.id;
    tagExcludeId = tagExclude.id;

    const contacts = await Promise.all([
      prisma.malichimpContact.create({
        data: { email: emails.a, firstName: 'A', status: MalichimpContactStatus.subscribed },
      }),
      prisma.malichimpContact.create({
        data: { email: emails.b, firstName: 'B', status: MalichimpContactStatus.subscribed },
      }),
      prisma.malichimpContact.create({
        data: { email: emails.both, firstName: 'Both', status: MalichimpContactStatus.subscribed },
      }),
      prisma.malichimpContact.create({
        data: { email: emails.excluded, firstName: 'Ex', status: MalichimpContactStatus.subscribed },
      }),
      prisma.malichimpContact.create({
        data: {
          email: emails.suppressed,
          firstName: 'Sup',
          status: MalichimpContactStatus.subscribed,
        },
      }),
    ]);
    const [contactA, contactB, contactBoth, contactExcluded, contactSuppressed] = contacts;

    await prisma.malichimpContactTag.createMany({
      data: [
        { contactId: contactA.id, tagId: tagA.id },
        { contactId: contactB.id, tagId: tagB.id },
        { contactId: contactBoth.id, tagId: tagA.id },
        { contactId: contactBoth.id, tagId: tagB.id },
        { contactId: contactExcluded.id, tagId: tagA.id },
        { contactId: contactExcluded.id, tagId: tagExclude.id },
        { contactId: contactSuppressed.id, tagId: tagA.id },
      ],
    });
    await prisma.malichimpSuppression.create({
      data: { email: emails.suppressed, reason: 'manual', source: 'test' },
    });

    const union = await service.previewAudience({
      audienceMode: 'tags',
      tagIds: [tagA.id, tagB.id],
    });
    assert.equal(union.eligible, 4);
    assert.deepEqual(
      union.recipients.map((row) => row.email).sort(),
      [emails.a, emails.b, emails.both, emails.excluded].sort(),
    );

    const withExclusion = await service.previewAudience({
      audienceMode: 'tags',
      tagIds: [tagA.id, tagB.id],
      excludeTagIds: [tagExclude.id],
    });
    assert.equal(withExclusion.eligible, 3);
    assert.ok(!withExclusion.recipients.some((row) => row.email === emails.excluded));
    assert.ok(!withExclusion.recipients.some((row) => row.email === emails.suppressed));

    const tags = await service.listTags();
    const listedA = tags.find((tag) => tag.id === tagA.id);
    assert.ok(listedA);
    assert.equal(listedA.contacts, 4);
    assert.equal(listedA.eligibleContacts, 3);

    const group = await prisma.malichimpGroup.create({
      data: { name: `Grupo ${suffix}`, normalizedName: `grupo-aud-${suffix}` },
    });
    groupId = group.id;
    const option = await prisma.malichimpGroupOption.create({
      data: {
        groupId: group.id,
        name: `Opción ${suffix}`,
        normalizedName: `opcion-aud-${suffix}`,
      },
    });
    await prisma.malichimpContactGroupOption.create({
      data: { contactId: contactA.id, optionId: option.id },
    });

    const legacyPreview = await service.previewAudience({
      groupOptionIds: [option.id],
    });
    assert.equal(legacyPreview.audienceMode, 'groups');
    assert.equal(legacyPreview.eligible, 1);
    assert.equal(legacyPreview.recipients[0]?.email, emails.a);

    const newsletter = await prisma.newsletter.create({
      data: {
        slug: `audience-legacy-${suffix}`,
        title: 'Legacy audience',
        subject: 'Asunto',
        htmlBody: '<p>Hola</p>',
        status: NewsletterStatus.draft,
        scope: NewsletterScope.malichimp,
        kind: NewsletterKind.catalog,
        createdById: user.id,
      },
    });
    newsletterId = newsletter.id;

    const sender = await prisma.emailSender.create({
      data: {
        email: `sender-aud-${suffix}@mali.pe`,
        scope: NewsletterScope.malichimp,
        createdById: user.id,
      },
    });
    senderId = sender.id;

    const working = await prisma.newsletter.create({
      data: {
        slug: `audience-legacy-wc-${suffix}`,
        title: 'Legacy WC',
        subject: 'Asunto',
        htmlBody: '<p>Hola</p>',
        status: NewsletterStatus.draft,
        scope: NewsletterScope.malichimp,
        kind: NewsletterKind.campaign_working_copy,
        createdById: user.id,
      },
    });
    workingId = working.id;

    const legacyCampaign = await prisma.emailCampaign.create({
      data: {
        newsletterId: newsletter.id,
        workingNewsletterId: working.id,
        name: `Legacy null mode ${suffix}`,
        subjectSnapshot: 'Asunto',
        htmlSnapshot: '<p>Hola</p>',
        fromName: 'MALI',
        fromEmail: sender.email,
        replyToEmail: sender.email,
        status: EmailCampaignStatus.draft,
        audienceArea: 'malichimp',
        audienceMode: null,
        audienceSegments: [option.id],
        audienceExcludeSegments: [],
        audienceIncludeContactIds: [],
        audienceExcludeContactIds: [],
        totalRecipients: 1,
        createdById: user.id,
      },
    });
    campaignId = legacyCampaign.id;

    const detail = await service.getCampaign(legacyCampaign.id);
    assert.equal(detail.audienceMode, null);
    assert.deepEqual(detail.groupOptionIds, [option.id]);
    assert.deepEqual(detail.tagIds, []);

    const duplicated = await service.duplicateCampaign(user.id, legacyCampaign.id);
    assert.equal(duplicated.audienceMode, 'groups');
    assert.deepEqual(duplicated.groupOptionIds, [option.id]);

    await prisma.emailCampaign.deleteMany({ where: { id: duplicated.id } });
    if (duplicated.workingNewsletterId) {
      await prisma.newsletter.deleteMany({ where: { id: duplicated.workingNewsletterId } });
    }
  } finally {
    if (campaignId) {
      await prisma.emailCampaign.deleteMany({ where: { id: campaignId } });
    }
    if (workingId) await prisma.newsletter.deleteMany({ where: { id: workingId } });
    if (newsletterId) await prisma.newsletter.deleteMany({ where: { id: newsletterId } });
    if (senderId) await prisma.emailSender.deleteMany({ where: { id: senderId } });
    if (groupId) await prisma.malichimpGroup.deleteMany({ where: { id: groupId } });
    await prisma.malichimpSuppression.deleteMany({ where: { email: { in: allEmails } } });
    await prisma.malichimpContact.deleteMany({ where: { email: { in: allEmails } } });
    const tagIds = [tagAId, tagBId, tagExcludeId].filter(Boolean);
    if (tagIds.length) await prisma.malichimpTag.deleteMany({ where: { id: { in: tagIds } } });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});

test('resolve-emails: buckets, dedupe case-insensitive, invalid≠notFound, límite 10k', {
  skip: databaseUrl ? false : 'MALICHIMP_TEST_DATABASE_URL no configurada',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaService();
  const service = buildService(prisma);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const eligibleEmail = `ready-${suffix}@example.com`;
  const unsubEmail = `unsub-${suffix}@example.com`;
  const suppressedEmail = `blocked-${suffix}@example.com`;
  const cleanedEmail = `cleaned-${suffix}@example.com`;
  const knownEmails = [eligibleEmail, unsubEmail, suppressedEmail, cleanedEmail];

  try {
    await prisma.$connect();
    const [eligible] = await Promise.all([
      prisma.malichimpContact.create({
        data: {
          email: eligibleEmail,
          firstName: 'Listo',
          lastName: 'Envio',
          status: MalichimpContactStatus.subscribed,
        },
      }),
      prisma.malichimpContact.create({
        data: { email: unsubEmail, status: MalichimpContactStatus.unsubscribed },
      }),
      prisma.malichimpContact.create({
        data: { email: cleanedEmail, status: MalichimpContactStatus.cleaned },
      }),
      prisma.malichimpContact.create({
        data: { email: suppressedEmail, status: MalichimpContactStatus.subscribed },
      }),
    ]);
    await prisma.emailGlobalSuppression.create({
      data: { email: suppressedEmail, reason: 'complaint', source: 'test' },
    });

    const resolved = await service.resolveEmails([
      ` ${eligibleEmail.toUpperCase()} `,
      eligibleEmail,
      'no-existe-aud@example.com',
      'correo-malo',
      '',
      '  ',
      unsubEmail,
      cleanedEmail,
      suppressedEmail,
    ]);

    assert.equal(resolved.summary.received, 9);
    assert.equal(resolved.summary.unique, 6);
    assert.equal(resolved.summary.eligible, 1);
    assert.equal(resolved.summary.notFound, 1);
    assert.equal(resolved.summary.invalid, 1);
    assert.equal(resolved.summary.blocked, 3);
    assert.equal(resolved.eligible[0]?.id, eligible.id);
    assert.equal(resolved.eligible[0]?.email, eligibleEmail);
    assert.equal(resolved.eligible[0]?.name, 'Listo Envio');
    assert.deepEqual(resolved.notFound, ['no-existe-aud@example.com']);
    assert.deepEqual(resolved.invalid, ['correo-malo']);
    assert.ok(resolved.blocked.some((row) => row.email === unsubEmail && row.reason === 'unsubscribed'));
    assert.ok(resolved.blocked.some((row) => row.email === cleanedEmail && row.reason === 'cleaned'));
    assert.ok(resolved.blocked.some((row) => row.email === suppressedEmail && row.reason === 'suppressed'));
    assert.ok(!resolved.notFound.includes('correo-malo'));
    assert.ok(!resolved.blocked.some((row) => row.reason === 'suppressed' && resolved.notFound.includes(row.email)));

    const atLimit = Array.from(
      { length: MALICHIMP_RESOLVE_EMAILS_MAX },
      (_, index) => `limit-${suffix}-${index}@example.com`,
    );
    const ok = await service.resolveEmails(atLimit);
    assert.equal(ok.summary.unique, MALICHIMP_RESOLVE_EMAILS_MAX);
    assert.equal(ok.summary.notFound, MALICHIMP_RESOLVE_EMAILS_MAX);

    await assert.rejects(
      () => service.resolveEmails([...atLimit, `limit-${suffix}-overflow@example.com`]),
      (err: unknown) => err instanceof BadRequestException,
    );
  } finally {
    await prisma.emailGlobalSuppression.deleteMany({ where: { email: { in: knownEmails } } });
    await prisma.malichimpContact.deleteMany({ where: { email: { in: knownEmails } } });
    await prisma.$disconnect();
  }
});

test('duplicate emails mode: conserva contactos elegibles; no inventa notFound/invalid/blocked', {
  skip: databaseUrl ? false : 'MALICHIMP_TEST_DATABASE_URL no configurada',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaService();
  const service = buildService(prisma);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emailOne = `dup-one-${suffix}@example.com`;
  const emailTwo = `dup-two-${suffix}@example.com`;
  let userId = '';
  let newsletterId = '';
  let workingId = '';
  let campaignId = '';
  let duplicatedId = '';
  let duplicatedWorkingId = '';
  let senderId = '';

  try {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        googleId: `audience-emails-${suffix}`,
        email: `audience-emails-${suffix}@mali.pe`,
        name: 'Audience Emails Test',
      },
    });
    userId = user.id;

    const contacts = await Promise.all([
      prisma.malichimpContact.create({
        data: {
          email: emailOne,
          firstName: 'Uno',
          lastName: 'Lista',
          status: MalichimpContactStatus.subscribed,
        },
      }),
      prisma.malichimpContact.create({
        data: {
          email: emailTwo,
          firstName: 'Dos',
          status: MalichimpContactStatus.subscribed,
        },
      }),
    ]);

    const newsletter = await prisma.newsletter.create({
      data: {
        slug: `audience-emails-${suffix}`,
        title: 'Emails base',
        subject: 'Asunto emails',
        htmlBody: '<p>Base</p>',
        status: NewsletterStatus.draft,
        scope: NewsletterScope.malichimp,
        kind: NewsletterKind.catalog,
        createdById: user.id,
      },
    });
    newsletterId = newsletter.id;

    const sender = await prisma.emailSender.create({
      data: {
        email: `sender-emails-${suffix}@mali.pe`,
        scope: NewsletterScope.malichimp,
        createdById: user.id,
      },
    });
    senderId = sender.id;

    const working = await prisma.newsletter.create({
      data: {
        slug: `audience-emails-wc-${suffix}`,
        title: 'Emails WC',
        subject: 'Asunto emails',
        htmlBody: '<p>Base</p>',
        status: NewsletterStatus.draft,
        scope: NewsletterScope.malichimp,
        kind: NewsletterKind.campaign_working_copy,
        createdById: user.id,
      },
    });
    workingId = working.id;

    const campaign = await prisma.emailCampaign.create({
      data: {
        newsletterId: newsletter.id,
        workingNewsletterId: working.id,
        name: `Emails draft ${suffix}`,
        subjectSnapshot: 'Asunto emails',
        htmlSnapshot: '<p>Base</p>',
        fromName: 'MALI',
        fromEmail: sender.email,
        replyToEmail: sender.email,
        status: EmailCampaignStatus.draft,
        audienceArea: 'malichimp',
        audienceMode: 'emails',
        audienceSegments: [],
        audienceExcludeSegments: [],
        audienceIncludeContactIds: contacts.map((contact) => contact.id),
        audienceExcludeContactIds: [],
        totalRecipients: 2,
        createdById: user.id,
      },
    });
    campaignId = campaign.id;

    const detail = await service.getCampaign(campaign.id);
    assert.equal(detail.audienceMode, 'emails');
    assert.deepEqual(
      (detail.includeContacts ?? []).map((row) => row.email).sort(),
      [emailOne, emailTwo].sort(),
    );
    assert.ok(detail.includeContacts?.every((row) => row.id && row.email));
    assert.equal(
      detail.includeContacts?.find((row) => row.email === emailOne)?.name,
      'Uno Lista',
    );

    const duplicated = await service.duplicateCampaign(user.id, campaign.id);
    duplicatedId = duplicated.id;
    duplicatedWorkingId = duplicated.workingNewsletterId ?? '';
    assert.equal(duplicated.audienceMode, 'emails');
    assert.deepEqual(
      (duplicated.includeContactIds ?? []).sort(),
      contacts.map((contact) => contact.id).sort(),
    );
    assert.deepEqual(
      (duplicated.includeContacts ?? []).map((row) => row.email).sort(),
      [emailOne, emailTwo].sort(),
    );
    assert.deepEqual(duplicated.excludeContactIds ?? [], []);
    assert.deepEqual(duplicated.groupOptionIds, []);
    assert.deepEqual(duplicated.tagIds, []);
    assert.ok(!('notFound' in duplicated));
    assert.ok(!('invalid' in duplicated));
    assert.ok(!('blocked' in duplicated));

    const emailsPreview = await service.previewAudience({
      audienceMode: 'emails',
      includeContactIds: contacts.map((contact) => contact.id),
    });
    assert.equal(emailsPreview.eligible, 2);
    assert.equal(emailsPreview.audienceMode, 'emails');
  } finally {
    if (duplicatedId) {
      await prisma.emailCampaign.deleteMany({ where: { id: duplicatedId } });
    }
    if (duplicatedWorkingId) {
      await prisma.newsletter.deleteMany({ where: { id: duplicatedWorkingId } });
    }
    if (campaignId) await prisma.emailCampaign.deleteMany({ where: { id: campaignId } });
    if (workingId) await prisma.newsletter.deleteMany({ where: { id: workingId } });
    if (newsletterId) await prisma.newsletter.deleteMany({ where: { id: newsletterId } });
    if (senderId) await prisma.emailSender.deleteMany({ where: { id: senderId } });
    await prisma.malichimpContact.deleteMany({
      where: { email: { in: [emailOne, emailTwo] } },
    });
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
