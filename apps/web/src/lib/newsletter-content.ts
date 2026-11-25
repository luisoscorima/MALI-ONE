export type NewsletterEditorExport = {
  htmlBody: string;
  designJson: string;
};

// GrapesJS can preserve data URLs from imported HTML even with Base64 uploads disabled.
const EMBEDDED_IMAGE = /data:image\/([a-z0-9.+-]+);base64,((?:[a-z0-9+/=\n\r]|\\[nr])+)/gi;
const SUPPORTED_IMAGES = new Map([
  ['jpeg', 'jpg'],
  ['png', 'png'],
  ['gif', 'gif'],
  ['webp', 'webp'],
]);

function imageFormat(mimeSubtype: string) {
  const format = mimeSubtype.toLowerCase();
  return format === 'jpg' ? 'jpeg' : format;
}

export function normalizeNewsletterLink(input: string): string | null {
  const value = input.trim();
  if (!value || /[\s\\]/.test(value)) return null;

  const candidate = value.startsWith('//')
    ? `https:${value}`
    : /^[a-z][a-z\d+.-]*:/i.test(value)
      ? value
      : /^[^/?#.]+(?:\.[^/?#.]+)+(?:[/?#]|$)/u.test(value)
        ? `https://${value}`
        : '';
  try {
    const url = new URL(candidate);
    if (url.protocol === 'mailto:') {
      return /^[^@]+@[^@]+$/.test(url.pathname) ? url.href : null;
    }
    if (url.protocol === 'tel:') {
      return /^\+?[\d().-]+$/.test(url.pathname) ? url.href : null;
    }
    return /^https?:\/\//i.test(candidate) && url.hostname && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function externalizeNewsletterImages(
  exported: NewsletterEditorExport,
  upload: (file: File) => Promise<string>,
  uploadedImages: Map<string, string>,
): Promise<NewsletterEditorExport> {
  const images = new Map<string, { format: string; base64: string }>();
  // Search both representations so the saved editor and the sent HTML use the same assets.
  for (const source of [exported.htmlBody, exported.designJson]) {
    for (const [, format, base64] of source.matchAll(EMBEDDED_IMAGE)) {
      const cleanFormat = imageFormat(format);
      const cleanBase64 = base64.replace(/\s|\\[nr]/g, '');
      images.set(`${cleanFormat}:${cleanBase64}`, { format: cleanFormat, base64: cleanBase64 });
    }
  }
  if (!images.size) return exported;
  if ([...images.values()].some(({ format }) => !SUPPORTED_IMAGES.has(format))) {
    throw new Error('Hay una imagen incrustada con formato incompatible. Reemplázala por JPG, PNG, GIF o WebP.');
  }

  for (const [key, { format, base64 }] of images) {
    if (uploadedImages.has(key)) continue;
    let decoded: string;
    try {
      decoded = atob(base64);
    } catch {
      throw new Error('Hay una imagen incrustada dañada. Reemplázala antes de guardar.');
    }
    const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    const file = new File([bytes], `imagen-incrustada.${SUPPORTED_IMAGES.get(format)}`, {
      type: `image/${format}`,
    });
    uploadedImages.set(key, await upload(file));
  }

  const replace = (source: string) => source.replace(
    EMBEDDED_IMAGE,
    (uri, format: string, base64: string) =>
      uploadedImages.get(`${imageFormat(format)}:${base64.replace(/\s|\\[nr]/g, '')}`) ?? uri,
  );
  return { htmlBody: replace(exported.htmlBody), designJson: replace(exported.designJson) };
}
