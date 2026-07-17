export function buildQrFilename(
  slug: string,
  id: string,
  extension: string,
): string {
  const safeSlug =
    slug.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 64) ||
    'qr';
  return `${safeSlug}-${id.slice(-8)}.${extension}`;
}
