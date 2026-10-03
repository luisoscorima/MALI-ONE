import type {
  LandingBlock,
  LandingBlockType,
  LandingDocument,
} from '@mali-one/shared';

const BLOCK_TYPES = new Set<LandingBlockType>([
  'hero',
  'text',
  'feature_list',
  'faculty',
  'gallery',
  'schedule',
  'faq',
  'cta',
  'lead_form',
  'footer',
]);

const DEFAULT_THEME = {
  primary: '#5c1599',
  secondary: '#7f21c3',
  accent: '#e2008c',
  ink: '#101018',
  surface: '#f8f6fb',
};

function text(value: unknown, maximum = 5000): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, 50) : [];
}

function color(value: unknown, fallback: string): string {
  const candidate = text(value, 20);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

function safeUrl(value: unknown, allowHash = false): string {
  const candidate = text(value, 1000);
  if (allowHash && /^#[a-z][a-z0-9_-]*$/i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

function escapeHtml(value: unknown): string {
  return text(value).replace(/[&<>'"]/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;',
    };
    return entities[char];
  });
}

function paragraphs(value: unknown): string {
  return text(value)
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join('');
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function normalizeLandingDocument(value: unknown): LandingDocument {
  const source = object(value);
  const theme = object(source.theme);
  const seen = new Set<string>();
  const blocks: LandingBlock[] = [];

  for (const raw of array(source.blocks)) {
    const block = object(raw);
    const type = text(block.type, 40) as LandingBlockType;
    if (!BLOCK_TYPES.has(type)) continue;
    let id = text(block.id, 80).replace(/[^a-z0-9_-]/gi, '-');
    if (!id) id = `${type}-${blocks.length + 1}`;
    if (seen.has(id)) id = `${id}-${blocks.length + 1}`;
    seen.add(id);
    blocks.push({
      id,
      type,
      enabled: block.enabled !== false,
      data: object(block.data),
    });
  }

  return {
    logoUrl: safeUrl(source.logoUrl),
    logoAlt: text(source.logoAlt, 160) || 'MALI Educación',
    headerCtaLabel:
      text(source.headerCtaLabel, 80) || 'Solicitar información',
    theme: {
      primary: color(theme.primary, DEFAULT_THEME.primary),
      secondary: color(theme.secondary, DEFAULT_THEME.secondary),
      accent: color(theme.accent, DEFAULT_THEME.accent),
      ink: color(theme.ink, DEFAULT_THEME.ink),
      surface: color(theme.surface, DEFAULT_THEME.surface),
    },
    blocks,
  };
}

function eyebrow(data: Record<string, unknown>): string {
  const value = text(data.eyebrow, 100);
  return value ? `<p class="eyebrow">${escapeHtml(value)}</p>` : '';
}

function renderHero(block: LandingBlock): string {
  const data = block.data;
  const imageUrl = safeUrl(data.imageUrl);
  const facts = array(data.facts)
    .map(object)
    .map(
      (item) =>
        `<li><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></li>`,
    )
    .join('');
  return `<section class="hero" id="${escapeHtml(block.id)}">
    ${imageUrl ? `<img class="hero__image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(data.imageAlt)}" fetchpriority="high">` : ''}
    <div class="hero__shade"></div>
    <div class="shell hero__content">
      ${eyebrow(data)}
      <h1>${escapeHtml(data.title)}</h1>
      <p class="hero__lead">${escapeHtml(data.body)}</p>
      <a class="button button--primary" href="#contacto" data-track="hero-cta">${escapeHtml(data.ctaLabel || 'Solicitar información')}</a>
      ${facts ? `<ul class="facts">${facts}</ul>` : ''}
    </div>
  </section>`;
}

function renderText(block: LandingBlock): string {
  const data = block.data;
  return `<section class="section" id="${escapeHtml(block.id)}"><div class="shell prose">
    ${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2>${paragraphs(data.body)}
  </div></section>`;
}

function renderFeatureList(block: LandingBlock): string {
  const data = block.data;
  const items = array(data.items)
    .map(object)
    .map(
      (item, index) => `<article class="feature">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </article>`,
    )
    .join('');
  return `<section class="section section--soft" id="${escapeHtml(block.id)}"><div class="shell">
    <div class="section__head">${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2>${data.intro ? `<p>${escapeHtml(data.intro)}</p>` : ''}</div>
    <div class="feature-grid">${items}</div>
  </div></section>`;
}

function renderFaculty(block: LandingBlock): string {
  const data = block.data;
  const items = array(data.items)
    .map(object)
    .map((item) => ({
      name: text(item.name, 160),
      role: text(item.role, 240),
      imageUrl: safeUrl(item.imageUrl),
      imageAlt: text(item.imageAlt, 240),
    }))
    .filter((item) => item.imageUrl)
    .map(
      (item) => `<article class="faculty-card">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt || item.name || 'Docente del programa')}" loading="lazy">
        ${item.name || item.role ? `<div class="faculty-card__copy">${item.name ? `<h3>${escapeHtml(item.name)}</h3>` : ''}${item.role ? `<p>${escapeHtml(item.role)}</p>` : ''}</div>` : ''}
      </article>`,
    )
    .join('');
  const intro = text(data.intro);
  const note = text(data.note, 500);
  return `<section class="section faculty-section" id="${escapeHtml(block.id)}"><div class="shell">
    <div class="section__head section__head--split"><div>${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2></div>${intro ? `<p>${escapeHtml(intro)}</p>` : ''}</div>
    <div class="faculty-grid">${items}</div>
    ${note ? `<p class="section-note">${escapeHtml(note)}</p>` : ''}
  </div></section>`;
}

function renderGallery(block: LandingBlock): string {
  const data = block.data;
  const items = array(data.items)
    .map(object)
    .map((item) => ({
      imageUrl: safeUrl(item.imageUrl),
      imageAlt: text(item.imageAlt, 240),
      caption: text(item.caption, 240),
    }))
    .filter((item) => item.imageUrl)
    .map(
      (item) => `<figure class="gallery-card">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy">
        ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}
      </figure>`,
    )
    .join('');
  const intro = text(data.intro);
  return `<section class="section section--soft gallery-section" id="${escapeHtml(block.id)}"><div class="shell">
    <div class="section__head section__head--split"><div>${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2></div>${intro ? `<p>${escapeHtml(intro)}</p>` : ''}</div>
    <div class="editorial-gallery">${items}</div>
  </div></section>`;
}

function renderSchedule(block: LandingBlock): string {
  const data = block.data;
  const items = array(data.items)
    .map(object)
    .map(
      (item) => `<article class="schedule-card">
        <h3>${escapeHtml(item.title)}</h3>
        <p><strong>${escapeHtml(item.date)}</strong></p>
        <p>${escapeHtml(item.location)}</p>
        <p>${escapeHtml(item.schedule)}</p>
      </article>`,
    )
    .join('');
  return `<section class="section" id="${escapeHtml(block.id)}"><div class="shell">
    <div class="section__head">${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2></div>
    <div class="schedule-grid">${items}</div>
  </div></section>`;
}

function renderFaq(block: LandingBlock): string {
  const data = block.data;
  const items = array(data.items)
    .map(object)
    .map(
      (item, index) => `<details${index === 0 ? ' open' : ''}>
        <summary>${escapeHtml(item.question)}</summary>
        <p>${escapeHtml(item.answer)}</p>
      </details>`,
    )
    .join('');
  return `<section class="section section--soft" id="${escapeHtml(block.id)}"><div class="shell faq">
    ${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2>${items}
  </div></section>`;
}

function renderCta(block: LandingBlock): string {
  const data = block.data;
  const href = safeUrl(data.url, true) || '#contacto';
  const tracking = /(?:wa\.me|whatsapp\.com)/i.test(href)
    ? 'whatsapp'
    : /\.pdf(?:$|[?#])/i.test(href)
      ? 'brochure'
      : 'content-cta';
  return `<section class="section" id="${escapeHtml(block.id)}"><div class="shell cta-panel">
    <div>${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.body)}</p></div>
    <a class="button button--light" href="${escapeHtml(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''} data-track="${tracking}">${escapeHtml(data.label)}</a>
  </div></section>`;
}

function renderLeadForm(block: LandingBlock, apiBase: string): string {
  const data = block.data;
  const params = new URLSearchParams({
    area:
      text(data.area, 40) === 'educacion_ca'
        ? 'educacion_ca'
        : 'educacion_ep',
    curso: text(data.courseSlug, 200),
    titulo: text(data.courseTitle, 300),
    submit: text(data.submitLabel, 80) || 'Enviar información',
    captureSource: 'landing',
  });
  const privacyUrl = safeUrl(data.privacyUrl);
  if (privacyUrl) params.set('privacy', privacyUrl);
  const whatsappPhone = text(data.whatsappPhone, 30).replace(/\D/g, '');
  if (whatsappPhone) params.set('wa', whatsappPhone);
  const backgroundColor = color(data.backgroundColor, '');
  if (backgroundColor) params.set('bg', backgroundColor);
  const widgetUrl = `${apiBase}/widgets/educacion/lead-form.html?${params.toString()}`;
  return `<section class="contact" id="contacto"><div class="shell contact__grid">
    <div>${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.body)}</p></div>
    <iframe class="lead-frame" id="landingLeadFormFrame" src="${escapeHtml(widgetUrl)}" title="${escapeHtml(data.title || 'Formulario de contacto')}" loading="lazy" scrolling="no"></iframe>
  </div></section>`;
}

function renderFooter(block: LandingBlock): string {
  return `<footer><div class="shell">${escapeHtml(block.data.text)}</div></footer>`;
}

function renderBlock(block: LandingBlock, apiBase: string): string {
  switch (block.type) {
    case 'hero':
      return renderHero(block);
    case 'text':
      return renderText(block);
    case 'feature_list':
      return renderFeatureList(block);
    case 'faculty':
      return renderFaculty(block);
    case 'gallery':
      return renderGallery(block);
    case 'schedule':
      return renderSchedule(block);
    case 'faq':
      return renderFaq(block);
    case 'cta':
      return renderCta(block);
    case 'lead_form':
      return renderLeadForm(block, apiBase);
    case 'footer':
      return renderFooter(block);
  }
}

export function renderLandingHtml(input: {
  slug: string;
  name: string;
  content: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl: string;
  apiBase: string;
  gtmId?: string;
}): string {
  const document = normalizeLandingDocument(input.content);
  const title = text(input.seoTitle, 200) || text(input.name, 180);
  const description = text(input.seoDescription, 320);
  const ogImage = safeUrl(input.ogImageUrl);
  const canonical = safeUrl(input.canonicalUrl);
  const apiBase = safeUrl(input.apiBase).replace(/\/$/, '');
  const gtmId = /^GTM-[A-Z0-9]+$/.test(text(input.gtmId, 40).toUpperCase())
    ? text(input.gtmId, 40).toUpperCase()
    : '';
  const blocks = document.blocks
    .filter((block) => block.enabled)
    .map((block) => renderBlock(block, apiBase))
    .join('');
  const heroTitle = document.blocks.find(
    (block) => block.enabled && block.type === 'hero',
  )?.data.title;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  ${description ? `<meta property="og:description" content="${escapeHtml(description)}">` : ''}
  ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : ''}
  ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  ${gtmId ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${scriptJson(gtmId)});</script>` : ''}
  <link rel="stylesheet" href="${escapeHtml(apiBase)}/widgets/educacion/benton-sans.css">
  <style>
    :root{--primary:${document.theme.primary};--secondary:${document.theme.secondary};--accent:${document.theme.accent};--ink:${document.theme.ink};--surface:${document.theme.surface};--white:#fff;--line:#e8e4ec;--shell:1180px}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#fff;font-family:"BentonSansFB",Arial,Helvetica,sans-serif;line-height:1.55}img{display:block;max-width:100%}a{color:inherit}button,input{font:inherit}.shell{width:min(var(--shell),calc(100% - 40px));margin-inline:auto}.site-head{height:76px;display:flex;align-items:center;position:absolute;inset:0 0 auto;z-index:20;color:#fff}.site-head .shell{display:flex;align-items:center;justify-content:space-between;gap:24px}.site-logo{display:block;width:auto;max-width:210px;max-height:54px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border:0;border-radius:999px;font-weight:700;text-decoration:none;cursor:pointer}.button--primary{color:#fff;background:linear-gradient(100deg,var(--primary),var(--accent));box-shadow:0 12px 30px color-mix(in srgb,var(--primary) 28%,transparent)}.button--light{background:#fff;color:var(--primary)}.header-cta{min-height:42px;padding-inline:18px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.5);color:#fff}.hero{position:relative;min-height:720px;display:grid;align-items:end;background:#130b1a;color:#fff;overflow:hidden}.hero__image,.hero__shade{position:absolute;inset:0;width:100%;height:100%}.hero__image{object-fit:cover}.hero__shade{background:linear-gradient(90deg,rgba(11,5,18,.96) 0%,rgba(20,8,31,.82) 48%,rgba(20,8,31,.18) 100%)}.hero__content{position:relative;z-index:2;padding-block:150px 72px}.eyebrow{margin:0 0 13px;color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.hero .eyebrow{color:#f1bce0}.hero h1,.section h2,.contact h2{margin:0;max-width:850px;font-size:clamp(38px,6vw,76px);line-height:.98;letter-spacing:-.045em}.hero__lead{max-width:700px;margin:24px 0 30px;font-size:clamp(18px,2vw,22px);color:#eee4f3}.facts{display:flex;flex-wrap:wrap;gap:10px;margin:36px 0 0;padding:0;list-style:none}.facts li{display:grid;gap:3px;min-width:190px;padding:14px 16px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(255,255,255,.08);backdrop-filter:blur(10px)}.facts small{text-transform:uppercase;letter-spacing:.1em;color:#d6c9dd}.section{padding:96px 0}.section--soft{background:var(--surface)}.section h2,.contact h2{font-size:clamp(34px,4.5vw,58px)}.section__head{max-width:760px;margin-bottom:38px}.section__head>p:last-child,.prose p{font-size:18px;color:#5f5865}.prose{max-width:900px}.feature-grid,.schedule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.feature,.schedule-card{padding:28px;border:1px solid var(--line);border-radius:24px;background:#fff}.feature>span{color:var(--accent);font-size:13px;font-weight:700}.feature h3,.schedule-card h3{margin:10px 0 8px;font-size:24px}.feature p,.schedule-card p{margin:5px 0;color:#635c68}.cta-panel{display:flex;align-items:center;justify-content:space-between;gap:30px;padding:46px;border-radius:30px;background:linear-gradient(120deg,var(--primary),var(--secondary));color:#fff}.cta-panel h2{font-size:clamp(30px,4vw,50px)}.cta-panel .eyebrow{color:#f4c7e3}.faq{max-width:900px}.faq h2{margin-bottom:30px}.faq details{border-top:1px solid var(--line);padding:20px 0}.faq details:last-child{border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-size:18px;font-weight:700}.faq details p{margin:12px 0 0;color:#625b67}.contact{padding:100px 0;background:#120b18;color:#fff}.contact__grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);gap:60px;align-items:start}.contact__grid>div>p:last-child{font-size:20px;color:#d6cadb}.lead-frame{width:100%;min-height:650px;border:0;border-radius:26px;background:transparent}footer{padding:28px 0;background:#08050b;color:#d7cedb;text-align:center;font-size:13px}
    body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}.site-head{border-bottom:1px solid rgba(255,255,255,.12)}.header-cta,.button,.feature,.schedule-card,.faculty-card,.gallery-card{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}.header-cta:hover,.button:hover{transform:translateY(-2px)}.hero{min-height:760px}.hero:after{content:"";position:absolute;z-index:1;right:-12vw;bottom:-32vw;width:64vw;height:64vw;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 22%,transparent),transparent 65%);pointer-events:none}.hero__image{filter:saturate(.88) contrast(1.04)}.hero__content h1{max-width:920px;text-wrap:balance}.hero__lead{line-height:1.45}.facts li{min-width:210px;border-radius:18px}.facts strong{font-size:16px}.section__head--split{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);gap:60px;align-items:end;max-width:none}.section__head--split>p{margin:0;font-size:18px;color:#5f5865}.feature,.schedule-card{position:relative;overflow:hidden}.feature:after{content:"";position:absolute;inset:auto 0 0;height:4px;background:linear-gradient(90deg,var(--primary),var(--accent));transform:scaleX(.3);transform-origin:left;transition:transform .25s ease}.feature:hover,.schedule-card:hover{transform:translateY(-5px);border-color:color-mix(in srgb,var(--primary) 28%,var(--line));box-shadow:0 24px 60px rgba(55,20,75,.11)}.feature:hover:after{transform:scaleX(1)}.schedule-card{background:linear-gradient(145deg,#fff,var(--surface))}.faculty-section{color:#fff;background:radial-gradient(circle at 85% 5%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 34%),linear-gradient(135deg,#0d0812,#24102f 58%,#421154)}.faculty-section .eyebrow{color:#efb9dc}.faculty-section .section__head--split>p{color:#d7cadc}.faculty-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.faculty-card{position:relative;min-height:390px;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:#1b1220}.faculty-card:hover{transform:translateY(-6px);box-shadow:0 28px 70px rgba(0,0,0,.3)}.faculty-card img{width:100%;height:100%;min-height:390px;object-fit:cover;object-position:center 18%;filter:saturate(.88) contrast(1.03)}.faculty-card__copy{position:absolute;inset:auto 0 0;padding:50px 20px 20px;background:linear-gradient(transparent,rgba(10,6,13,.96));color:#fff}.faculty-card__copy h3{margin:0;font-size:20px}.faculty-card__copy p{margin:4px 0 0;color:#d9cedd;font-size:14px}.section-note{margin:18px 0 0;color:#aa9daf;font-size:13px}.editorial-gallery{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);grid-template-rows:repeat(2,250px);gap:16px}.gallery-card{position:relative;overflow:hidden;margin:0;border-radius:26px;background:#1b1220}.gallery-card:first-child{grid-row:1/3}.gallery-card:hover{transform:translateY(-4px);box-shadow:0 24px 60px rgba(55,20,75,.16)}.gallery-card img{width:100%;height:100%;object-fit:cover;transition:transform .55s ease}.gallery-card:hover img{transform:scale(1.035)}.gallery-card figcaption{position:absolute;inset:auto 14px 14px;padding:10px 13px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(13,8,18,.7);color:#fff;font-size:13px;backdrop-filter:blur(10px)}
    @media(max-width:1000px){.section__head--split{grid-template-columns:1fr;gap:20px}.faculty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.editorial-gallery{grid-template-rows:repeat(2,220px)}}
    @media(max-width:760px){.shell{width:min(100% - 28px,var(--shell))}.site-head{height:68px}.site-logo{max-width:155px}.header-cta{font-size:13px;padding-inline:14px}.hero{min-height:680px}.hero__shade{background:linear-gradient(0deg,rgba(11,5,18,.98) 0%,rgba(20,8,31,.68) 72%,rgba(20,8,31,.35) 100%)}.hero__content{padding-block:120px 45px}.facts{display:grid;grid-template-columns:1fr}.facts li{min-width:0}.section{padding:70px 0}.feature-grid,.schedule-grid,.contact__grid{grid-template-columns:1fr}.contact__grid{gap:32px}.cta-panel{align-items:flex-start;flex-direction:column;padding:32px 24px}.faculty-card,.faculty-card img{min-height:300px}.editorial-gallery{grid-template-columns:1fr;grid-template-rows:none}.gallery-card,.gallery-card:first-child{grid-row:auto;min-height:240px}.contact{padding:72px 0}}
  </style>
</head>
<body data-landing="${escapeHtml(input.slug)}">
  ${gtmId ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeHtml(gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : ''}
  <header class="site-head"><div class="shell">
    ${document.logoUrl ? `<img class="site-logo" src="${escapeHtml(document.logoUrl)}" alt="${escapeHtml(document.logoAlt)}">` : `<strong>${escapeHtml(document.logoAlt)}</strong>`}
    <a class="button header-cta" href="#contacto" data-track="header-cta">${escapeHtml(document.headerCtaLabel)}</a>
  </div></header>
  <main>${blocks}</main>
  <script>
  (function(){
    function track(event, detail){
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({event:event,landing:${scriptJson(input.slug)}},detail||{}));
    }
    document.querySelectorAll('[data-track]').forEach(function(el){
      el.addEventListener('click',function(){
        var action=el.getAttribute('data-track')||'cta';
        if(action==='whatsapp')track('click_whatsapp',{cta:action});
        else if(action==='brochure')track('download_brochure',{cta:action});
        else track('click_cta',{cta:action});
        if(el.getAttribute('href')==='#contacto')track('open_form',{cta:action});
      });
    });
    track('view_program',{programa:${scriptJson(text(heroTitle, 300))}});
    var frame=document.getElementById('landingLeadFormFrame');
    if(!frame)return;
    var widgetOrigin=${scriptJson(apiBase ? new URL(apiBase).origin : '')};
    var attributionKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'];
    function attribution(){
      var current={};var query=new URLSearchParams(window.location.search);
      attributionKeys.forEach(function(key){var value=query.get(key);if(value)current[key]=value;});
      var stored={};
      try{stored=JSON.parse(sessionStorage.getItem('mali_lead_attribution_v1')||'{}')||{};}catch(error){}
      if(Object.keys(current).length){stored=current;try{sessionStorage.setItem('mali_lead_attribution_v1',JSON.stringify(stored));}catch(error){}}
      return stored;
    }
    function leadContext(){
      var attrs=attribution();
      return {captureSource:'landing',pageUrl:window.location.href,referrer:document.referrer||'',utmSource:attrs.utm_source||'',utmMedium:attrs.utm_medium||'',utmCampaign:attrs.utm_campaign||'',utmContent:attrs.utm_content||'',utmTerm:attrs.utm_term||'',gclid:attrs.gclid||'',fbclid:attrs.fbclid||''};
    }
    function sendLeadContext(){
      if(frame.contentWindow&&widgetOrigin)frame.contentWindow.postMessage({type:'mali-lead-context',context:leadContext()},widgetOrigin);
    }
    frame.addEventListener('load',sendLeadContext);
    setTimeout(sendLeadContext,250);
    window.addEventListener('message',function(event){
      if(event.origin!==widgetOrigin||event.source!==frame.contentWindow||!event.data)return;
      if(event.data.type==='mali-lead-iframe-resize'&&event.data.height){frame.style.height=Math.max(420,Math.min(1400,Math.ceil(event.data.height)))+'px';return;}
      if(event.data.type==='mali-lead-submitted'){track('generate_lead',{programa:event.data.courseTitle||'',capture_source:'landing'});return;}
      if(event.data.type==='mali-lead-open-whatsapp'&&event.data.url){track('click_whatsapp',{cta:'lead-form'});window.open(event.data.url,'_blank','noopener,noreferrer');}
    });
  })();
  </script>
</body>
</html>`;
}
