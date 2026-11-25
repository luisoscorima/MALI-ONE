import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMAIL_MERGE_FIRST_NAME_FALLBACK,
  applyEmailMergeTags,
  emailSendNames,
  firstNameFromDisplayName,
  resolveEmailFirstName,
} from './email-merge-tags';

test('firstNameFromDisplayName takes the first token', () => {
  assert.equal(firstNameFromDisplayName('Ana López'), 'Ana');
  assert.equal(firstNameFromDisplayName('  María José Pérez  '), 'María');
  assert.equal(firstNameFromDisplayName(null), null);
  assert.equal(firstNameFromDisplayName('   '), null);
});

test('resolveEmailFirstName falls back to estimado(a)', () => {
  assert.equal(resolveEmailFirstName('Ana'), 'Ana');
  assert.equal(resolveEmailFirstName(null), EMAIL_MERGE_FIRST_NAME_FALLBACK);
  assert.equal(resolveEmailFirstName('  '), EMAIL_MERGE_FIRST_NAME_FALLBACK);
});

test('applyEmailMergeTags replaces known first-name placeholders', () => {
  const html = [
    'Hola {{first_name}}',
    'Hola {{FNAME}}',
    'Hola *|FNAME|*',
    'Hola <<First Name>>',
    'Hola <<Test First Name>>',
    'Hola &lt;&lt;First Name&gt;&gt;',
  ].join(' | ');

  assert.equal(
    applyEmailMergeTags(html, { firstName: 'Lucía' }),
    [
      'Hola Lucía',
      'Hola Lucía',
      'Hola Lucía',
      'Hola Lucía',
      'Hola Lucía',
      'Hola Lucía',
    ].join(' | '),
  );
});

test('applyEmailMergeTags uses estimado(a) when name is missing', () => {
  assert.equal(
    applyEmailMergeTags('Hola <<First Name>>,', { firstName: null }),
    `Hola ${EMAIL_MERGE_FIRST_NAME_FALLBACK},`,
  );
});

test('keeps compound names and surnames in separate merge fields', () => {
  const names = emailSendNames({ name: 'María José De la Cruz', firstName: 'María José', lastName: 'De la Cruz' });
  assert.equal(applyEmailMergeTags('{{first_name}} / {{last_name}} / {{firstname}} {{lastname}}', names),
    'María José / De la Cruz / María José De la Cruz');
});

test('uses the available name when the complete name is requested', () => {
  assert.equal(applyEmailMergeTags('Hola, {{first_name}} {{last_name}}', { lastName: 'De la Cruz' }),
    'Hola, De la Cruz');
  assert.equal(applyEmailMergeTags('Hola, {{first_name}} {{last_name}}', { firstName: 'María José' }),
    'Hola, María José');
  assert.equal(applyEmailMergeTags('{{last_name}}', emailSendNames({ name: 'Ana López' })), '');
  assert.equal(applyEmailMergeTags('{{first_name}}', emailSendNames({ name: 'Ana López' })), 'Ana');
});

test('escapes recipient names in HTML', () => {
  assert.equal(applyEmailMergeTags('<p>{{last_name}}</p>', { lastName: 'A & B' }, { html: true }),
    '<p>A &amp; B</p>');
});
