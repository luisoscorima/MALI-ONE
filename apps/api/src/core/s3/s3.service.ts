import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicRead: boolean;

  constructor(private readonly config: ConfigService) {
    this.region = config.getOrThrow<string>('AWS_REGION');
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
    this.publicRead = config.get<string>('S3_PUBLIC_READ') === 'true';

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  buildKey(fileName: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `uploads/${year}/${month}/${randomUUID()}-${safeName}`;
  }

  async uploadFile(
    key: string,
    body: Buffer,
    mimeType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ACL: this.publicRead ? 'public-read' : undefined,
      }),
    );

    if (this.publicRead) {
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 60 * 60 * 24 * 7 },
    );
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async getReadableUrl(key: string): Promise<string> {
    if (this.publicRead) {
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 60 * 60 * 24 * 7 },
    );
  }
}
