import type { ShortLinkDto } from '@mali-one/shared';

export function formatLinkDestination(link: ShortLinkDto): {
  primary: string;
  secondary?: string;
} {
  if (link.type === 'FILE') {
    const primary = link.fileName ?? 'Archivo';
    const secondary = link.s3Key
      ? `S3: ${link.s3Key}`
      : 'Almacenado en S3 · acceso vía enlace corto';
    return { primary, secondary };
  }

  try {
    const parsed = new URL(link.targetUrl);
    return {
      primary: link.targetUrl,
      secondary: parsed.hostname,
    };
  } catch {
    return { primary: link.targetUrl };
  }
}
