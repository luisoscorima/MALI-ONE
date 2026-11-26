import { createHash, randomUUID } from 'crypto';
import type {
  NewsletterBrand,
  NewsletterKind,
  NewsletterScope,
  Prisma,
} from '@prisma/client';
import { NewsletterKind as Kind, NewsletterScope as Scope, NewsletterStatus } from '@prisma/client';

export type WorkingCopyScope =
  | typeof Scope.malichimp
  | typeof Scope.internal_communications;

export function duplicateNewsletterSlug(value: string, mark = 'wc'): string {
  const suffix = `${mark}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const base = value
    .slice(0, 80 - suffix.length - 1)
    .replace(/-+$/g, '');
  return `${base}-${suffix}`;
}

export function duplicateLabel(value: string, maxLength: number): string {
  const suffix = ' — copia';
  return `${value.slice(0, maxLength - suffix.length).trimEnd()}${suffix}`;
}

export function contentRevisionOf(row: {
  contentRevision: number;
  updatedAt: Date;
  htmlBody: string;
  designJson: string | null;
}): string {
  return createHash('sha256')
    .update(
      `${row.contentRevision}:${row.updatedAt.toISOString()}:${row.htmlBody.length}:${row.designJson?.length ?? 0}`,
    )
    .digest('hex')
    .slice(0, 32);
}

export function catalogListWhere(): Prisma.NewsletterWhereInput {
  return {
    scope: Scope.shared,
    kind: Kind.catalog,
  };
}

export function publishedCatalogWhere(): Prisma.NewsletterWhereInput {
  return {
    ...catalogListWhere(),
    status: NewsletterStatus.published,
  };
}

/** Module-scoped catalog (e.g. MALICHIMP Contenido), not shared Boletines. */
export function moduleCatalogListWhere(
  scope: WorkingCopyScope,
): Prisma.NewsletterWhereInput {
  return {
    scope,
    kind: Kind.catalog,
  };
}

export function workingCopyListWhere(
  scope: WorkingCopyScope,
): Prisma.NewsletterWhereInput {
  return {
    scope,
    kind: Kind.campaign_working_copy,
  };
}

export function buildModuleCatalogCreateData(input: {
  userId: string;
  scope: WorkingCopyScope;
  title: string;
  subject: string;
  htmlBody: string;
  designJson?: string | null;
  brand?: NewsletterBrand | null;
  slugBase?: string;
}): Prisma.NewsletterCreateInput {
  const slugBase = input.slugBase?.trim() || input.title || 'contenido';
  return {
    slug: duplicateNewsletterSlug(slugBase, 'cat'),
    title: input.title.slice(0, 200),
    subject: input.subject.slice(0, 200),
    htmlBody: input.htmlBody,
    designJson: input.designJson ?? null,
    brand: input.brand ?? null,
    status: NewsletterStatus.draft,
    scope: input.scope,
    kind: Kind.catalog as NewsletterKind,
    contentRevision: 1,
    createdBy: { connect: { id: input.userId } },
  };
}

export function buildWorkingCopyCreateData(input: {
  userId: string;
  scope: WorkingCopyScope;
  sourceNewsletterId: string | null;
  title: string;
  subject: string;
  htmlBody: string;
  designJson?: string | null;
  brand?: NewsletterBrand | null;
  slugBase: string;
}): Prisma.NewsletterCreateInput {
  return {
    slug: duplicateNewsletterSlug(input.slugBase, 'wc'),
    title: input.title.slice(0, 200),
    subject: input.subject.slice(0, input.scope === Scope.malichimp ? 300 : 200),
    htmlBody: input.htmlBody,
    designJson: input.designJson ?? null,
    brand: input.brand ?? null,
    status: NewsletterStatus.draft,
    scope: input.scope,
    kind: Kind.campaign_working_copy as NewsletterKind,
    contentRevision: 1,
    createdBy: { connect: { id: input.userId } },
    ...(input.sourceNewsletterId
      ? { sourceNewsletter: { connect: { id: input.sourceNewsletterId } } }
      : {}),
  };
}

export function scopeForAudienceArea(
  audienceArea: string,
): WorkingCopyScope | null {
  if (audienceArea === 'malichimp') return Scope.malichimp;
  if (audienceArea === 'internal_workspace') return Scope.internal_communications;
  return null;
}
