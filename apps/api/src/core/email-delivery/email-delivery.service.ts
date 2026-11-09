import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { optionalAwsCredentials } from '../aws/aws-client-options';

export type HtmlEmailMessage = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromEmail?: string;
  fromName?: string;
  tags?: Record<string, string>;
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
  private readonly configurationSet: string;
  readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('AWS_SES_REGION') ||
      this.config.get<string>('AWS_REGION') || 'us-east-1';
    const credentials = optionalAwsCredentials(this.config, 'AWS_SES');
    const enabled = this.config.get<string>('AWS_SES_ENABLED') === 'true' ||
      credentials !== undefined;
    this.defaultFromEmail =
      this.config.get<string>('SES_FROM_EMAIL') || 'boletines@mali.pe';
    this.defaultFromName = this.config.get<string>('SES_FROM_NAME') || 'MALI';
    this.configurationSet =
      this.config.get<string>('AWS_SES_CONFIGURATION_SET') ||
      'mali-one-newsletters';

    this.client = enabled
      ? new SESClient({
          region: this.region,
          ...(credentials ? { credentials } : {}),
        })
      : null;
    if (!this.client) {
      this.logger.warn('Motor SES deshabilitado: AWS_SES_ENABLED no está activo');
    }
  }

  get status() {
    return {
      provider: 'aws_ses' as const,
      configured: this.client !== null,
      region: this.region,
      defaultFromEmail: this.defaultFromEmail,
      defaultFromName: this.defaultFromName,
      configurationSet: this.configurationSet,
    };
  }

  async sendHtml(message: HtmlEmailMessage): Promise<{ messageId: string | null }> {
    if (!this.client) throw new Error('Motor SES no configurado');
    const fromEmail = message.fromEmail?.trim() || this.defaultFromEmail;
    const fromName = message.fromName?.trim() || this.defaultFromName;
    const tags = Object.entries(message.tags ?? {}).map(([Name, Value]) => ({
      Name,
      Value,
    }));
    const result = await this.client.send(
      new SendEmailCommand({
        Source: `${fromName} <${fromEmail}>`,
        ConfigurationSetName: this.configurationSet,
        Tags: tags.length ? tags : undefined,
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
