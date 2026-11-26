import sharp from 'sharp';

/** Max edge for email HTML (banners ~600px wide; headroom for retina). */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 85;

export type EmailImage = {
  buffer: Buffer;
  mimeType: string;
  width: number | null;
  height: number | null;
};

/** JPEG/PNG/WebP become an email-sized JPEG; GIF keeps its bytes so animation survives. */
export async function optimizeEmailImage(buffer: Buffer, mimeType: string): Promise<EmailImage> {
  if (mimeType === 'image/gif') {
    const meta = await sharp(buffer, { animated: true }).metadata();
    if (meta.format !== 'gif') throw new Error('Invalid GIF format');
    return { buffer, mimeType, width: meta.width ?? null, height: meta.height ?? null };
  }

  // Flatten alpha onto white before JPEG (email-friendly; avoids black holes).
  const optimized = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const meta = await sharp(optimized).metadata();
  return {
    buffer: optimized,
    mimeType: 'image/jpeg',
    width: meta.width ?? null,
    height: meta.height ?? null,
  };
}
