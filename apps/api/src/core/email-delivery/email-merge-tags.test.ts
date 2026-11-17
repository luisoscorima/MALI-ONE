import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMAIL_MERGE_FIRST_NAME_FALLBACK,
  applyEmailMergeTags,
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
