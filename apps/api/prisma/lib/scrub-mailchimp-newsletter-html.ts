/**
 * Removes / rewrites leftover Mailchimp archive chrome and list-manage links
 * so seeded newsletters no longer send readers back to Mailchimp.
 */
import { newsletterCopyrightLine } from '@mali-one/shared';
import { stripViewInBrowserFromHtml } from '../../src/core/email-delivery/strip-view-in-browser';

export { stripViewInBrowserFromHtml };

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

/** Built-in map of seeded Mailchimp archives → MALI ONE newsletter slugs. */
export const SEEDED_MAILCHIMP_ARCHIVE_SLUGS: Record<string, string> = {
  'boletinnoviembre2026-7706881': 'boletin-auditorio-nov-2026',
  'boletinmarzo2026-7706953': 'boletin-mensual-nov-2026',
  'boletinmarzo2026-7706798': 'boletin-amigos-mali',
  'cursosdearte-iniciaenmayo-7706891': 'alumnos-noche-mali',
  'llena-tu-hogar-de-arte-con-los-cursos-del-mali-7706753': 'cursos-ep-ca-cine',
  'cursosdearte-iniciaenmayo-7706142': 'boletin-cursos-arte',
  'llena-tu-hogar-de-arte-con-los-cursos-del-mali-7706140':
    'boletin-extension-profesional',
  'asamblea-mali-25ii-7707175': 'invitacion-sandra-gamarra-replica',
  'asamblea-mali-25i-7707074': 'asamblea-asociados-2026-1',
  'asamblea-mali-25ii-7706902': 'lanzamiento-casa-del-moral',
  'invitacin-cctel-de-inauguracin-pacchas-agua-ritual-y-ofrenda-en-los-andes':
    'invitacion-pacchas',
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
  let out = html.replace(
    /https:\/\/cdn-images\.mailchimp\.com\/icons\/social-block-v2\/([a-z0-9-]+\.png)/gi,
    (_full, file: string) => {
      const mapped = SOCIAL_ICON_FILES[file.toLowerCase()];
      return mapped
        ? socialIconUrl(appUrl, mapped)
        : socialIconUrl(appUrl, 'facebook.png');
    },
  );
  // Already-rehosted S3 copies still carry Mailchimp CDN filenames.
  out = out.replace(
    /https:\/\/mali-one-files\.s3\.[a-z0-9-]+\.amazonaws\.com\/newsletters\/[^"'\\\s>]+?((?:outline-)?light-[a-z0-9-]+-96\.png)/gi,
    (_full, file: string) => {
      const mapped = SOCIAL_ICON_FILES[file.toLowerCase()];
      return mapped
        ? socialIconUrl(appUrl, mapped)
        : socialIconUrl(appUrl, 'facebook.png');
    },
  );
  return out;
}

/** Convert leftover Mailchimp / archive personalization to SES merge tags. */
function normalizeMergeTags(html: string): string {
  let out = html;
  out = out.replace(/\*\|FNAME\|\*/gi, '{{first_name}}');
  // Variants seen in archives: |FNAME| / *|FNAME|* / bare FNAME with pipes.
  out = out.replace(/\|\s*FNAME\s*\|/gi, '{{first_name}}');
  out = out.replace(/<<\s*(?:Test\s+)?First Name\s*>>/gi, '{{first_name}}');
  out = out.replace(
    /&lt;&lt;\s*(?:Test\s+)?First Name\s*&gt;&gt;/gi,
    '{{first_name}}',
  );
  // Mixed escaping from Mailchimp archives: &lt;&lt;First Name>>
  out = out.replace(
    /&lt;&lt;\s*(?:Test\s+)?First Name\s*>>/gi,
    '{{first_name}}',
  );
  out = out.replace(
    /<<\s*(?:Test\s+)?First Name\s*&gt;&gt;/gi,
    '{{first_name}}',
  );
  return out;
}

/** Spaces + HTML nbsp variants used in Mailchimp footers. */
const WS = '(?:\\s|&nbsp;|&#160;|&#x0*a0;)+';

function stripMailchimpComplianceCopy(html: string): string {
  let out = html;
  // Permission / preference reminders (ES + EN), including orphans after link removal.
  out = out.replace(/Eres parte del MALI\.?/gi, '');
  out = out.replace(
    /(?:\¿|&iquest;)?Quieres hacer cambios en c(?:[oó]|&oacute;)mo recibes estos e-?mails?\??/gi,
    '',
  );
  out = out.replace(/Want to change how you receive these emails\??/gi, '');
  out = out.replace(
    new RegExp(
      `You can${WS}(?:update your preferences|actualizar tus preferencias)${WS}or${WS}(?:unsubscribe from this list|cancelar tu suscripci[oó]n)\\.?`,
      'gi',
    ),
    '',
  );
  out = out.replace(
    new RegExp(
      `Puedes${WS}(?:update your preferences|actualizar tus preferencias)${WS}o${WS}(?:unsubscribe from this list|cancelar tu suscripci[oó]n)\\.?`,
      'gi',
    ),
    '',
  );
  out = out.replace(/update your preferences/gi, '');
  out = out.replace(/actualizar tus preferencias/gi, '');
  out = out.replace(/unsubscribe from this list/gi, '');
  out = out.replace(/cancelar tu suscripci[oó]n/gi, '');
  // Leftovers like "Puedes&nbsp;&nbsp;o&nbsp;." / "You can or ." after anchors were dropped.
  out = out.replace(new RegExp(`You can${WS}or(?:${WS})?\\.?`, 'gi'), '');
  out = out.replace(new RegExp(`Puedes${WS}o(?:${WS})?\\.?`, 'gi'), '');
  // Orphan " or " / " o " spans left after preference / share links were removed.
  out = out.replace(
    /<span\b[^>]*>\s*(?:&nbsp;|\s)*(?:or|o)(?:\s|&nbsp;)*<\/span>/gi,
    '',
  );
  out = out.replace(
    new RegExp(`(?:^|>)${WS}(?:or|o)${WS}(?=<|$)`, 'gi'),
    (m) => (m.startsWith('>') ? '>' : ''),
  );
  out = out.replace(/why did I get this\?/gi, '');
  out = out.replace(/Email Marketing Powered by Mailchimp/gi, '');
  out = out.replace(
    /https:\/\/cdn-images\.mailchimp\.com\/monkey_rewards\/[^"'\\\s>]+/gi,
    '',
  );
  // Empty paragraphs left behind in the footer cell.
  out = out.replace(
    /<p\b[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/p>/gi,
    '',
  );
  return out;
}

/** Force a single Spanish copyright line with the current year. */
function normalizeCopyright(html: string): string {
  const line = newsletterCopyrightLine();
  let out = html.replace(
    /(?:Copyright\s*)?©\s*(?:\d{4}|\*&nbsp;CURRENT_YEAR&nbsp;\*|\*\|CURRENT_YEAR\|\*)[^<]*?(?:All rights reserved|Todos los derechos reservados)\.?/gi,
    line,
  );
  // Bare "Copyright © YEAR Company" without the reserved phrase.
  out = out.replace(
    /Copyright\s*©\s*\d{4}[^<]{0,120}?MALI[^<]{0,80}\.?/gi,
    line,
  );
  return out;
}

/**
 * Rewrite or remove anchors whose href still points at Mailchimp infrastructure.
 * Strips view-in-browser (injected at send), Mailchimp compliance copy, and
 * rehosts social icons onto the app origin.
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
  out = normalizeCopyright(out);
  out = normalizeMergeTags(out);

  // Merge-field leftovers from archive HTML.
  out = out.replace(/\?e=\[UNIQID\]/gi, '');
  out = out.replace(/\[UNIQID\]/gi, '');

  out = stripViewInBrowserFromHtml(out);
  return out;
}

export function htmlStillPointsToMailchimp(html: string): string[] {
  const found = new Set<string>();
  const re =
    /https?:\/\/(?:[\w.-]+\.)?(?:mailchi\.mp|list-manage\.com|login\.mailchimp\.com|campaign-archive\.com|eepurl\.com|cdn-images\.mailchimp\.com|mcusercontent\.com)[^\s"'<>]*/gi;
  for (const match of html.matchAll(re)) {
    found.add(match[0].replace(/&amp;/g, '&'));
  }
  return [...found].sort();
}
