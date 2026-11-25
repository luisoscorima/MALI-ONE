import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { BadRequestException, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { NewsletterAssetsService } from './newsletter-assets.service';

function mockConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: (key: string) =>
      key in values ? values[key] : key === 'S3_PUBLIC_READ' ? 'true' : undefined,
  };
}

function mockS3(publiclyReadable = true) {
  const calls: Array<{ key: string; mime: string; body: Buffer }> = [];
  return {
    calls,
    deleted: [] as string[],
    async isPubliclyReadable() { return publiclyReadable; },
    async deleteFile(key: string) { this.deleted.push(key); },
    buildNewsletterAssetKey(scope: string, fileName: string) {
      return `newsletters/${scope}/test-${fileName}`;
    },
    async uploadFile(key: string, body: Buffer, mimeType: string) {
      calls.push({ key, mime: mimeType, body });
      return `https://example.test/${key}`;
    },
  };
}

test('rejects and removes an uploaded asset when anonymous reads fail', async () => {
  const s3 = mockS3(false);
  const service = new NewsletterAssetsService(s3 as never, mockConfig() as never);
  const png = await solidPng(16, 16);
  await assert.rejects(() => service.upload({
    originalname: 'private.png',
    mimetype: 'image/png',
    size: png.length,
    buffer: png,
  }), ServiceUnavailableException);
  assert.deepEqual(s3.deleted, [s3.calls[0].key]);
});

test('reports an S3 write rejection separately from anonymous-read errors', async () => {
  const s3 = {
    ...mockS3(),
    async uploadFile() { throw new Error('Access denied'); },
    async isPubliclyReadable() {
      assert.fail('A failed upload has no public asset to check');
    },
  };
  const service = new NewsletterAssetsService(s3 as never, mockConfig() as never);
  const png = await solidPng(16, 16);
  await assert.rejects(() => service.upload({
    originalname: 'denied.png',
    mimetype: 'image/png',
    size: png.length,
    buffer: png,
  }), (error: unknown) => error instanceof ServiceUnavailableException
    && error.message.includes('permisos de escritura'));
});

test('reports the effective configured upload limit within the multipart ceiling', () => {
  const s3 = mockS3();
  const limit = (config: Record<string, string>) =>
    new NewsletterAssetsService(s3 as never, mockConfig(config) as never).maxUploadBytes;
  assert.equal(limit({ UPLOAD_MAX_MB: '25' }), 25 * 1024 * 1024);
  assert.equal(limit({ UPLOAD_MAX_MB: '25', NEWSLETTER_ASSET_MAX_MB: '50' }), 40 * 1024 * 1024);
  assert.equal(limit({ NEWSLETTER_ASSET_MAX_MB: 'invalid' }), 40 * 1024 * 1024);
});

async function solidPng(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 40, b: 80 },
    },
  })
    .png()
    .toBuffer();
}

test('upload optimizes jpeg/png to email-sized jpeg on S3', async () => {
  const png = await solidPng(2400, 1600);

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

test('upload flattens transparent png onto white before jpeg', async () => {
  const transparent = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 0, g: 128, b: 255, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  const s3 = mockS3();
  const service = new NewsletterAssetsService(
    s3 as never,
    mockConfig() as never,
  );

  const result = await service.upload({
    originalname: 'ghost.png',
    mimetype: 'image/png',
    size: transparent.length,
    buffer: transparent,
  });

  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.fileName, 'ghost.jpg');

  const sample = await sharp(s3.calls[0]!.body)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i =
    (Math.floor(sample.info.height / 2) * sample.info.width +
      Math.floor(sample.info.width / 2)) *
    sample.info.channels;
  // Fully transparent source flattened onto white → near-white RGB.
  assert.ok(sample.data[i]! > 240);
  assert.ok(sample.data[i + 1]! > 240);
  assert.ok(sample.data[i + 2]! > 240);
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

test('upload rejects unsupported mime types', async () => {
  const s3 = mockS3();
  const service = new NewsletterAssetsService(
    s3 as never,
    mockConfig() as never,
  );

  await assert.rejects(
    () =>
      service.upload({
        originalname: 'notes.pdf',
        mimetype: 'application/pdf',
        size: 12,
        buffer: Buffer.from('%PDF-fake'),
      }),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match(
        String((err as BadRequestException).message),
        /Formato no permitido/,
      );
      return true;
    },
  );
  assert.equal(s3.calls.length, 0);
});

test('upload rejects files over max size', async () => {
  const png = await solidPng(8, 8);
  const s3 = mockS3();
  const service = new NewsletterAssetsService(
    s3 as never,
    mockConfig({ NEWSLETTER_ASSET_MAX_MB: '1' }) as never,
  );

  await assert.rejects(
    () =>
      service.upload({
        originalname: 'big.png',
        mimetype: 'image/png',
        size: 2 * 1024 * 1024,
        buffer: png,
      }),
    (err: unknown) => {
      assert.ok(err instanceof PayloadTooLargeException);
      assert.match(err.message, /supera 1 MB/);
      return true;
    },
  );
  assert.equal(s3.calls.length, 0);
});

test('upload requires S3_PUBLIC_READ for stable email URLs', async () => {
  const png = await solidPng(8, 8);
  const s3 = mockS3();
  const service = new NewsletterAssetsService(
    s3 as never,
    mockConfig({ S3_PUBLIC_READ: 'false' }) as never,
  );

  await assert.rejects(
    () =>
      service.upload({
        originalname: 'banner.png',
        mimetype: 'image/png',
        size: png.length,
        buffer: png,
      }),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match(
        String((err as BadRequestException).message),
        /S3_PUBLIC_READ/,
      );
      return true;
    },
  );
  assert.equal(s3.calls.length, 0);
});
