import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { existsSync, readFileSync, statSync } from 'fs';
import { google, gmail_v1 } from 'googleapis';
import { isBackgroundProcess } from '../process-role';
import { PrismaService } from '../prisma/prisma.service';
import {
  baseMailboxFromReplyTo,
  extractSendIdFromReplyAddress,
} from './malichimp-reply-to';

/** Align with Gmail search `newer_than:14d` below. */
export const REPLY_SYNC_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Marks EmailSend.repliedAt when a reply lands in a @mali.pe Workspace mailbox.
 * Does not store message bodies. Requires domain-wide Gmail readonly delegation.
 */
@Injectable()
export class GmailReplySyncService {
  private readonly logger = new Logger(GmailReplySyncService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private enabled(): boolean {
    const flag = (this.config.get<string>('GOOGLE_GMAIL_REPLY_SYNC') ?? '')
      .trim()
      .toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
  }

  @Cron('*/5 * * * *')
  async pollReplies() {
    if (!isBackgroundProcess()) return;
    if (!this.enabled() || this.running) return;
    this.running = true;
    try {
      await this.syncOnce();
    } catch (error) {
      this.logger.error(
        'Gmail reply sync failed',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  async syncOnce() {
    const mailboxes = await this.listReplyMailboxes();
    if (!mailboxes.length) return;

    let marked = 0;
    for (const mailbox of mailboxes) {
      marked += await this.syncMailbox(mailbox);
    }
    if (marked > 0) {
      this.logger.log(`Marked ${marked} campaign reply(ies) from Gmail`);
    }
  }

  /**
   * Watch any @mali.pe Reply-To that actually got a send recently (production or test),
   * including draft campaigns — status alone would miss test replies.
   */
  private async listReplyMailboxes(): Promise<string[]> {
    const since = new Date(Date.now() - REPLY_SYNC_LOOKBACK_MS);
    const rows = await this.prisma.emailCampaign.findMany({
      where: {
        audienceArea: 'malichimp',
        replyToEmail: { not: null },
        sends: {
          some: {
            status: 'sent',
            sentAt: { gte: since },
          },
        },
      },
      select: { replyToEmail: true },
      distinct: ['replyToEmail'],
      take: 50,
    });
    return [
      ...new Set(
        rows
          .map((row) => baseMailboxFromReplyTo(row.replyToEmail))
          .filter((value): value is string => Boolean(value?.endsWith('@mali.pe'))),
      ),
    ];
  }

  private async syncMailbox(mailbox: string): Promise<number> {
    const gmail = this.getGmailClient(mailbox);
    const listed = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox newer_than:14d -from:me',
      maxResults: 100,
    });
    const messages = listed.data.messages ?? [];
    if (!messages.length) return 0;

    let marked = 0;
    for (const message of messages) {
      if (!message.id) continue;
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'metadata',
        metadataHeaders: ['To', 'Delivered-To', 'X-Original-To', 'In-Reply-To', 'References'],
      });
      const headers = full.data.payload?.headers ?? [];
      const headerValue = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

      const sendId =
        extractSendIdFromReplyAddress(headerValue('Delivered-To')) ||
        extractSendIdFromReplyAddress(headerValue('X-Original-To')) ||
        extractSendIdFromReplyAddress(headerValue('To'));

      if (!sendId) continue;

      const byToken = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT send."id"
        FROM "EmailSend" send
        JOIN "EmailCampaign" campaign ON campaign."id" = send."campaignId"
        WHERE campaign."audienceArea" = 'malichimp'
          AND send."repliedAt" IS NULL
          AND lower(send."id") = ${sendId}
        LIMIT 1
      `;
      if (!byToken[0]) continue;
      const updated = await this.prisma.emailSend.updateMany({
        where: { id: byToken[0].id, repliedAt: null },
        data: { repliedAt: new Date() },
      });
      marked += updated.count;
    }
    return marked;
  }

  private getGmailClient(impersonate: string): gmail_v1.Gmail {
    const jsonPath = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
    if (!jsonPath || !existsSync(jsonPath) || !statSync(jsonPath).isFile()) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_PATH no configurado para Gmail reply sync');
    }
    const credentials = JSON.parse(readFileSync(jsonPath, 'utf-8')) as {
      client_email?: string;
      private_key?: string;
    };
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Service account JSON incompleto para Gmail reply sync');
    }
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      subject: impersonate,
    });
    return google.gmail({ version: 'v1', auth });
  }
}
