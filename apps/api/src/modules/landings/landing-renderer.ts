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
  'curriculum',
  'investment',
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
  return Array.isArray(value) ? value : [];
}

function assetUrl(value: unknown, apiBase: string): string {
  const candidate = text(value, 1000);
  if (candidate.startsWith('/widgets/') && !candidate.includes('\\')) {
    return safeUrl(`${apiBase}${candidate}`);
  }
  return safeUrl(value);
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
    // El formulario tiene un destino estable para todos los CTA.
    if (type === 'lead_form') id = 'contacto';
    else if (id === 'contacto') id = 'seccion-contacto';
    const baseId = id;
    let suffix = 1;
    while (seen.has(id)) id = `${baseId}-${suffix++}`;
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
    logoWidth: Math.max(180, Math.min(340, Number(source.logoWidth) || 270)),
    leadFormLayout: source.leadFormLayout === 'sticky' ? 'sticky' : 'inline',
    navigation: array(source.navigation).map(object).map((item) => ({
      blockId: text(item.blockId, 80), label: text(item.label, 60),
    })).filter((item) => item.blockId && item.label),
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

function renderHero(block: LandingBlock, hasForm: boolean, apiBase: string): string {
  const data = block.data;
  const imageUrl = assetUrl(data.imageUrl, apiBase);
  const videoUrl = safeUrl(data.videoUrl);
  const background = color(data.backgroundColor, '#0022cc');
  const facts = array(data.facts)
    .map(object)
    .map(
      (item) =>
        `<li><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></li>`,
    )
    .join('');
  return `<section class="hero" id="${escapeHtml(block.id)}" style="--hero-bg:${background}">
    ${videoUrl ? `<video class="hero__video" muted loop playsinline preload="none" aria-hidden="true"${imageUrl ? ` poster="${escapeHtml(imageUrl)}"` : ''} data-video-src="${escapeHtml(videoUrl)}"></video><div class="hero__media-controls" role="group" aria-label="Controles del video"><button class="hero__sound" type="button" aria-pressed="false">Activar sonido</button><button class="hero__pause" type="button">Reproducir video</button></div>` : ''}
    <div class="hero__shade"></div>
    <div class="shell hero__content">
      ${eyebrow(data)}
      <h1>${escapeHtml(data.title)}</h1>
      <p class="hero__lead">${escapeHtml(data.body)}</p>
      ${hasForm ? `<a class="button button--primary" href="#contacto" data-track="hero-cta">${escapeHtml(data.ctaLabel || 'Solicitar información')}</a>` : ''}
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

function renderFaculty(block: LandingBlock, apiBase: string): string {
  const data = block.data;
  const faculty = array(data.items)
    .map(object)
    .map((item) => ({
      name: text(item.name, 160),
      role: text(item.role, 240),
      imageUrl: assetUrl(item.imageUrl, apiBase),
      imageAlt: text(item.imageAlt, 240),
      description: text(item.description, 1500),
      linkedinUrl: safeUrl(item.linkedinUrl),
    }))
    .filter((item) => item.imageUrl || item.name);
  const items = faculty
    .map(
      (item, index) => `<article class="faculty-card" id="${escapeHtml(block.id)}-docente-${index + 1}">
        ${item.imageUrl ? `<div class="faculty-card__photo"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt || item.name || 'Docente del programa')}" loading="lazy"></div>` : ''}
        <div class="faculty-card__copy">${item.name ? `<h3>${escapeHtml(item.name)}</h3>` : ''}${item.role ? `<p>${escapeHtml(item.role)}</p>` : ''}${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}${item.linkedinUrl ? `<a class="faculty-link" href="${escapeHtml(item.linkedinUrl)}" target="_blank" rel="noopener noreferrer">Ver LinkedIn<span class="sr-only"> de ${escapeHtml(item.name)}</span> ↗</a>` : ''}</div>
      </article>`,
    )
    .join('');
  const intro = text(data.intro);
  const note = text(data.note, 500);
  return `<section class="section faculty-section" id="${escapeHtml(block.id)}"><div class="shell">
    <div class="section__head section__head--split"><div>${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2></div>${intro ? `<p>${escapeHtml(intro)}</p>` : ''}</div>
    <div class="faculty-slider" data-faculty-slider>
      <div class="faculty-stage">
      <div class="faculty-carousel" id="${escapeHtml(block.id)}-carrusel" tabindex="0" role="region" aria-roledescription="carrusel" aria-label="Docentes del programa">${items}</div>
        <button class="faculty-arrow faculty-arrow--prev" type="button" data-faculty-prev aria-label="Ver docentes anteriores" aria-controls="${escapeHtml(block.id)}-carrusel" hidden>←</button>
        <button class="faculty-arrow faculty-arrow--next" type="button" data-faculty-next aria-label="Ver docentes siguientes" aria-controls="${escapeHtml(block.id)}-carrusel" hidden>→</button>
      </div>
      <div class="faculty-pagination" role="group" aria-label="Elegir docente" hidden>
        ${faculty.map((item, index) => `<button class="faculty-dot" type="button" data-faculty-index="${index}" aria-label="Ver a ${escapeHtml(item.name || `docente ${index + 1}`)}" aria-controls="${escapeHtml(block.id)}-docente-${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('')}
      </div>
      <div class="faculty-controls" hidden>
        <span class="faculty-position" role="status" aria-live="polite" aria-atomic="true"></span>
        <button class="faculty-autoplay" type="button" data-faculty-autoplay aria-label="Pausar carrusel">Pausar</button>
      </div>
    </div>
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

function renderCta(block: LandingBlock, hasForm: boolean): string {
  const data = block.data;
  const href = safeUrl(data.url, true) || '#contacto';
  if (href === '#contacto' && !hasForm) return '';
  const tracking = /(?:wa\.me|whatsapp\.com)/i.test(href)
    ? 'whatsapp'
    : /\.pdf(?:$|[?#])/i.test(href)
      ? 'brochure'
      : 'content-cta';
  const icon = tracking === 'whatsapp'
    ? '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l1.7-5.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="m8 7 2 3-1.2 1.2a8 8 0 0 0 4 4L14 14l3 2c-.4 1.2-1.4 2-2.6 1.7C10 16.8 7.2 14 6.3 9.6 6 8.4 6.8 7.4 8 7Z"/>'
    : tracking === 'brochure'
      ? '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M12 11v7m-3-3 3 3 3-3"/>'
      : '<path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>';
  return `<section class="section cta-section" id="${escapeHtml(block.id)}"><div class="shell cta-panel">
    <div class="cta-panel__copy">${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.body)}</p></div>
    <a class="button button--light cta-action cta-action--${tracking}" href="${escapeHtml(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''} data-track="${tracking}">
      <span class="cta-action__icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icon}</svg></span>
      <span class="cta-action__label">${escapeHtml(data.label || (tracking === 'whatsapp' ? 'Conversar por WhatsApp' : tracking === 'brochure' ? 'Descargar brochure' : 'Ver más'))}</span>
      <svg class="cta-action__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${href.startsWith('http') ? 'M7 17 17 7M7 7h10v10' : 'M5 12h14m-6-6 6 6-6 6'}"/></svg>
    </a>
  </div></section>`;
}

function renderLeadForm(block: LandingBlock, apiBase: string, preview: boolean, sticky = false): string {
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
    formTitle: text(data.title, 200),
    formDescription: text(data.body, 500),
  });
  const privacyUrl = safeUrl(data.privacyUrl);
  if (privacyUrl) params.set('privacy', privacyUrl);
  const whatsappPhone = text(data.whatsappPhone, 30).replace(/\D/g, '');
  if (whatsappPhone) params.set('wa', whatsappPhone);
  const backgroundColor = color(data.backgroundColor, '');
  if (backgroundColor) params.set('bg', backgroundColor);
  if (preview) params.set('preview', '1');
  if (sticky) params.set('compact', '1');
  const widgetUrl = `${apiBase}/widgets/educacion/lead-form.html?${params.toString()}`;
  if (sticky) return `<aside class="lead-sidebar" aria-label="Solicitar información"><div class="lead-panel" id="contacto" tabindex="-1">
    <button class="lead-close" type="button" aria-label="Cerrar formulario">Cerrar ×</button>
    <iframe class="lead-frame" id="landingLeadFormFrame" src="${escapeHtml(widgetUrl)}" title="${escapeHtml(data.title || 'Formulario de contacto')}" loading="lazy" scrolling="no"></iframe>
  </div></aside>`;
  return `<section class="contact" id="contacto"><div class="shell contact__grid">
    <div>${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.body)}</p></div>
    <iframe class="lead-frame" id="landingLeadFormFrame" src="${escapeHtml(widgetUrl)}" title="${escapeHtml(data.title || 'Formulario de contacto')}" loading="lazy" scrolling="no"></iframe>
  </div></section>`;
}

function renderFooter(block: LandingBlock): string {
  return `<footer><div class="shell">${escapeHtml(block.data.text)}</div></footer>`;
}

function renderCurriculum(block: LandingBlock): string {
  const data = block.data;
  const items = array(data.items).map(object).map((item, index) => `<details class="curriculum-module" name="curriculum-${escapeHtml(block.id)}"${index === 0 ? ' open' : ''}><summary><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(item.title)}</summary>${paragraphs(item.description)}</details>`).join('');
  return `<section class="section" id="${escapeHtml(block.id)}"><div class="shell"><div class="section__head">${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2>${paragraphs(data.intro)}</div>${items}${data.finalTitle ? `<article class="final-project"><h3>${escapeHtml(data.finalTitle)}</h3>${paragraphs(data.finalDescription)}</article>` : ''}</div></section>`;
}

function renderInvestment(block: LandingBlock, hasForm: boolean): string {
  const data = block.data;
  return `<section class="section investment" id="${escapeHtml(block.id)}"><div class="shell"><div class="investment-box">${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2><div class="investment-amount">${escapeHtml(data.currency || 'S/')} ${escapeHtml(data.enrollment)}</div><p>Matrícula${data.installments && data.installmentAmount ? ` + ${escapeHtml(data.installments)} cuotas de ${escapeHtml(data.currency || 'S/')} ${escapeHtml(data.installmentAmount)}` : ''}</p>${paragraphs(data.note)}${hasForm ? `<a class="button button--primary" href="#contacto" data-track="investment-cta">${escapeHtml(data.label || 'Consultar beneficios')}</a>` : ''}</div></div></section>`;
}

function renderBlock(block: LandingBlock, apiBase: string, hasForm: boolean, preview: boolean): string {
  switch (block.type) {
    case 'hero':
      return renderHero(block, hasForm, apiBase);
    case 'text':
      return renderText(block);
    case 'feature_list':
      return renderFeatureList(block);
    case 'faculty':
      return renderFaculty(block, apiBase);
    case 'gallery':
      return renderGallery(block);
    case 'schedule':
      return renderSchedule(block);
    case 'curriculum':
      return renderCurriculum(block);
    case 'investment':
      return renderInvestment(block, hasForm);
    case 'faq':
      return renderFaq(block);
    case 'cta':
      return renderCta(block, hasForm);
    case 'lead_form':
      return renderLeadForm(block, apiBase, preview);
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
  preview?: boolean;
}): string {
  const document = normalizeLandingDocument(input.content);
  const title = text(input.seoTitle, 200) || text(input.name, 180);
  const description = text(input.seoDescription, 320);
  const ogImage = safeUrl(input.ogImageUrl);
  const canonical = safeUrl(input.canonicalUrl);
  const apiBase = safeUrl(input.apiBase).replace(/\/$/, '');
  const gtmId = !input.preview && /^GTM-[A-Z0-9]+$/.test(text(input.gtmId, 40).toUpperCase())
    ? text(input.gtmId, 40).toUpperCase()
    : '';
  const enabled = document.blocks.filter((block) => block.enabled);
  const form = enabled.find((block) => block.type === 'lead_form');
  const sticky = !!form && document.leadFormLayout === 'sticky';
  const targets = new Set(enabled.map((block) => block.id));
  const neutralTypes = new Set<LandingBlockType>(['text', 'feature_list', 'gallery', 'schedule', 'curriculum', 'faq']);
  const sectionTones = new Map(enabled.filter((block) => neutralTypes.has(block.type))
    .map((block, index) => [block.id, index % 2 === 0 ? 'light' : 'soft']));
  const render = (block: LandingBlock) => {
    if (block.type === 'cta' && typeof block.data.url === 'string' &&
      block.data.url.startsWith('#') && !targets.has(block.data.url.slice(1))) {
      return renderBlock({ ...block, data: { ...block.data, url: '' } }, apiBase, !!form, !!input.preview);
    }
    const html = renderBlock(block, apiBase, !!form, !!input.preview);
    const tone = sectionTones.get(block.id);
    return tone ? html.replace(/^<section /, `<section data-section-tone="${tone}" `) : html;
  };
  const renderFlow = (flow: LandingBlock[]) => {
    const html: string[] = [];
    for (let index = 0; index < flow.length; index++) {
      const block = flow[index];
      const next = flow[index + 1];
      if (block.type === 'investment' && next?.type === 'cta' &&
        /(?:wa\.me|whatsapp\.com)/i.test(String(next.data.url ?? ''))) {
        html.push(`<div class="conversion-row">${render(block)}${render(next)}</div>`);
        index++;
      } else {
        html.push(render(block));
      }
    }
    return html.join('');
  };
  const heroIndex = enabled.findIndex((block) => block.type === 'hero');
  const split = heroIndex < 0 ? 0 : heroIndex + 1;
  const footers = sticky ? enabled.filter((block) => block.type === 'footer') : [];
  const ordinaryBlock = (block: LandingBlock) => block.type !== 'lead_form' && block.type !== 'footer';
  const blocks = sticky ? `${renderFlow(enabled.slice(0, split).filter(ordinaryBlock))}<div class="landing-body shell"><div class="landing-sections">${renderFlow(enabled.slice(split).filter(ordinaryBlock))}</div>${renderLeadForm(form!, apiBase, !!input.preview, true)}</div>${footers.map(render).join('')}` : renderFlow(enabled);
  const navigation = (document.navigation ?? []).filter((item) => enabled.some((block) => block.id === item.blockId && block.type !== 'footer'));
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
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#fff;font-family:"BentonSansFB",Arial,Helvetica,sans-serif;line-height:1.55}img{display:block;max-width:100%}a{color:inherit}button,input{font:inherit}.shell{width:min(var(--shell),calc(100% - 40px));margin-inline:auto}.site-head{height:76px;display:flex;align-items:center;position:absolute;inset:0 0 auto;z-index:20;color:#fff}.site-head .shell{display:flex;align-items:center;justify-content:space-between;gap:24px}.site-logo{display:block;width:auto;max-width:210px;max-height:54px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border:0;border-radius:999px;font-weight:700;text-decoration:none;cursor:pointer}.button--primary{color:#fff;background:linear-gradient(100deg,var(--primary),var(--accent));box-shadow:0 12px 30px color-mix(in srgb,var(--primary) 28%,transparent)}.button--light{background:#fff;color:var(--primary)}.header-cta{min-height:42px;padding-inline:18px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.5);color:#fff}.hero{position:relative;min-height:720px;display:grid;align-items:end;background:#130b1a;color:#fff;overflow:hidden}.hero__image,.hero__shade{position:absolute;inset:0;width:100%;height:100%}.hero__image{object-fit:cover}.hero__shade{background:linear-gradient(90deg,rgba(11,5,18,.96) 0%,rgba(20,8,31,.82) 48%,rgba(20,8,31,.18) 100%)}.hero__content{position:relative;z-index:2;padding-block:150px 72px}.eyebrow{margin:0 0 13px;color:var(--accent);font-size:var(--text-meta);font-weight:700;letter-spacing:.16em;text-transform:uppercase}.hero .eyebrow{color:#f1bce0}.hero h1,.section h2,.contact h2{margin:0;max-width:850px;font-size:var(--text-section);line-height:.98;letter-spacing:-.045em}.hero__lead{max-width:700px;margin:24px 0 30px;font-size:var(--text-section);color:#eee4f3}.facts{display:flex;flex-wrap:wrap;gap:10px;margin:36px 0 0;padding:0;list-style:none}.facts li{display:grid;gap:3px;min-width:190px;padding:14px 16px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(255,255,255,.08);backdrop-filter:blur(10px)}.facts small{text-transform:uppercase;letter-spacing:.1em;color:#d6c9dd}.section{padding:96px 0}.section--soft{background:var(--surface)}.section h2,.contact h2{font-size:var(--text-section)}.section__head{max-width:760px;margin-bottom:38px}.section__head>p:last-child:not(.eyebrow),.prose p:not(.eyebrow){font-size:var(--text-body);color:#5f5865}.prose{max-width:900px}.feature-grid,.schedule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.feature,.schedule-card{padding:28px;border:1px solid var(--line);border-radius:24px;background:#fff}.feature>span{color:var(--accent);font-size:var(--text-meta);font-weight:700}.feature h3,.schedule-card h3{margin:10px 0 8px;font-size:var(--text-subtitle)}.feature p,.schedule-card p{margin:5px 0;color:#635c68}.cta-panel{display:flex;align-items:center;justify-content:space-between;gap:30px;padding:46px;border-radius:30px;background:linear-gradient(120deg,var(--primary),var(--secondary));color:#fff}.cta-panel h2{font-size:var(--text-section)}.cta-panel .eyebrow{color:#f4c7e3}.faq{max-width:900px}.faq h2{margin-bottom:30px}.faq details{border-top:1px solid var(--line);padding:20px 0}.faq details:last-child{border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-size:var(--text-body);font-weight:700}.faq details p{margin:12px 0 0;color:#625b67}.contact{padding:100px 0;background:#120b18;color:#fff}.contact__grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);gap:60px;align-items:start}.contact__grid>div>p:last-child{font-size:var(--text-subtitle);color:#d6cadb}.lead-frame{width:100%;min-height:650px;border:0;border-radius:26px;background:transparent}footer{padding:28px 0;background:#08050b;color:#d7cedb;text-align:center;font-size:var(--text-meta)}
    body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}.site-head{border-bottom:1px solid rgba(255,255,255,.12)}.header-cta,.button,.feature,.schedule-card,.faculty-card,.gallery-card{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}.header-cta:hover,.button:hover{transform:translateY(-2px)}.hero{min-height:760px}.hero:after{content:"";position:absolute;z-index:1;right:-12vw;bottom:-32vw;width:64vw;height:64vw;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 22%,transparent),transparent 65%);pointer-events:none}.hero__image{filter:saturate(.88) contrast(1.04)}.hero__content h1{max-width:920px;text-wrap:balance}.hero__lead{line-height:1.45}.facts li{min-width:210px;border-radius:18px}.facts strong{font-size:var(--text-body)}.section__head--split{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr);gap:60px;align-items:end;max-width:none}.section__head--split>p{margin:0;font-size:var(--text-body);color:#5f5865}.feature,.schedule-card{position:relative;overflow:hidden}.feature:after{content:"";position:absolute;inset:auto 0 0;height:4px;background:linear-gradient(90deg,var(--primary),var(--accent));transform:scaleX(.3);transform-origin:left;transition:transform .25s ease}.feature:hover,.schedule-card:hover{transform:translateY(-5px);border-color:color-mix(in srgb,var(--primary) 28%,var(--line));box-shadow:0 24px 60px rgba(55,20,75,.11)}.feature:hover:after{transform:scaleX(1)}.schedule-card{background:linear-gradient(145deg,#fff,var(--surface))}.faculty-section{color:#fff;background:radial-gradient(circle at 85% 5%,color-mix(in srgb,var(--accent) 22%,transparent),transparent 34%),linear-gradient(135deg,#0d0812,#24102f 58%,#421154)}.faculty-section .eyebrow{color:#efb9dc}.faculty-section .section__head--split>p{color:#d7cadc}.faculty-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.faculty-card{position:relative;min-height:390px;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:#1b1220}.faculty-card:hover{transform:translateY(-6px);box-shadow:0 28px 70px rgba(0,0,0,.3)}.faculty-card img{width:100%;height:100%;min-height:390px;object-fit:cover;object-position:center 18%;filter:saturate(.88) contrast(1.03)}.faculty-card__copy{position:absolute;inset:auto 0 0;padding:50px 20px 20px;background:linear-gradient(transparent,rgba(10,6,13,.96));color:#fff}.faculty-card__copy h3{margin:0;font-size:var(--text-subtitle)}.faculty-card__copy p{margin:4px 0 0;color:#d9cedd;font-size:var(--text-meta)}.section-note{margin:18px 0 0;color:#aa9daf;font-size:var(--text-meta)}.editorial-gallery{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr);grid-template-rows:repeat(2,250px);gap:16px}.gallery-card{position:relative;overflow:hidden;margin:0;border-radius:26px;background:#1b1220}.gallery-card:first-child{grid-row:1/3}.gallery-card:hover{transform:translateY(-4px);box-shadow:0 24px 60px rgba(55,20,75,.16)}.gallery-card img{width:100%;height:100%;object-fit:cover;transition:transform .55s ease}.gallery-card:hover img{transform:scale(1.035)}.gallery-card figcaption{position:absolute;inset:auto 14px 14px;padding:10px 13px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(13,8,18,.7);color:#fff;font-size:var(--text-meta);backdrop-filter:blur(10px)}
    @media(max-width:1000px){.section__head--split{grid-template-columns:1fr;gap:20px}.faculty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.editorial-gallery{grid-template-rows:repeat(2,220px)}}
    @media(max-width:760px){.shell{width:min(100% - 28px,var(--shell))}.site-head{height:68px}.site-logo{max-width:155px}.header-cta{font-size:var(--text-meta);padding-inline:14px}.hero{min-height:680px}.hero__shade{background:linear-gradient(0deg,rgba(11,5,18,.98) 0%,rgba(20,8,31,.68) 72%,rgba(20,8,31,.35) 100%)}.hero__content{padding-block:120px 45px}.facts{display:grid;grid-template-columns:1fr}.facts li{min-width:0}.section{padding:70px 0}.feature-grid,.schedule-grid,.contact__grid{grid-template-columns:1fr}.contact__grid{gap:32px}.cta-panel{align-items:flex-start;flex-direction:column;padding:32px 24px}.faculty-card,.faculty-card img{min-height:300px}.editorial-gallery{grid-template-columns:1fr;grid-template-rows:none}.gallery-card,.gallery-card:first-child{grid-row:auto;min-height:240px}.contact{padding:72px 0}}

    .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    :root{--text-display:clamp(36px,4.5vw,64px);--text-section:32px;--text-subtitle:20px;--text-body:16px;--text-meta:14px;--header-height:100px;--page-width:1440px;--page-gutter:20px;--content-inset:32px}html{scroll-padding-top:calc(var(--header-height) + 20px)}[id]{scroll-margin-top:0}
    .site-head{height:var(--header-height);position:sticky;top:0;background:#fff;color:var(--ink);border-bottom:1px solid var(--line);z-index:50}
    .site-head .shell{width:min(1440px,calc(100% - 40px));gap:20px}.site-logo{width:var(--logo-width);max-width:100%;max-height:76px;object-fit:contain}.brand{flex-shrink:0;max-width:30%}.header-cta{background:var(--primary);color:#fff;border:0;white-space:nowrap}
    .site-nav{display:flex;align-items:center;gap:18px}.site-nav a{font-size:var(--text-meta);text-decoration:none;font-weight:700}.site-nav a:hover,.site-nav a[aria-current]{color:var(--primary)}.nav-toggle{display:none;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:10px;cursor:pointer}
    .hero{background:var(--hero-bg,#0022cc);min-height:580px}.hero:after{display:none}.hero__content{padding-block:80px 56px}.hero h1{font-size:var(--text-section)}.hero__shade{background:linear-gradient(90deg,var(--hero-bg) 4%,color-mix(in srgb,var(--hero-bg) 85%,transparent) 42%,color-mix(in srgb,var(--hero-bg) 25%,transparent) 80%),linear-gradient(0deg,var(--hero-bg),transparent 40%)}
    .hero__video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.65}.hero__media-controls{position:absolute;right:24px;bottom:20px;left:24px;z-index:3;display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}.hero__media-controls button{min-height:44px;color:#fff;background:rgba(0,0,0,.55);border:1px solid #fff;border-radius:8px;padding:8px 12px;font-size:var(--text-meta);cursor:pointer}.hero__media-controls button:focus-visible{outline:3px solid #fff;outline-offset:3px}.hero:has(.hero__media-controls) .hero__content{padding-bottom:100px}.hero .facts{margin-top:24px}.hero .facts li{min-width:160px}
    .section{padding:52px 0}.section__head{margin-bottom:24px}.contact{padding:56px 0}.section h2,.contact h2{font-size:var(--text-section);line-height:1.08}.feature,.schedule-card{padding:22px;border-radius:18px}.section__head--split{gap:24px}.cta-panel{padding:30px;gap:20px}
    .faculty-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.faculty-card{min-height:0;display:flex;flex-direction:column}.faculty-card img{width:100%;height:280px;min-height:0;object-fit:cover;object-position:center 18%}.faculty-card__copy{position:static;padding:20px;background:#1b1220;flex:1}.faculty-card__copy p{line-height:1.55}.faculty-link{display:inline-flex;margin-top:14px;color:#fff;text-underline-offset:4px;font-weight:700}
    .curriculum-module{border:1px solid var(--line);border-radius:14px;margin-bottom:10px;background:#fff}.curriculum-module summary{padding:18px;cursor:pointer;font-weight:700;list-style-position:inside}.curriculum-module summary span{display:inline-block;margin-right:12px;color:var(--primary)}.curriculum-module p{padding:0 20px;margin:0 0 20px;color:#5f5865}.final-project{padding:24px;border-radius:16px;background:var(--primary);color:#fff;margin-top:18px}.final-project h3{margin:0 0 10px;font-size:var(--text-subtitle)}.final-project p{margin:0}
    .investment{padding-top:0}.section.investment{padding-bottom:12px}.section.cta-section{padding-block:12px}.landing-sections>.cta-section+.section--soft{margin-top:12px}.investment-box{border:1px solid var(--line);border-radius:24px;padding:30px;background:var(--surface)}.investment-box h2{font-size:var(--text-section)}.investment-amount{font-size:var(--text-section);font-weight:800;color:var(--primary);margin-top:20px}.investment-box p{max-width:720px}.investment-box .button{margin-top:10px}
    .landing-body{width:min(1440px,calc(100% - 40px));display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:32px;align-items:stretch}.landing-sections{min-width:0}.landing-sections>.section>.shell,.landing-sections>.contact>.shell{width:100%}.landing-sections>.section--soft,.landing-sections>.faculty-section{padding-inline:24px;border-radius:24px;margin-block:16px}.landing-sections .section__head--split{display:block}.landing-sections .section__head--split>p{margin-top:18px}.landing-sections .editorial-gallery{grid-template-columns:1.2fr 1fr;grid-template-rows:repeat(2,190px)}
    .lead-sidebar{padding-block:24px;min-width:0}.lead-panel{position:sticky;top:calc(var(--header-height) + 16px);max-height:calc(100dvh - var(--header-height) - 32px);overflow:auto;border-radius:20px;background:#b4b3ff;border:1px solid var(--line);overscroll-behavior:contain}.lead-panel .lead-frame{display:block;width:100%;height:1px;min-height:0;border-radius:0}.lead-close,.lead-toggle{display:none}.landing-body:has(+footer){margin-bottom:16px}
    @media(min-width:1101px){.lead-panel{visibility:visible!important;transform:none!important}}
    @media(max-width:1100px){:root{--header-height:90px}.site-logo{max-height:68px}.brand{max-width:50%}.nav-toggle{display:block;margin-left:auto}.site-nav{display:none;position:absolute;top:100%;left:0;right:0;padding:20px;background:#fff;border-bottom:1px solid var(--line);flex-wrap:wrap}.site-nav.is-open{display:flex}.landing-body{display:block;width:min(1180px,calc(100% - 32px))}.lead-sidebar{padding:0}.lead-panel{position:fixed;left:auto;right:16px;bottom:88px;top:auto;width:min(420px,calc(100% - 32px));max-height:calc(100dvh - var(--header-height) - 100px);z-index:70;visibility:hidden;transform:translateY(20px);opacity:0;pointer-events:none}.lead-panel.is-open{visibility:visible;transform:none;opacity:1;pointer-events:auto}.lead-close{display:block;position:sticky;top:0;width:100%;border:0;background:#fff;padding:12px;text-align:right;font-weight:700;cursor:pointer;z-index:1}.lead-toggle{display:block;position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:75;max-width:calc(100% - 32px);white-space:nowrap;background:var(--primary);color:#fff;border:0;border-radius:999px;padding:16px 24px;font-weight:700;cursor:pointer}.lead-toggle[hidden]{display:none}.landing-sections .editorial-gallery{grid-template-columns:1.2fr 1fr}.landing-sections>.section--soft,.landing-sections>.faculty-section{padding-inline:20px}}
    @media(max-width:760px){:root{--header-height:84px}.site-head .shell{width:calc(100% - 24px);gap:10px}.site-logo{width:min(var(--logo-width),210px);max-height:62px}.brand{max-width:52%}.header-cta{display:none}.hero{min-height:0}.hero__content{padding-block:52px 40px}.hero__shade{background:linear-gradient(0deg,var(--hero-bg),color-mix(in srgb,var(--hero-bg) 72%,transparent))}.section{padding-block:36px}.contact{padding-block:36px}.section__head{margin-bottom:20px}.landing-sections>.section--soft,.landing-sections>.faculty-section{padding-inline:16px}.faculty-grid{grid-template-columns:1fr 1fr;gap:12px}.faculty-card img{height:200px}.faculty-card__copy{padding:14px}.faculty-card__copy h3{font-size:var(--text-body)}.faculty-card__copy p{font-size:var(--text-meta)}.landing-sections .editorial-gallery{grid-template-columns:1fr;grid-template-rows:none}.gallery-card,.gallery-card:first-child{grid-row:auto;min-height:220px}.investment-box{padding:24px}.investment-box h2{font-size:var(--text-section)}.investment-amount{font-size:var(--text-section)}footer{padding-bottom:86px}}
    @media(max-width:400px){.faculty-grid{grid-template-columns:1fr}.faculty-card img{height:280px}}
    .faculty-slider{min-width:0}.faculty-carousel{position:relative;display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:0;overscroll-behavior-x:contain;padding:6px 0 14px}.faculty-carousel:focus-visible{outline:2px solid #fff;outline-offset:5px;border-radius:6px}
    .faculty-carousel,.lead-panel{scrollbar-width:none;-ms-overflow-style:none}.faculty-carousel::-webkit-scrollbar,.lead-panel::-webkit-scrollbar{display:none;width:0;height:0}
    .faculty-carousel .faculty-card{flex:0 0 280px;min-width:0;min-height:0;scroll-snap-align:start;scroll-snap-stop:always;display:flex;flex-direction:column;transform:none}.faculty-card__photo{position:relative;width:100%;aspect-ratio:3/4;overflow:hidden;background:#130b1a;flex-shrink:0}.faculty-carousel .faculty-card img{position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;object-fit:cover;object-position:center top;filter:none}.faculty-carousel .faculty-card__copy{position:static;padding:20px;flex:1;display:flex;flex-direction:column;background:#1b1220}.faculty-carousel .faculty-card__copy p{font-size:var(--text-meta);line-height:1.55}.faculty-carousel .faculty-link{margin-top:auto;padding-top:16px}
    .faculty-controls{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px}.faculty-controls[hidden]{display:none}.faculty-position{margin-right:auto;font-size:var(--text-meta);color:#d7cadc}.faculty-controls button{width:44px;height:44px;border:1px solid rgba(255,255,255,.4);border-radius:50%;background:transparent;color:#fff;font:inherit;font-size:var(--text-subtitle);cursor:pointer}.faculty-controls button:disabled{opacity:.35;cursor:default}.faculty-controls button:focus-visible{outline:2px solid #fff;outline-offset:3px}
    .faculty-controls .faculty-autoplay{width:auto;padding-inline:14px;border-radius:999px;font-size:var(--text-meta)}
    .faculty-pagination{display:flex;justify-content:center;flex-wrap:wrap;gap:4px;margin-top:12px}.faculty-pagination[hidden]{display:none}.faculty-dot{display:grid;place-items:center;width:24px;height:32px;padding:0;border:0;border-radius:6px;background:transparent;cursor:pointer}.faculty-dot:before{content:"";width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);transition:background .2s,transform .2s}.faculty-dot[aria-current="true"]:before{background:var(--accent);transform:scale(1.4)}.faculty-dot:focus-visible{outline:2px solid #fff;outline-offset:2px}.faculty-carousel .faculty-card.is-current{border-color:var(--accent)}
    @media(max-width:760px){.faculty-carousel{gap:14px}.faculty-carousel .faculty-card{flex-basis:85%;max-width:280px}.faculty-carousel .faculty-card__copy h3{font-size:var(--text-subtitle)}}
    .section .cta-panel{display:grid;grid-template-columns:minmax(0,1fr) 248px;align-items:center;gap:28px}.cta-panel__copy{min-width:0}.cta-panel__copy h2{font-size:var(--text-section);line-height:1.12}.cta-panel__copy>p:last-child{margin-bottom:0}.cta-panel .cta-action{--action-tone:var(--primary);display:flex;gap:12px;width:100%;min-height:76px;padding:14px 16px;border:1px solid rgba(255,255,255,.45);border-radius:18px;background:#fff;color:var(--primary);text-align:left;line-height:1.3;box-shadow:0 8px 24px rgba(0,0,0,.12)}.cta-panel .cta-action--whatsapp{--action-tone:#128c5e}.cta-action__icon{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:13px;color:var(--action-tone);background:color-mix(in srgb,var(--action-tone) 10%,#fff)}.cta-action__label{flex:1;min-width:0;font-size:var(--text-body);overflow-wrap:anywhere}.cta-action__arrow{flex-shrink:0;opacity:.6}.cta-action:hover .cta-action__arrow{opacity:1}.cta-action:focus-visible{outline:3px solid #fff;outline-offset:5px}
    @media(max-width:760px){.section .cta-panel{grid-template-columns:1fr;gap:22px}.cta-panel .cta-action{min-height:68px}.cta-action__label{font-size:var(--text-body)}}
    /* Un mismo contenedor y sangría para el hero y el contenido de cada bloque. */
    .hero__content,.site-head .shell,.landing-body{width:min(var(--page-width),calc(100% - 2 * var(--page-gutter)))}
    .hero__content,.site-head .shell{padding-inline:var(--content-inset)}
    .site-logo{object-position:left center}
    .landing-sections>.section{padding-inline:0}
    .landing-sections>.section>.shell{width:100%;max-width:none;margin-inline:0;padding-inline:var(--content-inset)}
    .landing-sections>.cta-section>.cta-panel{padding:30px var(--content-inset)}
    .landing-sections>.investment>.shell{padding-inline:0}
    .investment-box{padding-inline:calc(var(--content-inset) - 1px)}
    .landing-sections .prose p,.landing-sections .faq details{max-width:900px}
    .hero__video{opacity:1}
    .hero:has(.hero__video) .hero__shade{background:linear-gradient(90deg,color-mix(in srgb,var(--hero-bg) 60%,transparent),color-mix(in srgb,var(--hero-bg) 30%,transparent) 48%,color-mix(in srgb,var(--hero-bg) 4%,transparent)),linear-gradient(0deg,color-mix(in srgb,var(--hero-bg) 55%,transparent),transparent 45%)}
    .faculty-stage{position:relative}
    .faculty-arrow{position:absolute;top:50%;z-index:2;display:grid;place-items:center;transform:translateY(-50%);width:44px;height:44px;border:1px solid var(--line);border-radius:50%;background:#fff;color:var(--primary);box-shadow:0 4px 16px rgba(0,0,0,.25);font-size:24px;cursor:pointer}
    .faculty-arrow[hidden]{display:none}.faculty-arrow--prev{left:-22px}.faculty-arrow--next{right:-22px}.faculty-arrow:disabled{opacity:.45;cursor:default}.faculty-arrow:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
    @media(max-width:760px){.faculty-arrow--prev{left:-16px}.faculty-arrow--next{right:-16px}.hero:has(.hero__video) .hero__shade{background:linear-gradient(0deg,color-mix(in srgb,var(--hero-bg) 65%,transparent),color-mix(in srgb,var(--hero-bg) 30%,transparent))}}
    /* Alternar los fondos según el orden de los bloques visibles. */
    .section[data-section-tone="light"]{background:var(--white)}
    .section[data-section-tone="soft"]{background:color-mix(in srgb,var(--primary) 8%,var(--white))}
    .landing-sections>.section[data-section-tone]{border-radius:24px}
    @media(max-width:1100px){:root{--page-gutter:16px;--content-inset:24px}}
    @media(max-width:760px){:root{--content-inset:20px}}
    .conversion-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:stretch;width:min(var(--page-width),calc(100% - 2 * var(--page-gutter)));margin-inline:auto;padding-bottom:12px}
    .landing-sections>.conversion-row{width:100%;margin-inline:0}
    .conversion-row>.section{display:flex;min-width:0;padding:0}
    .conversion-row>.investment>.shell{display:flex;width:100%;max-width:none;margin:0;padding:0}
    .conversion-row .investment-box{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:29px calc(var(--content-inset) - 1px)}
    .conversion-row>.cta-section>.cta-panel{display:flex;flex-direction:column;align-items:flex-start;gap:24px;width:100%;max-width:none;margin:0;padding:30px var(--content-inset)}
    .conversion-row .section h2{font-size:var(--text-section);line-height:1.12}
    .conversion-row .investment-box>.button,.conversion-row .cta-action{margin-top:auto}
    .conversion-row .cta-action{width:100%}
    @media(max-width:760px){.conversion-row{grid-template-columns:1fr}.conversion-row .section h2{font-size:var(--text-section)}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{transition:none!important;animation:none!important}}

    /* Escala común: principal, sección, subtítulo, cuerpo y auxiliar. */
    body{font-size:var(--text-body);line-height:1.6}
    .hero h1{font-size:var(--text-display);line-height:1.05}
    .hero__lead,.contact__grid>div>p:last-child:not(.eyebrow){font-size:var(--text-body);line-height:1.6}
    .section h2,.contact h2,.cta-panel__copy h2,.investment-box h2,.conversion-row .section h2{font-size:var(--text-section);line-height:1.15;font-weight:700}
    .feature h3,.schedule-card h3,.final-project h3,.faculty-card__copy h3,.faculty-carousel .faculty-card__copy h3{font-size:var(--text-subtitle);line-height:1.3}
    .section p:not(.eyebrow):not(.section-note),.faculty-carousel .faculty-card__copy p{font-size:var(--text-body);line-height:1.6}
    .eyebrow,.section-note,.faculty-position,.facts small{font-size:var(--text-meta);line-height:1.5}
    @media(max-width:760px){:root{--text-section:28px}}
  </style>
</head>
<body data-landing="${escapeHtml(input.slug)}" style="--logo-width:${document.logoWidth}px">
  ${gtmId ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeHtml(gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : ''}
  <header class="site-head"><div class="shell">
    <a class="brand" href="#inicio" aria-label="MALI Educación, inicio">${document.logoUrl ? `<img class="site-logo" src="${escapeHtml(document.logoUrl)}" alt="${escapeHtml(document.logoAlt)}">` : `<strong>${escapeHtml(document.logoAlt)}</strong>`}</a>
    ${navigation.length ? `<button class="nav-toggle" type="button" aria-controls="landing-nav" aria-expanded="false">Menú ☰</button><nav class="site-nav" id="landing-nav" aria-label="Secciones de la landing">${navigation.map((item) => `<a href="#${escapeHtml(item.blockId)}">${escapeHtml(item.label)}</a>`).join('')}</nav>` : ''}
    ${form ? `<a class="button header-cta" href="#contacto" data-track="header-cta">${escapeHtml(document.headerCtaLabel)}</a>` : ''}
  </div></header>
  <main id="inicio">${blocks}</main>
  ${sticky ? '<button class="lead-toggle" type="button" aria-controls="contacto" aria-expanded="false" hidden>Solicitar información</button>' : ''}
  <script>
  (function(){
    function track(event, detail){
      if(${input.preview ? 'true' : 'false'})return;
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

    var menu=document.querySelector('.nav-toggle'),nav=document.getElementById('landing-nav');
    function closeMenu(){if(menu&&nav){menu.setAttribute('aria-expanded','false');nav.classList.remove('is-open');}}
    if(menu&&nav){menu.addEventListener('click',function(){var open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',closeMenu);});}
    document.querySelectorAll('[data-faculty-slider]').forEach(function(slider){
      var track=slider.querySelector('.faculty-carousel');
      var cards=Array.from(track.querySelectorAll('.faculty-card'));
      var controls=slider.querySelector('.faculty-controls');
      var previous=slider.querySelector('[data-faculty-prev]');
      var next=slider.querySelector('[data-faculty-next]');
      var position=slider.querySelector('.faculty-position');
      var playback=slider.querySelector('[data-faculty-autoplay]');
      var pagination=slider.querySelector('.faculty-pagination');
      var dots=Array.from(slider.querySelectorAll('.faculty-dot'));
      var motion=window.matchMedia('(prefers-reduced-motion: reduce)');
      var timer=null,userPaused=false,touching=false,inView=false;
      var activeIndex=0,selectedByControl=false;
      if(!cards.length)return;
      function scheduleFaculty(){
        clearTimeout(timer);
        playback.hidden=motion.matches;
        playback.textContent=userPaused?'Reanudar':'Pausar';
        playback.setAttribute('aria-label',userPaused?'Reanudar carrusel':'Pausar carrusel');
        var keyboardReading=track.matches(':focus-visible')||!!track.querySelector(':focus-visible');
        position.setAttribute('aria-live',userPaused||motion.matches||keyboardReading?'polite':'off');
        if(userPaused||motion.matches||touching||document.hidden||!inView||keyboardReading||track.scrollWidth<=track.clientWidth+2)return;
        timer=setTimeout(function(){
          selectFaculty((activeIndex+1)%cards.length);
          scheduleFaculty();
        },5000);
      }
      function updateFaculty(){
        controls.hidden=track.scrollWidth<=track.clientWidth+2;
        previous.hidden=next.hidden=controls.hidden;
        pagination.hidden=cards.length<2;
        if(!selectedByControl)activeIndex=closestFaculty();
        previous.disabled=activeIndex===0;
        next.disabled=activeIndex===cards.length-1;
        dots.forEach(function(dot,index){dot.setAttribute('aria-current',String(index===activeIndex));cards[index].classList.toggle('is-current',index===activeIndex);});
        var bounds=track.getBoundingClientRect();
        var visible=cards.map(function(card,index){var rect=card.getBoundingClientRect();var overlap=Math.min(rect.right,bounds.right)-Math.max(rect.left,bounds.left);return overlap>Math.min(rect.width,bounds.width)/2?index:-1;}).filter(function(index){return index>=0;});
        if(visible.length){var first=visible[0]+1,last=visible[visible.length-1]+1;position.textContent=(first===last?String(first):first+'–'+last)+' de '+cards.length;}
      }
      function closestFaculty(){
        var closest=0;
        cards.forEach(function(card,index){if(Math.abs(card.offsetLeft-track.scrollLeft)<Math.abs(cards[closest].offsetLeft-track.scrollLeft))closest=index;});
        return closest;
      }
      function selectFaculty(index){
        activeIndex=Math.max(0,Math.min(cards.length-1,index));
        selectedByControl=true;
        track.scrollTo({left:cards[activeIndex].offsetLeft,behavior:motion.matches?'instant':'smooth'});
        updateFaculty();
      }
      function moveFaculty(direction){
        selectFaculty(activeIndex+direction);
      }
      dots.forEach(function(dot,index){dot.addEventListener('click',function(){selectFaculty(index);scheduleFaculty();});});
      track.addEventListener('pointerdown',function(){selectedByControl=false;},{passive:true});
      previous.addEventListener('click',function(){moveFaculty(-1);scheduleFaculty();});
      next.addEventListener('click',function(){moveFaculty(1);scheduleFaculty();});
      playback.addEventListener('click',function(){userPaused=!userPaused;scheduleFaculty();});
      slider.addEventListener('pointerdown',function(event){if(event.pointerType==='touch'){touching=true;scheduleFaculty();}},{passive:true});
      window.addEventListener('pointerup',function(){if(touching){touching=false;scheduleFaculty();}},{passive:true});
      window.addEventListener('pointercancel',function(){if(touching){touching=false;scheduleFaculty();}},{passive:true});
      slider.addEventListener('focusin',scheduleFaculty);
      slider.addEventListener('focusout',function(){setTimeout(scheduleFaculty,0);});
      track.addEventListener('wheel',function(){selectedByControl=false;scheduleFaculty();},{passive:true});
      document.addEventListener('visibilitychange',scheduleFaculty);
      motion.addEventListener('change',scheduleFaculty);
      if(window.IntersectionObserver)new IntersectionObserver(function(entries){inView=entries[0].isIntersecting&&entries[0].intersectionRatio>=.1;scheduleFaculty();},{threshold:.1}).observe(track);
      else{inView=true;scheduleFaculty();}
      track.addEventListener('scroll',updateFaculty,{passive:true});
      track.addEventListener('keydown',function(event){
        if(event.target!==track)return;
        if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();moveFaculty(event.key==='ArrowRight'?1:-1);}
        else if(event.key==='Home'||event.key==='End'){event.preventDefault();selectFaculty(event.key==='Home'?0:cards.length-1);}
      });
      if(window.ResizeObserver)new ResizeObserver(function(){updateFaculty();scheduleFaculty();}).observe(track);
      else window.addEventListener('resize',updateFaculty);
      updateFaculty();
    });
    var video=document.querySelector('.hero__video'),pause=document.querySelector('.hero__pause'),sound=document.querySelector('.hero__sound');
    if(video){
      var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
      var attemptedAutoplay=false;
      var syncVideoControls=function(){if(pause)pause.textContent=video.paused?'Reproducir video':'Pausar video';if(sound){var audible=!video.muted&&video.volume>0;sound.textContent=audible?'Silenciar video':'Activar sonido';sound.setAttribute('aria-pressed',String(audible));}};
      var playVideo=function(){if(!video.src)video.src=video.dataset.videoSrc;return video.play();};
      ['play','pause','volumechange','ended'].forEach(function(event){video.addEventListener(event,syncVideoControls);});
      var loadVideo=function(){if(reduced.matches){video.pause();syncVideoControls();return;}if(!attemptedAutoplay){attemptedAutoplay=true;video.muted=false;}playVideo().then(syncVideoControls).catch(function(){if(reduced.matches){syncVideoControls();return;}video.muted=true;playVideo().then(syncVideoControls).catch(syncVideoControls);});};
      loadVideo();reduced.addEventListener('change',loadVideo);
      if(pause)pause.addEventListener('click',function(){attemptedAutoplay=true;if(video.paused)playVideo().then(syncVideoControls).catch(syncVideoControls);else video.pause();});
      if(sound)sound.addEventListener('click',function(){attemptedAutoplay=true;if(!video.muted&&video.volume>0){video.muted=true;}else{video.muted=false;video.volume=1;if(video.paused)playVideo().then(syncVideoControls).catch(function(){video.muted=true;syncVideoControls();});}syncVideoControls();});
    }
    var panel=document.querySelector('.lead-panel'),toggle=document.querySelector('.lead-toggle'),close=document.querySelector('.lead-close');
    var narrow=window.matchMedia('(max-width:1100px)');
    var hero=document.querySelector('.hero'),footer=document.querySelector('footer');
    function setPanel(open){if(!panel)return;panel.classList.toggle('is-open',open);panel.inert=narrow.matches&&!open;panel.setAttribute('aria-hidden',String(narrow.matches&&!open));if(toggle)toggle.setAttribute('aria-expanded',String(open));}
    function syncPanel(){if(!panel)return;if(!narrow.matches){setPanel(false);if(toggle)toggle.hidden=true;return;}var pastHero=!hero||hero.getBoundingClientRect().bottom<=100;var beforeFooter=!footer||footer.getBoundingClientRect().top>window.innerHeight;if(toggle)toggle.hidden=(!pastHero||!beforeFooter)&&!panel.classList.contains('is-open');}
    if(panel){
      setPanel(false);syncPanel();narrow.addEventListener('change',function(){setPanel(false);syncPanel();});window.addEventListener('scroll',syncPanel,{passive:true});window.addEventListener('resize',syncPanel);
      if(toggle)toggle.addEventListener('click',function(){setPanel(!panel.classList.contains('is-open'));syncPanel();if(panel.classList.contains('is-open')&&close)close.focus();});
      if(close)close.addEventListener('click',function(){setPanel(false);syncPanel();if(toggle&&!toggle.hidden)toggle.focus();});
      document.querySelectorAll('a[href="#contacto"]').forEach(function(a){a.addEventListener('click',function(e){if(narrow.matches){e.preventDefault();setPanel(true);syncPanel();if(close)close.focus();}});});
    }
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeMenu();if(close&&narrow.matches&&panel.classList.contains('is-open'))close.click();}});
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
      if(event.data.type==='mali-lead-close'&&close&&narrow.matches){close.click();return;}
      if(event.data.type==='mali-lead-iframe-resize'&&Number.isFinite(event.data.height)){frame.style.height=Math.max(${sticky ? 180 : 420},Math.min(1400,Math.ceil(event.data.height)))+'px';return;}
      if(event.data.type==='mali-lead-submitted'){track('generate_lead',{programa:event.data.courseTitle||'',capture_source:'landing'});return;}
      if(event.data.type==='mali-lead-open-whatsapp'&&event.data.url){track('click_whatsapp',{cta:'lead-form'});window.open(event.data.url,'_blank','noopener,noreferrer');}
    });
  })();
  </script>
</body>
</html>`;
}
