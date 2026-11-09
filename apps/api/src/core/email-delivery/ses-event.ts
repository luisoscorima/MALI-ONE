import { SesEventType } from '@prisma/client';

export type SesSubscriptionAction = 'suppress' | 'restore' | null;

export type ParsedSesEvent = {
  eventId: string;
  messageId: string | null;
  type: SesEventType;
  recipients: string[];
  occurredAt: Date;
  subscriptionAction: SesSubscriptionAction;
  payload: Record<string, unknown>;
};

const EVENT_TYPES: Record<string, SesEventType> = {
  'Email Sent': SesEventType.send,
  'Email Rendering Failed': SesEventType.rendering_failure,
  'Email Rejected': SesEventType.reject,
  'Email Delivered': SesEventType.delivery,
  'Email Bounced': SesEventType.bounce,
  'Email Complaint Received': SesEventType.complaint,
  'Email Delivery Delayed': SesEventType.delivery_delay,
  'Email Subscribed': SesEventType.subscription,
  'Email Opened': SesEventType.open,
  'Email Clicked': SesEventType.click,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email && email.length <= 320 && email.includes('@') ? email : null;
}

function recipientEmails(detail: Record<string, unknown>): string[] {
  const mail = asRecord(detail.mail);
  const values: unknown[] = Array.isArray(mail?.destination)
    ? [...mail.destination]
    : [];

  const bounce = asRecord(detail.bounce);
  if (Array.isArray(bounce?.bouncedRecipients)) {
    for (const recipient of bounce.bouncedRecipients) {
      values.push(asRecord(recipient)?.emailAddress);
    }
  }

  const complaint = asRecord(detail.complaint);
  if (Array.isArray(complaint?.complainedRecipients)) {
    for (const recipient of complaint.complainedRecipients) {
      values.push(asRecord(recipient)?.emailAddress);
    }
  }

  return [...new Set(values.map(normalizeEmail).filter(Boolean))] as string[];
}

function normalizedStatus(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[^a-z]/gi, '').toLowerCase()
    : '';
}

function subscriptionAction(detail: Record<string, unknown>): SesSubscriptionAction {
  const subscription = asRecord(detail.subscription);
  const preferences = asRecord(subscription?.newTopicPreferences);
  if (!preferences) return null;
  if (preferences.unsubscribeAll === true) return 'suppress';

  const statuses: string[] = [];
  const topicStatuses = preferences.topicSubscriptionStatus;
  if (Array.isArray(topicStatuses)) {
    for (const topic of topicStatuses) {
      statuses.push(normalizedStatus(asRecord(topic)?.subscriptionStatus));
    }
  } else if (asRecord(topicStatuses)) {
    statuses.push(
      normalizedStatus(asRecord(topicStatuses)?.subscriptionStatus),
    );
  }

  if (statuses.some((status) => status === 'optout')) return 'suppress';
  if (preferences.unsubscribeAll === false || statuses.some((status) => status === 'optin')) {
    return 'restore';
  }
  return null;
}

export function parseSesEvent(raw: unknown): ParsedSesEvent {
  const payload = asRecord(raw);
  if (!payload || payload.source !== 'aws.ses') {
    throw new Error('Evento SQS no pertenece a Amazon SES');
  }
  const eventId = typeof payload.id === 'string' ? payload.id.trim() : '';
  const detailType =
    typeof payload['detail-type'] === 'string' ? payload['detail-type'] : '';
  const type = EVENT_TYPES[detailType];
  const detail = asRecord(payload.detail);
  if (!eventId || !type || !detail) {
    throw new Error('Evento SES incompleto o no compatible');
  }
  const mail = asRecord(detail.mail);
  const messageId =
    typeof mail?.messageId === 'string' ? mail.messageId.slice(0, 255) : null;
  const timestamp =
    typeof payload.time === 'string'
      ? payload.time
      : typeof mail?.timestamp === 'string'
        ? mail.timestamp
        : '';
  const occurredAt = new Date(timestamp);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('Evento SES sin fecha válida');
  }

  return {
    eventId: eventId.slice(0, 120),
    messageId,
    type,
    recipients: recipientEmails(detail),
    occurredAt,
    subscriptionAction:
      type === SesEventType.subscription ? subscriptionAction(detail) : null,
    payload,
  };
}
