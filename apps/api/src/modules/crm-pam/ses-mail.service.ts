import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class SesMailService {
  private readonly logger = new Logger(SesMailService.name);
  private readonly client: SESClient | null;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey =
      this.config.get<string>('AWS_SECRET_ACCESS_KEY') || '';
    this.fromEmail =
      this.config.get<string>('SES_FROM_EMAIL') || 'noreply@mali.pe';
    this.fromName = this.config.get<string>('SES_FROM_NAME') || 'MALI';

    if (accessKeyId && secretAccessKey) {
      this.client = new SESClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.client = null;
      this.logger.warn('AWS credentials ausentes; SES deshabilitado');
    }
  }

  get configured(): boolean {
    return this.client != null;
  }

  async sendHtml(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<string | undefined> {
    if (!this.client) {
      throw new Error('SES no configurado (faltan credenciales AWS)');
    }

    const result = await this.client.send(
      new SendEmailCommand({
        Source: `${this.fromName} <${this.fromEmail}>`,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: params.subject, Charset: 'UTF-8' },
          Body: { Html: { Data: params.html, Charset: 'UTF-8' } },
        },
      }),
    );

    return result.MessageId;
  }
}
