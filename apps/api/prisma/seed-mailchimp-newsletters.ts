/**
 * Importa campaigns públicas de Mailchimp como borradores de Boletines:
 * - rehost de imágenes/GIFs a S3 (mali-one-files/newsletters/…)
 * - brand opcional + logos de chrome
 * - idempotente por slug
 *
 * Uso:
 *   pnpm --filter @mali-one/api exec tsx prisma/seed-mailchimp-newsletters.ts
 *   pnpm --filter @mali-one/api exec tsx prisma/seed-mailchimp-newsletters.ts --dry-run
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  NewsletterBrand,
  NewsletterStatus,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { scrubMailchimpNewsletterHtml } from './lib/scrub-mailchimp-newsletter-html';

type CampaignSpec = {
  slug: string;
  title: string;
  brand: NewsletterBrand;
  sourceUrl: string;
};

const CAMPAIGNS: CampaignSpec[] = [
  {
    slug: 'mailchimp-boletin-auditorio-nov-2026',
    title: 'Boletín Auditorio — Noviembre 2026',
    brand: NewsletterBrand.museo,
    sourceUrl: 'https://mailchi.mp/mali/boletinnoviembre2026-7706881',
  },
  {
    slug: 'mailchimp-boletin-mensual-nov-2026',
    title: 'Boletín mensual MALI — Noviembre 2026',
    brand: NewsletterBrand.museo,
    sourceUrl: 'https://mailchi.mp/mali/boletinmarzo2026-7706953',
  },
  {
    slug: 'mailchimp-boletin-amigos-mali',
    title: 'Boletín Amigos MALI',
    brand: NewsletterBrand.museo,
    sourceUrl: 'https://mailchi.mp/mali/boletinmarzo2026-7706798',
  },
  {
    slug: 'mailchimp-alumnos-noche-mali',
    title: 'Alumnos MALI — Noche MALI',
    brand: NewsletterBrand.cursos_arte,
    sourceUrl: 'https://mailchi.mp/mali/cursosdearte-iniciaenmayo-7706891',
  },
  {
    slug: 'mailchimp-cursos-ep-ca-cine',
    title: 'Cursos EP/CA — Marco legal del cine',
    brand: NewsletterBrand.extension_profesional,
    sourceUrl:
      'https://mailchi.mp/mali/llena-tu-hogar-de-arte-con-los-cursos-del-mali-7706753',
  },
  {
    slug: 'mailchimp-boletin-cursos-arte',
    title: 'Boletín Cursos de Arte',
    brand: NewsletterBrand.cursos_arte,
    sourceUrl: 'https://mailchi.mp/mali/cursosdearte-iniciaenmayo-7706142',
  },
  {
    slug: 'mailchimp-boletin-extension-profesional',
    title: 'Boletín Extensión Profesional',
    brand: NewsletterBrand.extension_profesional,
    sourceUrl:
      'https://mailchi.mp/mali/llena-tu-hogar-de-arte-con-los-cursos-del-mali-7706140',
  },
];

const brandLogosDir =
  process.env.BRAND_LOGOS_DIR?.trim() ||
  path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../../../outputs/newsletter-mailchimp-import/brands',
  );

const BRAND_LOGOS: Array<{ brand: NewsletterBrand; fileName: string; local: string }> = [
  {
    brand: NewsletterBrand.cursos_arte,
    fileName: 'cursos_arte-logo.png',
    local: path.join(brandLogosDir, 'cursos_arte-logo.png'),
  },
  {
    brand: NewsletterBrand.extension_profesional,
    fileName: 'extension_profesional-logo.png',
    local: path.join(brandLogosDir, 'extension_profesional-logo.png'),
  },
  {
    brand: NewsletterBrand.museo,
    fileName: 'museo-logo.png',
    local: path.join(brandLogosDir, 'museo-logo.png'),
  },
];

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
/** Upload to S3 but keep Mailchimp CDN urls in HTML (bucket may block public GetObject). */
const keepSourceUrls = process.argv.includes('--keep-source-urls');
const force = process.argv.includes('--force');

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractSubject(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const cleaned = decodeHtmlEntities(title)
    .replace(/<<\s*Test First Name\s*>>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 200) || 'Boletín MALI';
}

