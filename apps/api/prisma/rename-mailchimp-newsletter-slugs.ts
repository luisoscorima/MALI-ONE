/**
 * Renombra slugs mailchimp-* → sin prefijo, reescribe HTML (S3 + /n/)
 * y copia objetos S3 al nuevo prefijo.
 *
 *   pnpm --filter @mali-one/api exec tsx prisma/rename-mailchimp-newsletter-slugs.ts
 *   pnpm --filter @mali-one/api exec tsx prisma/rename-mailchimp-newsletter-slugs.ts --dry-run
 */
import {
  CopyObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

const RENAMES: Array<{ from: string; to: string }> = [
  {
    from: 'mailchimp-boletin-auditorio-nov-2026',
    to: 'boletin-auditorio-nov-2026',
  },
  {
    from: 'mailchimp-boletin-mensual-nov-2026',
    to: 'boletin-mensual-nov-2026',
  },
  { from: 'mailchimp-boletin-amigos-mali', to: 'boletin-amigos-mali' },
  { from: 'mailchimp-alumnos-noche-mali', to: 'alumnos-noche-mali' },
  { from: 'mailchimp-cursos-ep-ca-cine', to: 'cursos-ep-ca-cine' },
  { from: 'mailchimp-boletin-cursos-arte', to: 'boletin-cursos-arte' },
  {
    from: 'mailchimp-boletin-extension-profesional',
    to: 'boletin-extension-profesional',
  },
  {
    from: 'mailchimp-invitacion-sandra-gamarra-replica',
    to: 'invitacion-sandra-gamarra-replica',
  },
  {
    from: 'mailchimp-asamblea-asociados-2026-1',
    to: 'asamblea-asociados-2026-1',
  },
  {
    from: 'mailchimp-lanzamiento-casa-del-moral',
    to: 'lanzamiento-casa-del-moral',
  },
  { from: 'mailchimp-invitacion-pacchas', to: 'invitacion-pacchas' },
];

async function copyS3Prefix(
  s3: S3Client,
  bucket: string,
  fromPrefix: string,
  toPrefix: string,
): Promise<number> {
  let copied = 0;
  let token: string | undefined;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: fromPrefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of listed.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith('/')) continue;
      const destKey = obj.Key.replace(fromPrefix, toPrefix);
      if (dryRun) {
        copied += 1;
        continue;
      }
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${obj.Key}`,
          Key: destKey,
          MetadataDirective: 'COPY',
        }),
      );
      copied += 1;
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return copied;
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

  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', bucket }, null, 2));

  for (const { from, to } of RENAMES) {
    const row = await prisma.newsletter.findUnique({
      where: { slug: from },
      select: { id: true, htmlBody: true },
    });
    if (!row) {
      const already = await prisma.newsletter.findUnique({
        where: { slug: to },
        select: { id: true },
      });
      console.log(JSON.stringify({ from, to, status: already ? 'already-renamed' : 'missing' }));
      continue;
    }

    const clash = await prisma.newsletter.findUnique({
      where: { slug: to },
      select: { id: true },
    });
    if (clash) {
      console.log(JSON.stringify({ from, to, status: 'target-exists' }));
      continue;
    }

    let htmlBody = row.htmlBody
      .split(`newsletters/${from}/`)
      .join(`newsletters/${to}/`)
      .split(`/n/${from}`)
      .join(`/n/${to}`);

    const s3Copied = await copyS3Prefix(
      s3,
      bucket,
      `newsletters/${from}/`,
      `newsletters/${to}/`,
    );

    if (!dryRun) {
      await prisma.newsletter.update({
        where: { id: row.id },
        data: { slug: to, htmlBody },
      });
    }

    console.log(
      JSON.stringify({
        from,
        to,
        status: dryRun ? 'would-rename' : 'renamed',
        s3Copied,
        stillMailchimp: /mailchimp/i.test(htmlBody),
      }),
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
