/**
 * Scrubs leftover Mailchimp links from already-seeded newsletter drafts.
 *
 *   pnpm --filter @mali-one/api exec tsx prisma/fix-mailchimp-newsletter-links.ts
 *   pnpm --filter @mali-one/api exec tsx prisma/fix-mailchimp-newsletter-links.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';
import {
  htmlStillPointsToMailchimp,
  scrubMailchimpNewsletterHtml,
  SEEDED_MAILCHIMP_ARCHIVE_SLUGS,
} from './lib/scrub-mailchimp-newsletter-html';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const appUrl = (process.env.APP_URL ?? 'https://mali.pe').trim();

const SLUGS = [...new Set(Object.values(SEEDED_MAILCHIMP_ARCHIVE_SLUGS))];

async function main() {
  const rows = await prisma.newsletter.findMany({
    where: { slug: { in: SLUGS } },
    select: { id: true, slug: true, title: true, htmlBody: true },
  });

  console.log(
    JSON.stringify(
      { mode: dryRun ? 'dry-run' : 'apply', appUrl, found: rows.length, expected: SLUGS.length },
      null,
      2,
    ),
  );

  let changed = 0;
  for (const row of rows) {
    const before = htmlStillPointsToMailchimp(row.htmlBody);
    const next = scrubMailchimpNewsletterHtml(row.htmlBody, {
      appUrl,
      slug: row.slug,
    });
    const after = htmlStillPointsToMailchimp(next);
    const dirty = next !== row.htmlBody;

    console.log(
      JSON.stringify({
        slug: row.slug,
        before: before.length,
        after: after.length,
        changed: dirty,
        leftover: after.slice(0, 5),
      }),
    );

    if (!dirty) continue;
    changed += 1;
    if (dryRun) continue;

    await prisma.newsletter.update({
      where: { id: row.id },
      data: { htmlBody: next },
    });
  }

  const missing = SLUGS.filter((slug) => !rows.some((r) => r.slug === slug));
  if (missing.length) {
    console.warn('missing slugs:', missing);
  }
  console.log(dryRun ? `would update ${changed}` : `updated ${changed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
