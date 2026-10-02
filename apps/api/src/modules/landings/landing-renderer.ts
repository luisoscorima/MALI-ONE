import type {
  LandingBlock,
  LandingBlockType,
  LandingDocument,
} from '@mali-one/shared';

const BLOCK_TYPES = new Set<LandingBlockType>([
  'hero',
  'text',
  'feature_list',
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
  const config = {
    endpoint: `${apiBase}/api/widgets/educacion/leads`,
    area:
      text(data.area, 40) === 'educacion_ca'
        ? 'educacion_ca'
        : 'educacion_ep',
    courseSlug: text(data.courseSlug, 200),
    courseTitle: text(data.courseTitle, 300),
  };
  const privacyUrl = safeUrl(data.privacyUrl);
  return `<section class="contact" id="contacto"><div class="shell contact__grid">
    <div>${eyebrow(data)}<h2>${escapeHtml(data.title)}</h2><p>${escapeHtml(data.body)}</p></div>
    <form class="lead-form" id="landingLeadForm" data-config='${escapeHtml(scriptJson(config))}'>
      <div class="form-grid">
        <label>Nombres*<input name="nombres" autocomplete="given-name" required maxlength="120"></label>
        <label>Apellidos*<input name="apellidos" autocomplete="family-name" required maxlength="160"></label>
        <label>Celular / WhatsApp*<input name="celular" autocomplete="tel" inputmode="tel" required minlength="7" maxlength="20"></label>
        <label>Correo electrónico<input name="email" autocomplete="email" type="email" maxlength="160"></label>
      </div>
      <label class="check"><input name="optInMarketing" type="checkbox"> <span>Autorizo el envío de publicidad e información comercial.</span></label>
      <label class="check"><input name="acceptPrivacy" type="checkbox" required> <span>He leído y acepto ${privacyUrl ? `<a href="${escapeHtml(privacyUrl)}" target="_blank" rel="noopener noreferrer">las políticas de privacidad</a>` : 'las políticas de privacidad'}.*</span></label>
      <button class="button button--primary" type="submit">${escapeHtml(data.submitLabel || 'Enviar información')}</button>
      <p class="form-status" id="landingFormStatus" role="status" aria-live="polite"></p>
    </form>
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
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#fff;font-family:"BentonSansFB",Arial,Helvetica,sans-serif;line-height:1.55}img{display:block;max-width:100%}a{color:inherit}button,input{font:inherit}.shell{width:min(var(--shell),calc(100% - 40px));margin-inline:auto}.site-head{height:76px;display:flex;align-items:center;position:absolute;inset:0 0 auto;z-index:20;color:#fff}.site-head .shell{display:flex;align-items:center;justify-content:space-between;gap:24px}.site-logo{display:block;width:auto;max-width:210px;max-height:54px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border:0;border-radius:999px;font-weight:700;text-decoration:none;cursor:pointer}.button--primary{color:#fff;background:linear-gradient(100deg,var(--primary),var(--accent));box-shadow:0 12px 30px color-mix(in srgb,var(--primary) 28%,transparent)}.button--light{background:#fff;color:var(--primary)}.header-cta{min-height:42px;padding-inline:18px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.5);color:#fff}.hero{position:relative;min-height:720px;display:grid;align-items:end;background:#130b1a;color:#fff;overflow:hidden}.hero__image,.hero__shade{position:absolute;inset:0;width:100%;height:100%}.hero__image{object-fit:cover}.hero__shade{background:linear-gradient(90deg,rgba(11,5,18,.96) 0%,rgba(20,8,31,.82) 48%,rgba(20,8,31,.18) 100%)}.hero__content{position:relative;z-index:2;padding-block:150px 72px}.eyebrow{margin:0 0 13px;color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}.hero .eyebrow{color:#f1bce0}.hero h1,.section h2,.contact h2{margin:0;max-width:850px;font-size:clamp(38px,6vw,76px);line-height:.98;letter-spacing:-.045em}.hero__lead{max-width:700px;margin:24px 0 30px;font-size:clamp(18px,2vw,22px);color:#eee4f3}.facts{display:flex;flex-wrap:wrap;gap:10px;margin:36px 0 0;padding:0;list-style:none}.facts li{display:grid;gap:3px;min-width:190px;padding:14px 16px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(255,255,255,.08);backdrop-filter:blur(10px)}.facts small{text-transform:uppercase;letter-spacing:.1em;color:#d6c9dd}.section{padding:96px 0}.section--soft{background:var(--surface)}.section h2,.contact h2{font-size:clamp(34px,4.5vw,58px)}.section__head{max-width:760px;margin-bottom:38px}.section__head>p:last-child,.prose p{font-size:18px;color:#5f5865}.prose{max-width:900px}.feature-grid,.schedule-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.feature,.schedule-card{padding:28px;border:1px solid var(--line);border-radius:24px;background:#fff}.feature>span{color:var(--accent);font-size:13px;font-weight:700}.feature h3,.schedule-card h3{margin:10px 0 8px;font-size:24px}.feature p,.schedule-card p{margin:5px 0;color:#635c68}.cta-panel{display:flex;align-items:center;justify-content:space-between;gap:30px;padding:46px;border-radius:30px;background:linear-gradient(120deg,var(--primary),var(--secondary));color:#fff}.cta-panel h2{font-size:clamp(30px,4vw,50px)}.cta-panel .eyebrow{color:#f4c7e3}.faq{max-width:900px}.faq h2{margin-bottom:30px}.faq details{border-top:1px solid var(--line);padding:20px 0}.faq details:last-child{border-bottom:1px solid var(--line)}.faq summary{cursor:pointer;font-size:18px;font-weight:700}.faq details p{margin:12px 0 0;color:#625b67}.contact{padding:100px 0;background:#120b18;color:#fff}.contact__grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);gap:60px;align-items:start}.contact__grid>div>p:last-child{font-size:20px;color:#d6cadb}.lead-form{padding:30px;border-radius:26px;background:#fff;color:var(--ink)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.lead-form label{display:grid;gap:7px;font-size:13px;font-weight:700}.lead-form input{width:100%;height:48px;padding:0 13px;border:1px solid #d9d3de;border-radius:12px}.lead-form input:focus{outline:3px solid color-mix(in srgb,var(--primary) 18%,transparent);border-color:var(--primary)}.check{grid-template-columns:auto 1fr!important;align-items:start;margin:18px 0;font-weight:400!important}.check input{width:18px;height:18px}.check a{color:var(--primary)}.form-status{min-height:24px;margin:14px 0 0}.form-status.is-error{color:#a40032}.form-status.is-success{color:#116b3a}footer{padding:28px 0;background:#08050b;color:#d7cedb;text-align:center;font-size:13px}
    @media(max-width:760px){.shell{width:min(100% - 28px,var(--shell))}.site-head{height:68px}.site-logo{max-width:155px}.header-cta{font-size:13px;padding-inline:14px}.hero{min-height:680px}.hero__shade{background:linear-gradient(0deg,rgba(11,5,18,.98) 0%,rgba(20,8,31,.68) 72%,rgba(20,8,31,.35) 100%)}.hero__content{padding-block:120px 45px}.facts{display:grid;grid-template-columns:1fr}.facts li{min-width:0}.section{padding:70px 0}.feature-grid,.schedule-grid,.contact__grid,.form-grid{grid-template-columns:1fr}.contact__grid{gap:32px}.cta-panel{align-items:flex-start;flex-direction:column;padding:32px 24px}.lead-form{padding:22px}.contact{padding:72px 0}}
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
    var form=document.getElementById('landingLeadForm');
    if(!form)return;
    var status=document.getElementById('landingFormStatus');
    var config=JSON.parse(form.getAttribute('data-config')||'{}');
    form.addEventListener('submit',async function(event){
      event.preventDefault();
      var button=form.querySelector('button[type="submit"]');
      button.disabled=true;status.className='form-status';status.textContent='Enviando…';
      var values=new FormData(form);
      try{
        var response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
          nombres:String(values.get('nombres')||''),apellidos:String(values.get('apellidos')||''),celular:String(values.get('celular')||''),email:String(values.get('email')||''),
          optInMarketing:values.get('optInMarketing')==='on',acceptPrivacy:values.get('acceptPrivacy')==='on',courseSlug:config.courseSlug,courseTitle:config.courseTitle,pageUrl:window.location.href,whatsappArea:config.area
        })});
        var payload=await response.json().catch(function(){return {};});
        if(!response.ok)throw new Error(Array.isArray(payload.message)?payload.message.join(', '):(payload.message||'No se pudo enviar la información'));
        form.reset();status.className='form-status is-success';status.textContent='Gracias. Recibimos tu solicitud.';track('generate_lead',{programa:config.courseTitle});
      }catch(error){status.className='form-status is-error';status.textContent=error instanceof Error?error.message:'No se pudo enviar. Intenta nuevamente.';}
      finally{button.disabled=false;}
    });
    track('view_program',{programa:${scriptJson(text(heroTitle, 300))}});
  })();
  </script>
</body>
</html>`;
}
