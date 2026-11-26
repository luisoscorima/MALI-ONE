import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalEmailAdminSearch,
  campaignRegistryHref,
  malichimpImportXlsxHref,
  malichimpNewsletterEditHref,
  resolveEmailHubTab,
  resolveLegacyEmailAdminRedirect,
  resolveMalichimpTab,
  resolveWorkspaceTab,
  workspaceNewsletterEditHref,
} from './email-admin-routes.ts';

test('legacy path aliases preserve params', () => {
  assert.equal(resolveLegacyEmailAdminRedirect('/admin/mailing', ''), '/admin/email');
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/comunicacion-interna', ''),
    '/admin/workspace?tab=campaigns',
  );
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/newsletters', '?tab=boletines'),
    '/admin/email',
  );
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/newsletters', '?tab=campanas'),
    '/admin/email?tab=campaigns',
  );
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/newsletters', '?tab=remitentes'),
    '/admin/email?tab=senders',
  );
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/users', '?tab=contenido&edit=123'),
    '/admin/workspace?tab=newsletters&edit=123',
  );
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/users', '?tab=campanas&campaign=abc'),
    '/admin/workspace?tab=campaigns&campaign=abc',
  );
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/users', '?tab=directorio'),
    '/admin/workspace',
  );
});

test('legacy routes match router variants and preserve repeated query values', () => {
  assert.equal(
    resolveLegacyEmailAdminRedirect('/ADMIN/USERS/', '?tab=contenido&edit=123&f=a&f=b&empty='),
    '/admin/workspace?tab=newsletters&edit=123&f=a&f=b&empty=',
  );
  assert.equal(
    resolveLegacyEmailAdminRedirect('/admin/comunicacion-interna/', '?campaign=123'),
    '/admin/workspace?tab=campaigns&campaign=123',
  );
});

test('canonical tab queries omit defaults and retain unrelated params', () => {
  const importQuery = new URLSearchParams('tab=audience&import=xlsx&filter=a&filter=b');
  assert.equal(
    canonicalEmailAdminSearch(importQuery, resolveMalichimpTab(importQuery.get('tab')), 'audience')?.toString(),
    'import=xlsx&filter=a&filter=b',
  );
  assert.equal(canonicalEmailAdminSearch(new URLSearchParams('tab=campaigns'), 'campaigns', 'directory'), null);
  assert.equal(
    canonicalEmailAdminSearch(new URLSearchParams('tab=campaigns&tab=directory'), 'campaigns', 'directory')?.toString(),
    'tab=campaigns',
  );
  assert.equal(resolveEmailHubTab('constructor'), 'newsletters');
  assert.equal(resolveMalichimpTab('__proto__'), 'audience');
  assert.equal(resolveWorkspaceTab('toString'), 'directory');
});

test('tab aliases and deep links', () => {
  assert.equal(resolveEmailHubTab('boletines'), 'newsletters');
  assert.equal(resolveMalichimpTab('content'), 'newsletters');
  assert.equal(resolveWorkspaceTab('contenido'), 'newsletters');
  assert.equal(malichimpImportXlsxHref(), '/admin/malichimp?import=xlsx');
  assert.equal(
    malichimpNewsletterEditHref('x'),
    '/admin/malichimp?tab=newsletters&edit=x',
  );
  assert.equal(
    workspaceNewsletterEditHref('x'),
    '/admin/workspace?tab=newsletters&edit=x',
  );
  assert.equal(
    campaignRegistryHref('malichimp', 'c1'),
    '/admin/malichimp?tab=campaigns&campaign=c1',
  );
  assert.equal(
    campaignRegistryHref('internal_workspace', 'c2'),
    '/admin/workspace?tab=campaigns&campaign=c2',
  );
});
