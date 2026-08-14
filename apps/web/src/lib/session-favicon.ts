const FAVICON_SESSION_KEY = 'mali-one-favicon-palette';
const LOGO_URL = '/icons/logo-mali.png';

/** Paletas vivas para el fondo glass del favicon (por sesión). */
const FAVICON_PALETTES: readonly [string, string, string][] = [
  ['#34d399', '#a78bfa', '#3b82f6'],
  ['#f472b6', '#fb923c', '#facc15'],
  ['#22d3ee', '#818cf8', '#c084fc'],
  ['#4ade80', '#2dd4bf', '#38bdf8'],
  ['#fb7185', '#e879f9', '#a78bfa'],
  ['#fbbf24', '#f97316', '#ef4444'],
  ['#2dd4bf', '#34d399', '#a3e635'],
  ['#60a5fa', '#c084fc', '#f472b6'],
  ['#f43f5e', '#a855f7', '#06b6d4'],
  ['#84cc16', '#14b8a6', '#6366f1'],
];

type FaviconPalette = [string, string, string];

function isFaviconPalette(value: unknown): value is FaviconPalette {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
  );
}

function pickRandomPalette(): FaviconPalette {
  const index = Math.floor(Math.random() * FAVICON_PALETTES.length);
  return [...FAVICON_PALETTES[index]] as FaviconPalette;
}

function readOrCreateSessionPalette(): FaviconPalette {
  try {
    const raw = sessionStorage.getItem(FAVICON_SESSION_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isFaviconPalette(parsed)) return parsed;
    }
  } catch {
    /* sessionStorage no disponible */
  }

  const palette = pickRandomPalette();
  try {
    sessionStorage.setItem(FAVICON_SESSION_KEY, JSON.stringify(palette));
  } catch {
    /* ignore */
  }
  return palette;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}

function drawGlassFavicon(
  size: number,
  palette: FaviconPalette,
  logo: HTMLImageElement,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '/favicon.png';

  const radius = size * 0.2;
  roundRect(ctx, 0, 0, size, size, radius);
  ctx.clip();

  // Base oscura
  ctx.fillStyle = '#0c1016';
  ctx.fillRect(0, 0, size, size);

  // Orbes de color (degradados vivos)
  const orbs: Array<{ x: number; y: number; r: number; color: string }> = [
    { x: size * 0.15, y: size * 0.1, r: size * 0.55, color: palette[0] },
    { x: size * 0.85, y: size * 0.25, r: size * 0.5, color: palette[1] },
    { x: size * 0.45, y: size * 0.9, r: size * 0.55, color: palette[2] },
  ];

  for (const orb of orbs) {
    const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
    g.addColorStop(0, hexToRgba(orb.color, 0.85));
    g.addColorStop(0.55, hexToRgba(orb.color, 0.28));
    g.addColorStop(1, hexToRgba(orb.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Capa glass
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  roundRect(ctx, size * 0.06, size * 0.06, size * 0.88, size * 0.88, size * 0.16);
  ctx.fill();

  // Highlight superior
  const highlight = ctx.createLinearGradient(0, size * 0.06, 0, size * 0.42);
  highlight.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
  highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = highlight;
  roundRect(ctx, size * 0.08, size * 0.08, size * 0.84, size * 0.32, size * 0.12);
  ctx.fill();

  // Borde glass
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = Math.max(1, size * 0.03);
  roundRect(ctx, size * 0.06, size * 0.06, size * 0.88, size * 0.88, size * 0.16);
  ctx.stroke();

  // Logo centrado
  const pad = size * 0.16;
  const maxW = size - pad * 2;
  const maxH = size - pad * 2;
  const scale = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
  const w = logo.naturalWidth * scale;
  const h = logo.naturalHeight * scale;
  const x = (size - w) / 2;
  const y = (size - h) / 2;
  ctx.drawImage(logo, x, y, w, h);

  return canvas.toDataURL('image/png');
}

function setFaviconHref(href: string) {
  const head = document.head;
  let link =
    head.querySelector<HTMLLinkElement>('link[rel="icon"][data-mali-session-favicon]') ??
    head.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    head.appendChild(link);
  }

  link.setAttribute('data-mali-session-favicon', '1');
  link.type = 'image/png';
  link.href = href;
}

/**
 * Aplica un favicon glassmorphism cuyo fondo cambia de paleta en cada sesión
 * del navegador (sessionStorage).
 */
export async function applySessionFavicon() {
  if (typeof document === 'undefined') return;

  const palette = readOrCreateSessionPalette();

  try {
    const logo = await loadImage(LOGO_URL);
    const href = drawGlassFavicon(64, palette, logo);
    setFaviconHref(href);
  } catch {
    setFaviconHref('/favicon.png');
  }
}
