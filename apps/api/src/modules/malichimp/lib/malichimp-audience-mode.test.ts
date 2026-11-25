import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MALICHIMP_AUDIENCE_MODE,
  resolveMalichimpAudienceMode,
} from './malichimp-audience-mode';

test('resolveMalichimpAudienceMode defaults legacy null/undefined to groups', () => {
  assert.equal(resolveMalichimpAudienceMode(null), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode(undefined), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode(''), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode('weird'), MALICHIMP_AUDIENCE_MODE.groups);
});

test('resolveMalichimpAudienceMode accepts groups tags emails', () => {
  assert.equal(resolveMalichimpAudienceMode('groups'), MALICHIMP_AUDIENCE_MODE.groups);
  assert.equal(resolveMalichimpAudienceMode('tags'), MALICHIMP_AUDIENCE_MODE.tags);
  assert.equal(resolveMalichimpAudienceMode('emails'), MALICHIMP_AUDIENCE_MODE.emails);
});
