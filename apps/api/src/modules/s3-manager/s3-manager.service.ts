import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
  }

  async getDownloadUrl(bucket: string, key: string) {
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
  }

  async deleteObject(bucket: string, key: string) {
    this.assertBucketAllowed(bucket);
    if (!key || key.endsWith('/')) {
      throw new BadRequestException('No se puede eliminar una carpeta desde aquí');
    }

    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
    return { ok: true };
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
