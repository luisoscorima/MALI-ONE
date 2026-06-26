export function parseTagsInput(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatTagsInput(tags: string[]): string {
  return tags.join(', ');
}

export function parseWhatsappTarget(targetUrl: string): {
  phone: string;
  text: string;
} {
  try {
    const parsed = new URL(targetUrl);
    return {
      phone: parsed.searchParams.get('phone') ?? '',
      text: parsed.searchParams.get('text') ?? '',
    };
  } catch {
    return { phone: '', text: '' };
  }
}
