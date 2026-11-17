/**
 * Removes / rewrites leftover Mailchimp archive chrome and list-manage links
 * so seeded newsletters no longer send readers back to Mailchimp.
 */

export type ScrubMailchimpOptions = {
  /** Public app origin without trailing slash (e.g. https://dev.mali.pe). */
  appUrl: string;
  /** Slug of the newsletter being scrubbed (for "view in browser"). */
  slug: string;
  /** mailchi.mp path segment → local newsletter slug. */
  archiveSlugByPath?: Record<string, string>;
  /** Fallback for unknown mailchi.mp archives. */
  unknownArchiveUrl?: string;
};

const DEFAULT_UNKNOWN_ARCHIVE = 'https://mali.pe';

const MAILCHIMP_HREF_RE =
  /https?:\/\/(?:[\w.-]+\.)?(?:mailchi\.mp|list-manage\.com|login\.mailchimp\.com|campaign-archive\.com|eepurl\.com)[^"'\\\s>]*/i;

/** Built-in map of the 7 seeded Mailchimp archives. */
export const SEEDED_MAILCHIMP_ARCHIVE_SLUGS: Record<string, string> = {
  'boletinnoviembre2026-7706881': 'mailchimp-boletin-auditorio-nov-2026',
  'boletinmarzo2026-7706953': 'mailchimp-boletin-mensual-nov-2026',
  'boletinmarzo2026-7706798': 'mailchimp-boletin-amigos-mali',
  'cursosdearte-iniciaenmayo-7706891': 'mailchimp-alumnos-noche-mali',
  'llena-tu-hogar-de-arte-con-los-cursos-del-mali-7706753':
    'mailchimp-cursos-ep-ca-cine',
  'cursosdearte-iniciaenmayo-7706142': 'mailchimp-boletin-cursos-arte',
  'llena-tu-hogar-de-arte-con-los-cursos-del-mali-7706140':
    'mailchimp-boletin-extension-profesional',
};

const SOCIAL_ICON_FILES: Record<string, string> = {
  'light-facebook-96.png': 'facebook.png',
  'light-instagram-96.png': 'instagram.png',
  'light-twitter-96.png': 'twitter.png',
  'light-youtube-96.png': 'youtube.png',
  'light-spotify-96.png': 'spotify.png',
  'outline-light-facebook-96.png': 'facebook-outline.png',
  'outline-light-instagram-96.png': 'instagram-outline.png',
  'outline-light-tiktok-96.png': 'tiktok.png',
  'outline-light-whatsapp-96.png': 'whatsapp.png',
};

function normalizeAppUrl(appUrl: string): string {
  return appUrl.trim().replace(/\/$/, '') || 'https://mali.pe';
}

function publicNewsletterUrl(appUrl: string, slug: string): string {
  return `${normalizeAppUrl(appUrl)}/n/${slug}`;
}

function socialIconUrl(appUrl: string, fileName: string): string {
  return `${normalizeAppUrl(appUrl)}/newsletter-brands/social/${fileName}`;
}

function mailchimpPathKey(href: string): string | null {
  try {
    const url = new URL(href.replace(/&amp;/g, '&'));
    if (!/mailchi\.mp$/i.test(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 1] : parts[0] ?? null;
  } catch {
    return null;
  }
}

function resolveMailchimpHref(
  href: string,
  opts: ScrubMailchimpOptions,
): string | null {
  const raw = href.replace(/&amp;/g, '&').trim();
  let host = '';
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }

  // Preference / unsubscribe / about / referral → drop the whole anchor.
  if (
    host.endsWith('list-manage.com') ||
    host.endsWith('login.mailchimp.com') ||
    host.endsWith('campaign-archive.com') ||
    host.endsWith('eepurl.com')
  ) {
    return null;
  }

  if (host.endsWith('mailchi.mp')) {
    const key = mailchimpPathKey(raw);
    const map = {
      ...SEEDED_MAILCHIMP_ARCHIVE_SLUGS,
      ...(opts.archiveSlugByPath ?? {}),
    };
    if (key && map[key]) {
      return publicNewsletterUrl(opts.appUrl, map[key]);
    }
    return opts.unknownArchiveUrl ?? DEFAULT_UNKNOWN_ARCHIVE;
  }

  return null;
}

function rewriteSocialIconCdn(html: string, appUrl: string): string {
  return html.replace(
    /https:\/\/cdn-images\.mailchimp\.com\/icons\/social-block-v2\/([a-z0-9-]+\.png)/gi,
    (_full, file: string) => {
      const mapped = SOCIAL_ICON_FILES[file.toLowerCase()];
      return mapped
        ? socialIconUrl(appUrl, mapped)
        : socialIconUrl(appUrl, 'facebook.png');
    },
  );
}

function stripMailchimpComplianceCopy(html: string): string {
  let out = html;
  out = out.replace(/Want to change how you receive these emails\??/gi, '');
  out = out.replace(
    /You can\s+(?:update your preferences|actualizar tus preferencias)\s+or\s+(?:unsubscribe from this list|cancelar tu suscripci[oó]n)\.?/gi,
    '',
  );
  out = out.replace(
    /Puedes\s+(?:update your preferences|actualizar tus preferencias)\s+o\s+(?:unsubscribe from this list|cancelar tu suscripci[oó]n)\.?/gi,
    '',
  );
  out = out.replace(/update your preferences/gi, '');
  out = out.replace(/actualizar tus preferencias/gi, '');
  out = out.replace(/unsubscribe from this list/gi, '');
  out = out.replace(/cancelar tu suscripci[oó]n/gi, '');
  out = out.replace(/why did I get this\?/gi, '');
  out = out.replace(/Email Marketing Powered by Mailchimp/gi, '');
  out = out.replace(
    /https:\/\/cdn-images\.mailchimp\.com\/monkey_rewards\/[^"'\\\s>]+/gi,
    '',
  );
  return out;
}

function normalizeViewInBrowser(html: string, opts: ScrubMailchimpOptions): string {
  const url = publicNewsletterUrl(opts.appUrl, opts.slug);
  let out = html.replace(
    />\s*View this email in your browser\s*</gi,
    '>Ver este correo en el navegador<',
  );

  // Point any remaining "ver en navegador" anchors at this newsletter.
  out = out.replace(
    /(<a\b[^>]*href=(["']))([^"']+)(\2[^>]*>)\s*Ver este correo en el navegador\s*(<\/a>)/gi,
    `$1${url}$4Ver este correo en el navegador$5`,
  );

  if (!/Ver este correo en el navegador/i.test(out)) {
    const preheader = `<div data-mali-view-in-browser style="text-align:center;padding:12px 16px;font:12px/1.4 Arial,Helvetica,sans-serif;color:#656565"><a href="${url}" target="_blank" rel="noreferrer" style="color:#656565;text-decoration:underline">Ver este correo en el navegador</a></div>`;
    out = `${preheader}${out}`;
  }
  return out;
}

/**
 * Rewrite or remove anchors whose href still points at Mailchimp infrastructure.
 * Also normalizes view-in-browser, strips Mailchimp compliance copy, and rehosts
 * social icons onto the app origin.
 */
export function scrubMailchimpNewsletterHtml(
  html: string,
  opts: ScrubMailchimpOptions,
): string {
  let out = html;

  // Drop "Email Marketing Powered by Mailchimp" referral badge (anchor + img).
  out = out.replace(
    /<a\b[^>]*href=["'][^"']*login\.mailchimp\.com[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    '',
  );

  // Rewrite or remove remaining Mailchimp / list-manage / archive anchors.
  out = out.replace(
    /<a\b([^>]*)href=(["'])([^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, before: string, quote: string, href: string, after: string, inner: string) => {
      const decoded = href.replace(/&amp;/g, '&');
      if (!MAILCHIMP_HREF_RE.test(decoded)) return full;

      const next = resolveMailchimpHref(decoded, opts);
      if (next == null) return '';
      return `<a${before}href=${quote}${next}${quote}${after}>${inner}</a>`;
    },
  );

  // Naked URLs left in text / tracking leftovers.
  out = out.replace(
    /https?:\/\/(?:[\w.-]+\.)?(?:mailchi\.mp|list-manage\.com|login\.mailchimp\.com|campaign-archive\.com|eepurl\.com)[^\s"'<>]*/gi,
    (url) => resolveMailchimpHref(url, opts) ?? '',
  );

  out = rewriteSocialIconCdn(out, opts.appUrl);
  out = stripMailchimpComplianceCopy(out);

  // Merge-field leftovers from archive HTML.
  out = out.replace(/\?e=\[UNIQID\]/gi, '');
  out = out.replace(/\[UNIQID\]/gi, '');

  out = normalizeViewInBrowser(out, opts);
  return out;
}

export function htmlStillPointsToMailchimp(html: string): string[] {
  const found = new Set<string>();
  const re =
    /https?:\/\/(?:[\w.-]+\.)?(?:mailchi\.mp|list-manage\.com|login\.mailchimp\.com|campaign-archive\.com|eepurl\.com|cdn-images\.mailchimp\.com)[^\s"'<>]*/gi;
  for (const match of html.matchAll(re)) {
    found.add(match[0].replace(/&amp;/g, '&'));
  }
  return [...found].sort();
}
