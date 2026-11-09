import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteMessageBatchCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { optionalAwsCredentials } from '../aws/aws-client-options';
import { SesEventProcessorService } from './ses-event-processor.service';

@Injectable()
export class SesEventConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SesEventConsumerService.name);
  private readonly queueUrl: string;
  private readonly client: SQSClient | null;
  private running = false;
  private receiveAbort: AbortController | null = null;

  constructor(
    config: ConfigService,
    private readonly processor: SesEventProcessorService,
  ) {
    this.queueUrl = config.get<string>('AWS_SES_EVENTS_QUEUE_URL')?.trim() ?? '';
    if (!this.queueUrl) {
      this.client = null;
      return;
    }
    const region =
      config.get<string>('AWS_SES_REGION') ||
      config.get<string>('AWS_REGION') ||
      'us-east-1';
    const credentials = optionalAwsCredentials(config, 'AWS_SES');
    this.client = new SQSClient({
      region,
      ...(credentials ? { credentials } : {}),
    });
  }

  onModuleInit() {
    if (!this.client) {
      this.logger.warn('Consumidor SES/SQS deshabilitado: falta AWS_SES_EVENTS_QUEUE_URL');
      return;
    }
    this.running = true;
    void this.consumeLoop();
  }

  onModuleDestroy() {
    this.running = false;
    this.receiveAbort?.abort();
    this.client?.destroy();
  }

  get status() {
    let queueName: string | null = null;
    if (this.queueUrl) {
      try {
        queueName = new URL(this.queueUrl).pathname.split('/').filter(Boolean).at(-1) ?? null;
      } catch {
        queueName = null;
      }
    }
    return {
      configured: this.client !== null,
      running: this.running,
      queueName,
    };
  }

  private async consumeLoop() {
    this.logger.log('Consumidor SES/SQS iniciado');
    while (this.running && this.client) {
      try {
        this.receiveAbort = new AbortController();
        const response = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 120,
          }),
          { abortSignal: this.receiveAbort.signal },
        );
        this.receiveAbort = null;
        const messages = response.Messages ?? [];
        if (!messages.length) continue;

        const processed = await Promise.all(
          messages.map(async (message, index) => {
            if (!message.Body || !message.ReceiptHandle) return null;
            try {
              await this.processor.process(JSON.parse(message.Body));
              return {
                Id: message.MessageId ?? String(index),
                ReceiptHandle: message.ReceiptHandle,
              };
            } catch (error) {
              this.logger.error(
                `Evento SES no procesado (${message.MessageId ?? 'sin-id'}): ${
                  error instanceof Error ? error.message : String(error)
                }`,
              );
              return null;
            }
          }),
        );
        const entries = processed.filter(Boolean) as Array<{
          Id: string;
          ReceiptHandle: string;
        }>;
        if (entries.length) {
          const deleted = await this.client.send(
            new DeleteMessageBatchCommand({
              QueueUrl: this.queueUrl,
              Entries: entries,
            }),
          );
          if (deleted.Failed?.length) {
            this.logger.error(
              `SQS no eliminó ${deleted.Failed.length} evento(s) procesado(s)`,
            );
          }
        }
      } catch (error) {
        this.receiveAbort = null;
        if (!this.running) break;
        this.logger.error(
          `Error leyendo SES/SQS: ${error instanceof Error ? error.message : String(error)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }
    this.logger.log('Consumidor SES/SQS detenido');
  }
}
