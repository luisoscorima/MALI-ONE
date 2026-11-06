import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export type HtmlEmailMessage = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromEmail?: string;
  fromName?: string;
};

/**
 * Shared outbound-email engine. Product modules provide recipients and content;
 * this service owns the SES transport and nothing about CRM or audiences.
 */
@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private readonly client: SESClient | null;
  private readonly defaultFromEmail: string;
  private readonly defaultFromName: string;
  readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('AWS_SES_REGION') ||
      this.config.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.config.get<string>('AWS_SES_ACCESS_KEY_ID') ||
      this.config.get<string>('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = this.config.get<string>('AWS_SES_SECRET_ACCESS_KEY') ||
      this.config.get<string>('AWS_SECRET_ACCESS_KEY') || '';
    this.defaultFromEmail =
      this.config.get<string>('SES_FROM_EMAIL') || 'boletines@mali.pe';
    this.defaultFromName = this.config.get<string>('SES_FROM_NAME') || 'MALI';

    this.client = accessKeyId && secretAccessKey
      ? new SESClient({
          region: this.region,
          credentials: { accessKeyId, secretAccessKey },
        })
      : null;
    if (!this.client) this.logger.warn('Motor SES deshabilitado: faltan credenciales');
  }

  get status() {
    return {
      provider: 'aws_ses' as const,
      configured: this.client !== null,
      region: this.region,
      defaultFromEmail: this.defaultFromEmail,
      defaultFromName: this.defaultFromName,
    };
  }

  async sendHtml(message: HtmlEmailMessage): Promise<{ messageId: string | null }> {
    if (!this.client) throw new Error('Motor SES no configurado');
    const fromEmail = message.fromEmail?.trim() || this.defaultFromEmail;
    const fromName = message.fromName?.trim() || this.defaultFromName;
    const result = await this.client.send(
      new SendEmailCommand({
        Source: `${fromName} <${fromEmail}>`,
        Destination: { ToAddresses: [message.to.trim().toLowerCase()] },
        ReplyToAddresses: message.replyTo ? [message.replyTo.trim()] : undefined,
        Message: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: { Html: { Data: message.html, Charset: 'UTF-8' } },
        },
      }),
    );
    return { messageId: result.MessageId ?? null };
  }
}
