export const NEWSLETTER_BRANDS = [
  'museo',
  'cursos_arte',
  'extension_profesional',
] as const;

export type NewsletterBrand = (typeof NEWSLETTER_BRANDS)[number];

export const NEWSLETTER_BRAND_LABELS: Record<NewsletterBrand, string> = {
  museo: 'Museo',
  cursos_arte: 'Cursos de Arte',
  extension_profesional: 'Extensión Profesional',
};

export type NewsletterBrandAssets = {
  logoUrl: string;
};

const FONT = "Arial, Helvetica, 'Helvetica Neue', sans-serif";
const DEFAULT_ASSET_ORIGIN = 'https://dev.mali.pe';

/** Canonical newsletter copyright (Spanish, current year). */
export function newsletterCopyrightLine(
  year: number = new Date().getFullYear(),
): string {
  return `© ${year} MALI — Museo de Arte de Lima. Todos los derechos reservados.`;
}

function copyrightFooterRow(bg = '#ffffff', color = '#888888'): string {
  return `
    <tr>
      <td style="padding:12px 16px 20px;text-align:center;font-size:11px;color:${color};background:${bg};font-family:${FONT}">
        ${newsletterCopyrightLine()}
      </td>
    </tr>`.trim();
}

function brandAssetOrigin(logoUrl?: string): string {
  if (logoUrl) {
    try {
      return new URL(logoUrl).origin;
    } catch {
      // fall through
    }
  }
  return DEFAULT_ASSET_ORIGIN;
}

function socialIcon(
  href: string,
  file: string,
  label: string,
  assets?: NewsletterBrandAssets,
): string {
  const src = `${brandAssetOrigin(assets?.logoUrl)}/newsletter-brands/social/${file}`;
  return `<a href="${href}" target="_blank" rel="noreferrer" style="display:inline-block;margin:0 4px;text-decoration:none"><img src="${src}" alt="${label}" width="28" height="28" style="display:block;width:28px;height:28px;border:0" /></a>`;
}

/** Header chrome: brand logo only (“Ver este correo…” se inyecta al enviar). */
export function buildNewsletterBrandHeader(
  brand: NewsletterBrand,
  assets: NewsletterBrandAssets,
): string {
  const alt = NEWSLETTER_BRAND_LABELS[brand];
  const width =
    brand === 'museo' ? 120 : brand === 'cursos_arte' ? 168 : 150;
  return `
<table data-mali-brand-header="${brand}" role="presentation" style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="padding:16px 16px 8px;text-align:left;background:#ffffff">
        <img src="${assets.logoUrl}" alt="${alt}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0" />
      </td>
    </tr>
  </tbody>
</table>`.trim();
}

