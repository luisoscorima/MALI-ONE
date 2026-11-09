import { ConfigService } from '@nestjs/config';

type StaticCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

/**
 * Return explicit credentials only when a complete temporary migration pair
 * exists. With no pair, AWS SDK's default provider chain resolves the EC2
 * instance role (or the developer's standard local AWS profile).
 */
export function optionalAwsCredentials(
  config: ConfigService,
  prefix: 'AWS' | 'AWS_SES',
): StaticCredentials | undefined {
  const accessKeyId = config.get<string>(`${prefix}_ACCESS_KEY_ID`)?.trim();
  const secretAccessKey = config
    .get<string>(`${prefix}_SECRET_ACCESS_KEY`)
    ?.trim();
  const sessionToken = config.get<string>(`${prefix}_SESSION_TOKEN`)?.trim();

  if (!accessKeyId && !secretAccessKey) return undefined;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(`Credenciales ${prefix} incompletas`);
  }
  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
}
