import assert from 'node:assert/strict';
import test from 'node:test';
import { EmailDeliveryService } from './email-delivery.service';
import type { EmailInlineImagesService } from './email-inline-images.service';

function deliveryWith(externalize: EmailInlineImagesService['externalize']) {
  const config = { get: (key: string) => (key === 'AWS_SES_ENABLED' ? 'true' : undefined) };
  const service = new EmailDeliveryService(
    config as never,
    { externalize } as EmailInlineImagesService,
  );
  const sent: string[] = [];
  Object.assign(service, {
    client: {
      send: async (command: { input: { Message: { Body: { Html: { Data: string } } } } }) => {
        sent.push(command.input.Message.Body.Html.Data);
        return { MessageId: 'ses-1' };
      },
    },
  });
  return { service, sent };
}

const message = { to: 'ana@mali.pe', subject: 'Hola', html: '<img src="data:image/png;base64,AAAA">' };

test('sends the html with hosted images', async () => {
  const { service, sent } = deliveryWith(async () => '<img src="https://bucket.test/a.jpg">');
  assert.deepEqual(await service.sendHtml(message), { messageId: 'ses-1' });
  assert.deepEqual(sent, ['<img src="https://bucket.test/a.jpg">']);
});

test('does not reach SES when embedded images cannot be hosted', async () => {
  const { service, sent } = deliveryWith(async () => {
    throw new Error('S3 caído');
  });
  await assert.rejects(() => service.sendHtml(message), /S3 caído/);
  assert.equal(sent.length, 0);
});
