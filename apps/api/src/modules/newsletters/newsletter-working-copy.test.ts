import assert from 'node:assert/strict';
import test from 'node:test';
import { NewsletterKind, NewsletterScope, NewsletterStatus } from '@prisma/client';
import {
  buildModuleLibraryCreateData,
  contentRevisionOf,
  libraryListWhere,
  moduleLibraryListWhere,
  publishedLibraryWhere,
  scopeForAudienceArea,
  workingCopyListWhere,
} from './newsletter-working-copy';

test('library and public listings never include working copies', () => {
  assert.deepEqual(libraryListWhere(), {
    scope: NewsletterScope.shared,
    kind: NewsletterKind.library,
  });
  assert.deepEqual(publishedLibraryWhere(), {
    scope: NewsletterScope.shared,
    kind: NewsletterKind.library,
    status: NewsletterStatus.published,
  });
  assert.deepEqual(moduleLibraryListWhere(NewsletterScope.malichimp), {
    scope: NewsletterScope.malichimp,
    kind: NewsletterKind.library,
  });
  assert.deepEqual(workingCopyListWhere(NewsletterScope.malichimp), {
    scope: NewsletterScope.malichimp,
    kind: NewsletterKind.campaign_working_copy,
  });
});

test('contentRevision changes when revision or content length changes', () => {
  const base = {
    contentRevision: 1,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    htmlBody: '<p>Hola</p>',
    designJson: null as string | null,
  };
  const a = contentRevisionOf(base);
  const b = contentRevisionOf({ ...base, contentRevision: 2 });
  const c = contentRevisionOf({ ...base, htmlBody: '<p>Hola mundo</p>' });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
});

test('scopeForAudienceArea maps IC and MALICHIMP areas', () => {
  assert.equal(scopeForAudienceArea('malichimp'), NewsletterScope.malichimp);
  assert.equal(
    scopeForAudienceArea('internal_workspace'),
    NewsletterScope.internal_communications,
  );
  assert.equal(scopeForAudienceArea('other'), null);
});

test('buildModuleLibraryCreateData stores brand and malichimp library shape', () => {
  const data = buildModuleLibraryCreateData({
    userId: 'user-1',
    scope: NewsletterScope.malichimp,
    title: 'Pieza',
    subject: 'Asunto',
    htmlBody: '<p>Hola</p>',
    brand: 'museo',
  });
  assert.equal(data.scope, NewsletterScope.malichimp);
  assert.equal(data.kind, NewsletterKind.library);
  assert.equal(data.brand, 'museo');
  assert.equal(data.status, NewsletterStatus.draft);
  assert.match(String(data.slug), /lib-/);
});