/** Footer chrome per brand, from MALI Mailchimp references. */
export function buildNewsletterBrandFooter(
  brand: NewsletterBrand,
  assets?: NewsletterBrandAssets,
): string {
  if (brand === 'cursos_arte') {
    return `
<table data-mali-brand-footer="cursos_arte" role="presentation" style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:#63277f;padding:28px 24px;color:#ffffff">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
          <tr>
            <td valign="top" style="width:50%;padding-right:12px;color:#ffffff">
              <div style="font-size:22px;font-weight:800;line-height:1.2;margin:0 0 8px">MALI Cursos de Arte</div>
              <div style="font-size:13px;line-height:1.45;margin:0 0 16px">Vive el arte en el MALI / ¡Inicios todos los meses!</div>
              <a href="https://educacion.mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Más información</a>
              <div style="margin-top:18px">
                ${socialIcon('https://www.facebook.com/museodeartedelima', 'facebook-outline.png', 'Facebook', assets)}
                ${socialIcon('https://www.instagram.com/museodeartedelima', 'instagram-outline.png', 'Instagram', assets)}
                ${socialIcon('https://www.tiktok.com/@museodeartedelima', 'tiktok.png', 'TikTok', assets)}
              </div>
            </td>
            <td valign="top" style="width:50%;padding-left:12px;color:#ffffff;font-size:12px;line-height:1.55">
              <div style="margin:0 0 10px">Sede principal en Av. Paseo Colón 125, Lima. (Museo de Arte de Lima)</div>
              <div>Martes a viernes de 11 a.m. a 8 p.m.</div>
              <div>Sábado de 9 a.m. a 8 p.m.</div>
              <div style="margin:0 0 10px">Domingos de 9 a.m. a 5 p.m.</div>
              <div><a href="mailto:cursosdearte@mali.pe" style="color:#ffffff;text-decoration:underline">cursosdearte@mali.pe</a></div>
              <div style="margin:0 0 10px"><a href="https://educacion.mali.pe" style="color:#ffffff;text-decoration:underline">educacion.mali.pe</a></div>
              <div>01 2040000 Anexo 1</div>
              <div>Horario: Lun a sab de 9 a.m. a 8 p.m. y dom de 9 a.m. a 5 p.m.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${copyrightFooterRow()}
  </tbody>
</table>`.trim();
  }

  if (brand === 'extension_profesional') {
    return `
<table data-mali-brand-footer="extension_profesional" role="presentation" style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:#1a3d8f;padding:28px 24px;color:#ffffff">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
          <tr>
            <td valign="top" style="width:50%;padding-right:12px;color:#ffffff">
              <div style="font-size:22px;font-weight:800;line-height:1.2;margin:0 0 8px;text-transform:uppercase">Extensión Profesional</div>
              <div style="font-size:13px;line-height:1.45;margin:0 0 16px">Vacantes limitadas</div>
              <a href="https://educacion.mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:8px 14px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Más información</a>
            </td>
            <td valign="top" style="width:50%;padding-left:12px;color:#ffffff;font-size:12px;line-height:1.55">
              <div style="font-weight:700;margin:0 0 10px">Informes: MALI Educación</div>
              <div style="border-top:1px dotted rgba(255,255,255,.55);padding:8px 0"><a href="https://wa.me/5112040000" style="color:#ffffff;text-decoration:underline">Whatsapp</a></div>
              <div style="border-top:1px dotted rgba(255,255,255,.55);padding:8px 0"><a href="mailto:extension@mali.pe" style="color:#ffffff;text-decoration:underline">extension@mali.pe</a></div>
              <div style="border-top:1px dotted rgba(255,255,255,.55);border-bottom:1px dotted rgba(255,255,255,.55);padding:8px 0"><a href="https://educacion.mali.pe" style="color:#ffffff;text-decoration:underline">educacion.mali.pe</a></div>
              <div style="margin-top:16px;text-align:right">
                ${socialIcon('https://www.facebook.com/museodeartedelima', 'facebook-outline.png', 'Facebook', assets)}
                ${socialIcon('https://www.instagram.com/museodeartedelima', 'instagram-outline.png', 'Instagram', assets)}
                ${socialIcon('https://www.tiktok.com/@museodeartedelima', 'tiktok.png', 'TikTok', assets)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${copyrightFooterRow()}
  </tbody>
</table>`.trim();
  }

  // museo — from DONA AL MALI through copyright
  return `
<table data-mali-brand-footer="museo" role="presentation" style="width:100%;margin:0;padding:0;border-collapse:collapse;font-family:${FONT}" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td style="background-color:#0084ca;padding:32px 28px;color:#ffffff">
        <h2 style="margin:0 0 14px;font-size:28px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff">Dona al MALI</h2>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#ffffff">El principal valor que estructura y sustenta al MALI es la generosidad y el compromiso de su comunidad. Estamos seguros que a pesar de los desafíos que debe enfrentar, el MALI saldrá fortalecido.</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#ffffff">Pero no podemos hacerlo solos. Hoy requerimos de tu generoso apoyo para continuar con nuestro trabajo.</p>
        <p style="margin:0 0 8px"><a href="https://mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Donar</a></p>
        <p style="margin:0 0 8px"><a href="https://tienda.mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Tienda MALI</a></p>
        <p style="margin:0 0 8px"><a href="https://mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Hazte amigo del MALI</a></p>
        <p style="margin:0"><a href="https://mali.pe" style="display:inline-block;border:1px solid #ffffff;color:#ffffff;text-decoration:none;padding:10px 18px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">Regala una membresía PAM</a></p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 20px;text-align:center;font-size:12px;color:#111111;background:#ffffff">
        <div style="margin:0 0 6px">EXPOSICIONES | BIBLIOTECA | CURSOS | PAM | TIENDA</div>
        <div>ARCHI | VISÍTANOS</div>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 20px 4px;text-align:center;background:#ffffff;color:#111111;font-size:13px">
        ¡Cuéntanos tu experiencia!
      </td>
    </tr>
    <tr>
      <td style="padding:8px 20px 16px;text-align:center;background:#ffffff">
        ${socialIcon('https://www.facebook.com/museodeartedelima', 'facebook.png', 'Facebook', assets)}
        ${socialIcon('https://x.com/mali_lima', 'twitter.png', 'X', assets)}
        ${socialIcon('https://www.instagram.com/museodeartedelima', 'instagram.png', 'Instagram', assets)}
        ${socialIcon('https://www.youtube.com/@museodeartedelima', 'youtube.png', 'YouTube', assets)}
        ${socialIcon('https://open.spotify.com', 'spotify.png', 'Spotify', assets)}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 20px 16px;background:#ffffff">
        <a href="https://mali.pe" style="display:block;background:#e2187d;color:#ffffff;text-decoration:none;text-align:center;padding:14px 18px;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase">Compra tus entradas aquí</a>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 20px;background:#ffffff;color:#444444;font-size:12px;line-height:1.55">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
          <tr>
            <td valign="top" style="width:50%;padding-right:10px">
              <div>Av. 9 de diciembre 125, Lima 15046, Perú.</div>
              <div>(0051 1) 2040000</div>
              <div><a href="https://mali.pe" style="color:#444444;text-decoration:underline">mali.pe</a></div>
              <div><a href="https://mali.pe" style="color:#444444;text-decoration:underline">Adquiere tus entradas aquí</a></div>
            </td>
            <td valign="top" style="width:50%;padding-left:10px">
              <div><a href="https://mali.pe" style="color:#444444;text-decoration:underline">Conoce los nuevos #IconosMALI</a></div>
              <div>Visítanos de martes a domingo</div>
              <div>Horario: 10 a.m. a 6 p.m. (Sáb. 5 p.m.)</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${copyrightFooterRow()}
  </tbody>
</table>`.trim();
}

export function wrapNewsletterWithBrandChrome(
  bodyHtml: string,
  brand: NewsletterBrand,
  assets: NewsletterBrandAssets,
): string {
  return `
<table role="presentation" style="width:100%;background-color:#ffffff;margin:0;padding:0;border-collapse:collapse" width="100%" cellspacing="0" cellpadding="0">
  <tbody>
    <tr>
      <td align="center" style="padding:0">
        <table role="presentation" style="width:600px;max-width:100%;background-color:#ffffff;font-family:${FONT}" width="600" cellspacing="0" cellpadding="0">
          <tbody>
            <tr><td>${buildNewsletterBrandHeader(brand, assets)}</td></tr>
            <tr><td>${bodyHtml}</td></tr>
            <tr><td>${buildNewsletterBrandFooter(brand, assets)}</td></tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>`.trim();
}