/** Remove a nested HTML element by id (Mailchimp archive chrome, etc.). */
function removeElementById(html: string, elementId: string): string {
  const open = html.match(
    new RegExp(
      `<([a-z0-9]+)([^>]*\\bid=["']${elementId}["'][^>]*)>`,
      'i',
    ),
  );
  if (!open || open.index === undefined) return html;

  const tag = open[1].toLowerCase();
  const start = open.index;
  let cursor = start + open[0].length;
  const voidTags = new Set([
    'img',
    'br',
    'hr',
    'input',
    'meta',
    'link',
    'area',
    'base',
    'col',
    'embed',
    'source',
    'track',
    'wbr',
  ]);
  if (voidTags.has(tag)) {
    return html.slice(0, start) + html.slice(cursor);
  }

  let depth = 1;
  const tokenRe = new RegExp(`</?${tag}\\b[^>]*>`, 'gi');
  tokenRe.lastIndex = cursor;
  while (depth > 0) {
    const token = tokenRe.exec(html);
    if (!token) break;
    const value = token[0];
    if (/^<\//.test(value)) depth -= 1;
    else if (!/\/>$/.test(value)) depth += 1;
    cursor = tokenRe.lastIndex;
  }
  return html.slice(0, start) + html.slice(cursor);
}

function extractBodyHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch?.[1] ?? html;

  // Mailchimp public archive chrome (share bar + Translate language list).
  body = removeElementById(body, 'awesomewrap');
  body = removeElementById(body, 'awesomeshare');
  body = removeElementById(body, 'awesomebar');
  body = removeElementById(body, 'canspamBarWrapper');
  body = removeElementById(body, 'templateHeaderBar');

  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    // Hidden preview / archive-only bits
    .replace(
      /<span[^>]*class=["'][^"']*mcnPreviewText[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
      '',
    )
    .replace(/https:\/\/cdn-images\.mailchimp\.com\/monkey_rewards\/[^"'\s]+/gi, '')
    .replace(/\|\s*MC_PREVIEW_TEXT\s*\|/gi, '')
    .replace(/\*\|[A-Z0-9_]+\|\*/g, '')
    .replace(/<<\s*Test First Name\s*>>/gi, '')
    .replace(/&lt;&lt;\s*Test First Name\s*&gt;&gt;/gi, '')
    // Leftover translate links if chrome markup varies
    .replace(
      /https?:\/\/translate\.google\.com\/translate\?[^"'\\\s>]+/gi,
      '',
    );

  return body.trim();
}

function scrubImportedHtml(html: string, slug: string): string {
  const appUrl = (process.env.APP_URL ?? 'https://mali.pe').trim();
  return scrubMailchimpNewsletterHtml(html, { appUrl, slug });
}

function collectAssetUrls(html: string): string[] {
  const urls = new Set<string>();
  const re =
    /https:\/\/(?:mcusercontent\.com|cdn-images\.mailchimp\.com)\/[^"'\\\s>]+\.(?:png|jpe?g|gif|webp)/gi;
  for (const match of html.matchAll(re)) {
    urls.add(match[0].replace(/&amp;/g, '&'));
  }
  return [...urls];
}

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

async function download(url: string): Promise<{ buffer: Buffer; fileName: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MALI-ONE-newsletter-import/1.0' },
  });
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const base = url.split('?')[0].split('/').pop() || `${randomUUID()}.bin`;
  return { buffer, fileName: base };
}

async function main() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const bucket = process.env.AWS_S3_BUCKET || 'mali-one-files';
  const publicRead = (process.env.S3_PUBLIC_READ || 'true') === 'true';
  if (!publicRead) {
    throw new Error('S3_PUBLIC_READ debe ser true para imágenes de correo');
  }

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

  const ownerEmail = process.env.SEED_NEWSLETTER_OWNER_EMAIL?.trim().toLowerCase();
  const owner = ownerEmail
    ? await prisma.user.findUnique({ where: { email: ownerEmail } })
    : await prisma.user.findFirst({
        where: { role: UserRole.admin },
        orderBy: { createdAt: 'asc' },
      });
  if (!owner) {
    throw new Error(
      'No hay admin para asignar. Define SEED_NEWSLETTER_OWNER_EMAIL.',
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? 'dry-run' : 'apply',
        bucket,
        region,
        owner: owner.email,
        campaigns: CAMPAIGNS.length,
      },
      null,
      2,
    ),
  );

  const brandLogoUrls: Partial<Record<NewsletterBrand, string>> = {};
  for (const logo of BRAND_LOGOS) {
    const key = `newsletters/brands/${logo.fileName}`;
    const url = publicUrl(bucket, region, key);
    brandLogoUrls[logo.brand] = url;
    if (dryRun) {
      console.log(`[dry-run] brand logo -> ${url}`);
      continue;
    }
    const body = await readFile(logo.local);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    console.log(`brand logo uploaded: ${url}`);
  }

  for (const campaign of CAMPAIGNS) {
    const existing = await prisma.newsletter.findUnique({
      where: { slug: campaign.slug },
      select: { id: true, updatedAt: true },
    });
    if (existing && !force) {
      console.log(`skip existing slug=${campaign.slug}`);
      continue;
    }

    console.log(`fetch ${campaign.sourceUrl}`);
    const page = await fetch(campaign.sourceUrl, {
      headers: { 'User-Agent': 'MALI-ONE-newsletter-import/1.0' },
    });
    if (!page.ok) {
      throw new Error(`Falló ${campaign.sourceUrl}: ${page.status}`);
    }
    const rawHtml = await page.text();
    const subject = extractSubject(rawHtml);
    let htmlBody = scrubImportedHtml(extractBodyHtml(rawHtml), campaign.slug);
    const assetUrls = collectAssetUrls(htmlBody);
    console.log(`  assets=${assetUrls.length} subject="${subject.slice(0, 80)}"`);

    const replacements = new Map<string, string>();
    for (const assetUrl of assetUrls) {
      if (dryRun) {
        const hash = createHash('sha1').update(assetUrl).digest('hex').slice(0, 10);
        replacements.set(
          assetUrl,
          publicUrl(
            bucket,
            region,
            `newsletters/${campaign.slug}/${hash}-asset`,
          ),
        );
        continue;
      }
      const { buffer, fileName } = await download(assetUrl);
      const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
      const key = `newsletters/${campaign.slug}/${hash}-${fileName}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: guessMime(fileName),
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      if (!keepSourceUrls) {
        replacements.set(assetUrl, publicUrl(bucket, region, key));
      }
    }

    for (const [from, to] of replacements) {
      htmlBody = htmlBody.split(from).join(to);
      htmlBody = htmlBody.split(from.replace(/&/g, '&amp;')).join(to);
    }

    if (dryRun) {
      console.log(`[dry-run] would create ${campaign.slug} brand=${campaign.brand}`);
      continue;
    }

    if (existing && force) {
      await prisma.newsletter.update({
        where: { slug: campaign.slug },
        data: {
          title: campaign.title,
          subject,
          htmlBody,
          designJson: null,
          brand: campaign.brand,
          status: NewsletterStatus.draft,
        },
      });
      console.log(`updated draft ${campaign.slug}`);
    } else {
      await prisma.newsletter.create({
        data: {
          slug: campaign.slug,
          title: campaign.title,
          subject,
          htmlBody,
          designJson: null,
          brand: campaign.brand,
          status: NewsletterStatus.draft,
          createdById: owner.id,
        },
      });
      console.log(`created draft ${campaign.slug}`);
    }
  }

  console.log('done', { brandLogoUrls });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
