/**
 * Scrubs leftover Mailchimp links/assets from seeded newsletters:
 * - rewrites mailchi.mp / list-manage / social CDN
 * - rehosts mcusercontent / cdn-images.mailchimp images → S3
 * - normalizes First Name → {{first_name}}
 *
 *   pnpm --filter @mali-one/api exec tsx prisma/fix-mailchimp-newsletter-links.ts
 *   pnpm --filter @mali-one/api exec tsx prisma/fix-mailchimp-newsletter-links.ts --dry-run
 */
import { createHash, randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import {
  htmlStillPointsToMailchimp,
  scrubMailchimpNewsletterHtml,
  SEEDED_MAILCHIMP_ARCHIVE_SLUGS,
} from './lib/scrub-mailchimp-newsletter-html';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const appUrl = (process.env.APP_URL ?? 'https://dev.mali.pe').trim();

const SLUGS = [
  ...new Set([
    ...Object.values(SEEDED_MAILCHIMP_ARCHIVE_SLUGS),
    // Keep legacy rows even if the map drifts.
  ]),
];

const ASSET_RE =
  /https:\/\/(?:mcusercontent\.com|cdn-images\.mailchimp\.com)\/[^"'\\\s>]+\.(?:png|jpe?g|gif|webp)/gi;

function guessMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpeg') || lower.endsWith('.jpg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function publicUrl(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function collectAssetUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(ASSET_RE)) {
    urls.add(match[0].replace(/&amp;/g, '&'));
  }
  return [...urls];
}

async function download(url: string): Promise<{ buffer: Buffer; fileName: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MALI-ONE-newsletter-fix/1.0' },
  });
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const base = url.split('?')[0].split('/').pop() || `${randomUUID()}.bin`;
  return { buffer, fileName: base };
}

async function main() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.AWS_S3_BUCKET || 'mali-one-files';

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();
  const s3 = new S3Client({
    region,
    ...(accessKeyId && secretAccessKey
      ? {
          credentials: {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
          },
        }
      : {}),
  });

  const rows = await prisma.newsletter.findMany({
    where: {
      OR: [{ slug: { in: SLUGS } }, { slug: { startsWith: 'mailchimp-' } }],
    },
    select: { id: true, slug: true, title: true, htmlBody: true },
  });

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'apply',
        appUrl,
        bucket,
        found: rows.length,
        expectedMap: SLUGS.length,
      },
      null,
      2,
    ),
  );

  let changed = 0;
  for (const row of rows) {
    let htmlBody = row.htmlBody;
    const assetUrls = collectAssetUrls(htmlBody);
    const replacements = new Map<string, string>();

    for (const assetUrl of assetUrls) {
      if (dryRun) {
        const hash = createHash('sha1').update(assetUrl).digest('hex').slice(0, 10);
        replacements.set(
          assetUrl,
          publicUrl(bucket, region, `newsletters/${row.slug}/${hash}-asset`),
        );
        continue;
      }
      const { buffer, fileName } = await download(assetUrl);
      const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
      const key = `newsletters/${row.slug}/${hash}-${fileName}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: guessMime(fileName),
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      replacements.set(assetUrl, publicUrl(bucket, region, key));
    }

    for (const [from, to] of replacements) {
      htmlBody = htmlBody.split(from).join(to);
      htmlBody = htmlBody.split(from.replace(/&/g, '&amp;')).join(to);
    }

    const before = htmlStillPointsToMailchimp(row.htmlBody);
    const next = scrubMailchimpNewsletterHtml(htmlBody, {
      appUrl,
      slug: row.slug,
    });
    const after = htmlStillPointsToMailchimp(next);
    const dirty = next !== row.htmlBody;

    console.log(
      JSON.stringify({
        slug: row.slug,
        assetsRehosted: assetUrls.length,
        before: before.length,
        after: after.length,
        changed: dirty,
        leftover: after.slice(0, 5),
        firstNameLeft: /First Name|\*\|FNAME\|\*/i.test(next),
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
