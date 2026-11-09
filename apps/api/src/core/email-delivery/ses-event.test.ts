import assert from 'node:assert/strict';
import test from 'node:test';
import { SesEventType } from '@prisma/client';
import { parseSesEvent } from './ses-event';

function envelope(detailType: string, detail: Record<string, unknown>) {
  return {
    version: '0',
    id: 'event-123',
    source: 'aws.ses',
    'detail-type': detailType,
    time: '2026-11-09T18:00:00.000Z',
    detail,
  };
}

test('parses bounce recipients and normalizes their email', () => {
  const parsed = parseSesEvent(
    envelope('Email Bounced', {
      mail: {
        messageId: 'ses-message-1',
        destination: ['PERSON@Example.com'],
      },
      bounce: {
        bouncedRecipients: [{ emailAddress: 'person@example.com' }],
      },
    }),
  );

  assert.equal(parsed.type, SesEventType.bounce);
  assert.equal(parsed.messageId, 'ses-message-1');
  assert.deepEqual(parsed.recipients, ['person@example.com']);
});

test('recognizes a global SES unsubscribe', () => {
  const parsed = parseSesEvent(
    envelope('Email Subscribed', {
      mail: { destination: ['person@example.com'] },
      subscription: {
        newTopicPreferences: { unsubscribeAll: true },
      },
    }),
  );

  assert.equal(parsed.type, SesEventType.subscription);
  assert.equal(parsed.subscriptionAction, 'suppress');
});

test('recognizes an explicit SES opt-in without removing other suppressions', () => {
  const parsed = parseSesEvent(
    envelope('Email Subscribed', {
      mail: { destination: ['person@example.com'] },
      subscription: {
        newTopicPreferences: {
          unsubscribeAll: false,
          topicSubscriptionStatus: [
            { topicName: 'newsletters', subscriptionStatus: 'OptIn' },
          ],
        },
      },
    }),
  );

  assert.equal(parsed.subscriptionAction, 'restore');
});

test('rejects events outside SES', () => {
  assert.throws(
    () => parseSesEvent({ id: 'x', source: 'custom.app' }),
    /no pertenece a Amazon SES/,
  );
});
