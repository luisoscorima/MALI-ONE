import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3ManagerService {
  private readonly logger = new Logger(S3ManagerService.name);
  private readonly client: S3Client;
  private readonly region: string;
  private readonly allowedBuckets: string[];

  constructor(private readonly config: ConfigService) {
    this.region = config.getOrThrow<string>('AWS_REGION');
    this.allowedBuckets = this.parseBuckets(
      config.get<string>('AWS_S3_MANAGER_BUCKETS') ?? '',
    );

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  listBuckets() {
    return this.allowedBuckets.map((name) => ({ name }));
  }

  async listObjects(
    bucket: string,
    prefix = '',
    continuationToken?: string,
  ) {
    return this.run(`listObjects:${bucket}`, async () => {
      this.assertBucketAllowed(bucket);

      const normalizedPrefix = prefix.replace(/^\//, '');
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: normalizedPrefix || undefined,
          Delimiter: '/',
          ContinuationToken: continuationToken,
          MaxKeys: 100,
        }),
      );

      const folders = (response.CommonPrefixes ?? []).map((p) => {
        const key = p.Prefix ?? '';
        const name = key.slice(normalizedPrefix.length).replace(/\/$/, '');
        return {
          key,
          name,
          isFolder: true,
          size: null,
          lastModified: null,
        };
      });

      const files = (response.Contents ?? [])
        .filter((o) => o.Key && o.Key !== normalizedPrefix)
        .map((o) => ({
          key: o.Key!,
          name: o.Key!.slice(normalizedPrefix.length),
          isFolder: false,
          size: o.Size ?? null,
          lastModified: o.LastModified?.toISOString() ?? null,
        }));

      return {
        items: [...folders, ...files],
        prefix: normalizedPrefix,
        nextContinuationToken: response.NextContinuationToken ?? null,
      };
    });
  }

  async getDownloadUrl(bucket: string, key: string) {
    return this.run(`download:${bucket}`, async () => {
      this.assertBucketAllowed(bucket);
      if (!key || key.endsWith('/')) {
        throw new BadRequestException('Clave de objeto inválida');
      }

      const url = await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 60 * 15 },
      );

      return { url, expiresIn: 900 };
    });
  }

  async deleteObject(bucket: string, key: string) {
    return this.run(`delete:${bucket}`, async () => {
      this.assertBucketAllowed(bucket);
      if (!key || key.endsWith('/')) {
        throw new BadRequestException(
          'No se puede eliminar una carpeta desde aquí',
        );
      }

      await this.client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
      return { ok: true };
    });
  }

  private async run<T>(action: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      const detail = this.formatAwsError(error);
      this.logger.error(`S3 ${action}: ${detail}`);
      throw new ServiceUnavailableException(`S3: ${detail}`);
    }
  }

  private formatAwsError(error: unknown): string {
    if (error && typeof error === 'object') {
      const e = error as {
        name?: string;
        Code?: string;
        message?: string;
      };
      const code = e.name ?? e.Code;
      const message = e.message ?? 'Error desconocido';

      if (code === 'AccessDenied') {
        return `Acceso denegado. El usuario IAM necesita s3:ListBucket en arn:aws:s3:::BUCKET y s3:GetObject en arn:aws:s3:::BUCKET/* (${message})`;
      }

      return code ? `${code}: ${message}` : message;
    }

    return 'Error desconocido al contactar S3';
  }

  private assertBucketAllowed(bucket: string) {
    if (!this.allowedBuckets.includes(bucket)) {
      throw new ForbiddenException(`Bucket no permitido: ${bucket}`);
    }
  }

  private parseBuckets(raw: string): string[] {
    return raw
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
  }
}
