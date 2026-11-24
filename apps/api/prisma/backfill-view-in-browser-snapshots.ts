/**
 * Strips legacy “Ver este correo en el navegador” chrome from:
 * - EmailCampaign.htmlSnapshot (pending/working deliveries still using old /n/:slug)
 * - Newsletter.htmlBody for campaign_working_copy rows
 *
 * Compose/inject already replaces the block at send time; this cleans stored HTML.
 *
 *   pnpm --filter @mali-one/api exec tsx prisma/backfill-view-in-browser-snapshots.ts
 *   pnpm --filter @mali-one/api exec tsx prisma/backfill-view-in-browser-snapshots.ts --dry-run
 */
import { EmailCampaignStatus, PrismaClient } from '@prisma/client';
import { stripViewInBrowserFromHtml } from '../src/core/email-delivery/strip-view-in-browser';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const VIEW_HINT =
  /Ver este correo en el navegador|View(?:\s+this)?\s+email\s+in(?:\s+your)?\s+browser|data-mali-view-in-browser|\/n\//i;

async function main() {
  const campaigns = await prisma.emailCampaign.findMany({
    where: {
      status: {
        in: [
          EmailCampaignStatus.draft,
          EmailCampaignStatus.scheduled,
          EmailCampaignStatus.queued,
          EmailCampaignStatus.sending,
        ],
      },
    },
    select: { id: true, name: true, htmlSnapshot: true, status: true },
  });

  let campaignUpdated = 0;
  for (const row of campaigns) {
    if (!VIEW_HINT.test(row.htmlSnapshot)) continue;
    const next = stripViewInBrowserFromHtml(row.htmlSnapshot);
    if (next === row.htmlSnapshot) continue;
    campaignUpdated += 1;
    console.log(
      `${dryRun ? '[dry-run] ' : ''}campaign ${row.id} (${row.status}) “${row.name}”`,
    );
    if (!dryRun) {
      await prisma.emailCampaign.update({
        where: { id: row.id },
        data: { htmlSnapshot: next },
      });
    }
  }

  const workingCopies = await prisma.newsletter.findMany({
    where: { kind: 'campaign_working_copy' },
    select: { id: true, title: true, htmlBody: true },
  });

  let workingUpdated = 0;
  for (const row of workingCopies) {
    if (!VIEW_HINT.test(row.htmlBody)) continue;
    const next = stripViewInBrowserFromHtml(row.htmlBody);
    if (next === row.htmlBody) continue;
    workingUpdated += 1;
    console.log(
      `${dryRun ? '[dry-run] ' : ''}working copy ${row.id} “${row.title}”`,
    );
    if (!dryRun) {
      await prisma.newsletter.update({
        where: { id: row.id },
        data: {
          htmlBody: next,
          contentRevision: { increment: 1 },
        },
      });
    }
  }

  console.log(
    `Listo: ${campaignUpdated} snapshot(s) de campaña, ${workingUpdated} working copy(ies)${dryRun ? ' (dry-run)' : ''}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
