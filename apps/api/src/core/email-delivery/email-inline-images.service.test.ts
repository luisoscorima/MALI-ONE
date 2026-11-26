import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { EmailInlineImagesService } from './email-inline-images.service';

function mockConfig(publicRead = 'true') {
  return { get: (key: string) => (key === 'S3_PUBLIC_READ' ? publicRead : undefined) };
}

function mockS3(publiclyReadable = true) {
  const uploads: Array<{ key: string; mime: string }> = [];
  return {
    uploads,
    async uploadFile(key: string, _body: Buffer, mime: string) {
      uploads.push({ key, mime });
      return `https://bucket.test/${key}`;
    },
    async isPubliclyReadable() { return publiclyReadable; },
  };
}

async function pngDataUri(color: { r: number; g: number; b: number }) {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: color } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

test('replaces each embedded image with one hosted jpeg and reuses repeats', async () => {
  const s3 = mockS3();
  const service = new EmailInlineImagesService(s3 as never, mockConfig() as never);
  const red = await pngDataUri({ r: 255, g: 0, b: 0 });
  const blue = await pngDataUri({ r: 0, g: 0, b: 255 });
  const html = `<img src="${red}"><img src="${blue}"><td style="background:url(${red})">`;

  const first = await service.externalize(html);
  const second = await service.externalize(html);

  assert.doesNotMatch(first, /data:image/);
  assert.equal(second, first);
  assert.equal(s3.uploads.length, 2);
  for (const upload of s3.uploads) {
    assert.match(upload.key, /^newsletters\/inline\/[a-f0-9]{64}\.jpg$/);
    assert.equal(upload.mime, 'image/jpeg');
  }
  const urls = [...first.matchAll(/https:\/\/bucket\.test\/[^")]+/g)].map(([url]) => url);
  assert.equal(urls.length, 3);
  assert.equal(urls[0], urls[2]);
});

test('accepts base64 wrapped with raw or escaped line breaks', async () => {
  const s3 = mockS3();
  const service = new EmailInlineImagesService(s3 as never, mockConfig() as never);
  const uri = await pngDataUri({ r: 10, g: 200, b: 10 });
  const [prefix, payload] = uri.split(',');
  const wrapped = (separator: string) =>
    `${prefix},${payload.match(/.{1,40}/g)!.join(separator)}`;

  const outputs = [];
  for (const separator of ['\n', '\r\n', '\\n', '\\r\\n']) {
    outputs.push(await service.externalize(`<img src="${wrapped(separator)}">`));
  }

  assert.equal(new Set(outputs).size, 1);
  assert.match(outputs[0], /^<img src="https:\/\/bucket\.test\/newsletters\/inline\/[a-f0-9]{64}\.jpg">$/);
  assert.equal(s3.uploads.length, 1);
  assert.equal(await service.externalize(`<img src="${uri}">`), outputs[0]);
});

test('leaves html without embedded images untouched and skips S3', async () => {
  const s3 = mockS3();
  const service = new EmailInlineImagesService(s3 as never, mockConfig('false') as never);
  const html = '<img src="https://mali.pe/banner.jpg">';
  assert.equal(await service.externalize(html), html);
  assert.equal(s3.uploads.length, 0);
});

test('keeps unsupported formats such as svg embedded', async () => {
  const s3 = mockS3();
  const service = new EmailInlineImagesService(s3 as never, mockConfig() as never);
  const html = '<img src="data:image/svg+xml;base64,PHN2Zy8+">';
  assert.equal(await service.externalize(html), html);
  assert.equal(s3.uploads.length, 0);
});

test('fails instead of linking images that anonymous readers cannot open', async () => {
  const service = new EmailInlineImagesService(mockS3(false) as never, mockConfig() as never);
  const html = `<img src="${await pngDataUri({ r: 0, g: 255, b: 0 })}">`;
  await assert.rejects(() => service.externalize(html), /no es pública/);
});

test('requires public S3 reads so hosted images never expire', async () => {
  const service = new EmailInlineImagesService(mockS3() as never, mockConfig('false') as never);
  const html = `<img src="${await pngDataUri({ r: 0, g: 0, b: 0 })}">`;
  await assert.rejects(() => service.externalize(html), /S3_PUBLIC_READ/);
});
