import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { NewsletterAssetsService } from './newsletter-assets.service';

function mockConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: (key: string) => values[key],
  };
}

function mockS3() {
  const calls: Array<{ key: string; mime: string; bytes: number }> = [];
  return {
    calls,
    buildNewsletterAssetKey(scope: string, fileName: string) {
      return `newsletters/${scope}/test-${fileName}`;
    },
    async uploadFile(key: string, body: Buffer, mimeType: string) {
      calls.push({ key, mime: mimeType, bytes: body.length });
      return `https://example.test/${key}`;
    },
  };
}

test('upload optimizes jpeg/png to email-sized jpeg on S3', async () => {
  const png = await sharp({
    create: {
      width: 2400,
      height: 1600,
      channels: 3,
      background: { r: 20, g: 40, b: 80 },
    },
  })
    .png()
    .toBuffer();

  const s3 = mockS3();
  const service = new NewsletterAssetsService(
    s3 as never,
    mockConfig({ NEWSLETTER_ASSET_MAX_MB: '40' }) as never,
  );

  const result = await service.upload(
    {
      originalname: 'banner.png',
      mimetype: 'image/png',
      size: png.length,
      buffer: png,
    },
    'cmwvcclef000vp901rg20i1rk',
  );

  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.fileName, 'banner.jpg');
  assert.ok((result.width ?? 0) <= 1600);
  assert.ok((result.height ?? 0) <= 1600);
  assert.ok(result.optimizedBytes < result.originalBytes);
  assert.match(result.url, /newsletters\/cmwvcclef000vp901rg20i1rk\//);
  assert.equal(s3.calls.length, 1);
  assert.equal(s3.calls[0]?.mime, 'image/jpeg');
});

test('upload keeps gif bytes and sanitizes scope', async () => {
  const gif = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
  );
  const s3 = mockS3();
  const service = new NewsletterAssetsService(
    s3 as never,
    mockConfig() as never,
  );

  const result = await service.upload(
    {
      originalname: 'dot.gif',
      mimetype: 'image/gif',
      size: gif.length,
      buffer: gif,
    },
    'weird scope!!',
  );

  assert.equal(result.mimeType, 'image/gif');
  assert.equal(result.optimizedBytes, gif.length);
  assert.match(result.key, /^newsletters\/weird_scope__\//);
});
