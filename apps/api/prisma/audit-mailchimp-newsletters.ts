/**
 * One-off audit: Mailchimp / S3 / brand URL residue in seeded newsletters.
 *   pnpm --filter @mali-one/api exec tsx prisma/audit-mailchimp-newsletters.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const patterns: Record<string, RegExp> = {
  mcusercontent: /https?:\/\/[^\s"'<>]*mcusercontent[^\s"'<>]*/gi,
  cdn_mailchimp: /https?:\/\/[^\s"'<>]*cdn-images\.mailchimp[^\s"'<>]*/gi,
  mailchi: /https?:\/\/[^\s"'<>]*mailchi\.mp[^\s"'<>]*/gi,
  listmanage: /https?:\/\/[^\s"'<>]*list-manage[^\s"'<>]*/gi,
  login_mc: /https?:\/\/[^\s"'<>]*login\.mailchimp[^\s"'<>]*/gi,
  s3: /https?:\/\/[^\s"'<>]*mali-one-files\.s3[^\s"'<>]*/gi,
  brands: /https?:\/\/[^\s"'<>]*newsletter-brands[^\s"'<>]*/gi,
};

async function main() {
  const rows = await prisma.newsletter.findMany({
    where: {
      OR: [{ slug: { startsWith: 'mailchimp-' } }, { slug: 'boletin-prueba-ti' }],
    },
    select: { slug: true, brand: true, status: true, htmlBody: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const r of rows) {
    const counts: Record<string, number> = {};
    const samples: Record<string, string[]> = {};
    for (const [k, re] of Object.entries(patterns)) {
      const m = [...r.htmlBody.matchAll(re)].map((x) =>
        x[0].replace(/&amp;/g, '&'),
      );
      counts[k] = m.length;
      samples[k] = [...new Set(m)].slice(0, 5);
    }
    const imgSrcs = [
      ...r.htmlBody.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi),
    ].map((m) => m[1].replace(/&amp;/g, '&'));
    const brokenLikely = imgSrcs.filter(
      (u) =>
        /mailchimp|mcusercontent|mali-one-files\.s3/i.test(u) ||
        u.startsWith('//'),
    );
    console.log(
      JSON.stringify(
        {
          slug: r.slug,
          brand: r.brand,
          status: r.status,
          counts,
          samples,
          imgTotal: imgSrcs.length,
          imgSuspect: [...new Set(brokenLikely)].slice(0, 8),
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
