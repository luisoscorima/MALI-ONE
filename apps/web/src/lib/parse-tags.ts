export function parseTagsInput(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatTagsInput(tags: string[]): string {
  return tags.join(', ');
}

const WHATSAPP_REF_TOKEN = String.raw`ref:[a-zA-Z0-9_-]+`;

/** Igual que el API: quita `ref:{slug}` del inicio o del final para editar y listar. */
export function stripWhatsappRef(text: string | undefined | null): string {
  return String(text ?? '')
    .replace(
      new RegExp(
        String.raw`^\s*${WHATSAPP_REF_TOKEN}(?:\s*[·•\-–—]\s*|\s+)?`,
        'i',
      ),
      '',
    )
    .replace(
      new RegExp(String.raw`\s*[·•\-–—]?\s*${WHATSAPP_REF_TOKEN}\s*$`, 'i'),
      '',
    )
    .trim();
}

export function parseWhatsappTarget(targetUrl: string): {
  phone: string;
  text: string;
} {
  try {
    const parsed = new URL(targetUrl);
    return {
      phone: parsed.searchParams.get('phone') ?? '',
      text: stripWhatsappRef(parsed.searchParams.get('text') ?? ''),
    };
  } catch {
    return { phone: '', text: '' };
  }
}
