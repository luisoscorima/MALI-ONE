import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const slugs = [
  'mailchimp-boletin-auditorio-nov-2026',
  'mailchimp-alumnos-noche-mali',
  'mailchimp-invitacion-sandra-gamarra-replica',
  'mailchimp-invitacion-pacchas',
  'mailchimp-asamblea-asociados-2026-1',
  'mailchimp-lanzamiento-casa-del-moral',
];

async function main() {
  const rows = await prisma.newsletter.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, htmlBody: true },
  });
  for (const r of rows) {
    const hrefs = [...r.htmlBody.matchAll(/href=["']([^"']+)["']/gi)].map((m) =>
      m[1].replace(/&amp;/g, '&'),
    );
    const srcs = [...r.htmlBody.matchAll(/\bsrc=["']([^"']+)["']/gi)].map((m) =>
      m[1].replace(/&amp;/g, '&'),
    );
    const badHrefs = [
      ...new Set(
        hrefs.filter((h) =>
          /mailchimp|mailchi|list-manage|mcusercontent|eepurl/i.test(h),
        ),
      ),
    ];
    const externalImgs = [
      ...new Set(
        srcs.filter((s) =>
          /mcusercontent|mailchimp|mali-one-files|newsletter-brands/i.test(s),
        ),
      ),
    ];
    console.log(`\n=== ${r.slug} ===`);
    console.log('badHrefs', badHrefs);
    console.log('imgCount', externalImgs.length);
    for (const u of externalImgs.slice(0, 10)) {
      try {
        const res = await fetch(u, { method: 'HEAD', redirect: 'follow' });
        console.log(' ', res.status, u.slice(0, 120));
      } catch (e) {
        console.log('  ERR', String(e).slice(0, 80), u.slice(0, 80));
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
