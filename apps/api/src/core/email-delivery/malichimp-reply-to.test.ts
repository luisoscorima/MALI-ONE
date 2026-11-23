import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  baseMailboxFromReplyTo,
  extractSendIdFromReplyAddress,
  replyToWithSendToken,
} from './malichimp-reply-to';

describe('malichimp-reply-to', () => {
  it('builds plus-address and extracts send id', () => {
    const replyTo = replyToWithSendToken('comunicaciones@mali.pe', 'clxyz123abc');
    assert.equal(replyTo, 'comunicaciones+mc.clxyz123abc@mali.pe');
    assert.equal(
      extractSendIdFromReplyAddress('Comunicaciones <comunicaciones+mc.clxyz123abc@mali.pe>'),
      'clxyz123abc',
    );
    assert.equal(baseMailboxFromReplyTo(replyTo), 'comunicaciones@mali.pe');
  });
});
