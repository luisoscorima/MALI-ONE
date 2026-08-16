import {
  applyMaliGlassCssVars,
  buildMaliGlassPaletteFromHex,
  getMaliGlassPalette,
  maliMarkNavyBackdropMarkup,
  maliMarkNavyGradientMarkup,
  recolorFaviconGlass,
  MALI_MARK_NAVY,
  type MaliGlassPalette,
} from '@/lib/mali-mark-geometry';
import {
  isAccentHex,
  isAccentThemeId,
  isValidAccentTheme,
  type AccentThemeId,
} from '@mali-one/shared';

export const ACCENT_STORAGE_KEY = 'mali-one-accent-theme';
export const ACCENT_CUSTOM_STORAGE_KEY = 'mali-one-accent-custom';

export type { AccentThemeId };
export type AccentThemeValue = string;

export type AccentTheme = {
  id: AccentThemeId;
  label: string;
  swatch: string;
  primary: string;
  primaryForeground: string;
};

export const accentThemes: AccentTheme[] = [
  {
    id: 'neutral',
    label: 'Neutro',
    swatch: '#f4f4f5',
    primary: '#f4f4f5',
    primaryForeground: '#0f1419',
  },
  {
    id: 'amber',
    label: 'Ámbar',
    swatch: '#d4a853',
    primary: '#d4a853',
    primaryForeground: '#1a1408',
  },
  {
    id: 'terracotta',
    label: 'Terracota',
    swatch: '#c4684a',
    primary: '#c4684a',
    primaryForeground: '#ffffff',
  },
  {
    id: 'emerald',
    label: 'Esmeralda',
    swatch: '#34d399',
    primary: '#34d399',
    primaryForeground: '#052e1a',
  },
  {
    id: 'violet',
    label: 'Violeta',
    swatch: '#a78bfa',
    primary: '#a78bfa',
    primaryForeground: '#1e1033',
  },
  {
    id: 'blue',
    label: 'Azul',
    swatch: '#3b82f6',
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
  },
];

export const defaultAccentThemeId: AccentThemeId = 'neutral';
export const defaultCustomAccentHex = '#3b82f6';

const APP_BACKGROUND = '#0f1419';

function hexToRgb(hex: string) {
  const raw = hex.replace('#', '');
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

/** Texto legible sobre el color de acento (WCAG relative luminance). */
export function contrastForeground(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  return L > 0.45 ? '#0f1419' : '#ffffff';
}

function normalizeHex(value: string): string {
  return value.toLowerCase();
}

export function getAccentTheme(id: AccentThemeId): AccentTheme {
  return accentThemes.find((t) => t.id === id) ?? accentThemes[0];
}

export { isAccentThemeId, isAccentHex, isValidAccentTheme };

export function resolveAccentColors(value: AccentThemeValue): {
  primary: string;
  primaryForeground: string;
  palette: MaliGlassPalette;
  datasetAccent: string;
  themeColor: string;
} {
  if (isAccentThemeId(value)) {
    const theme = getAccentTheme(value);
    return {
      primary: theme.primary,
      primaryForeground: theme.primaryForeground,
      palette: getMaliGlassPalette(value),
      datasetAccent: value,
      themeColor: value === 'neutral' ? APP_BACKGROUND : theme.primary,
    };
  }

  const primary = normalizeHex(value);
  return {
    primary,
    primaryForeground: contrastForeground(primary),
    palette: buildMaliGlassPaletteFromHex(primary),
    datasetAccent: 'custom',
    themeColor: primary,
  };
}

function applyThemeColorMeta(themeColor: string) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', themeColor);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}

let faviconGeneration = 0;

function applyThemedFavicon(palette: MaliGlassPalette) {
  const generation = ++faviconGeneration;
  void fetch('/favicon.svg')
    .then((response) => response.text())
    .then((svgText) => {
      const composed = recolorFaviconGlass(svgText, palette).replace(
        '</defs>',
        `${maliMarkNavyGradientMarkup('mark-navy')}</defs>${maliMarkNavyBackdropMarkup('mark-navy')}`,
      );
      const blob = new Blob([composed], { type: 'image/svg+xml' });
      return loadImage(URL.createObjectURL(blob)).then((mark) => {
        URL.revokeObjectURL(mark.src);
        return mark;
      });
    })
    .then((mark) => {
      if (generation !== faviconGeneration) return;
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, size * 0.22);
      ctx.clip();
      const navy = ctx.createRadialGradient(
        size * 0.5,
        size * 0.45,
        0,
        size * 0.5,
        size * 0.45,
        size * 0.72,
      );
      navy.addColorStop(0, MALI_MARK_NAVY.inner);
      navy.addColorStop(0.52, MALI_MARK_NAVY.mid);
      navy.addColorStop(1, MALI_MARK_NAVY.outer);
      ctx.fillStyle = navy;
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(mark, 0, 0, size, size);

      const href = canvas.toDataURL('image/png');
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
        link.type = 'image/png';
        link.removeAttribute('sizes');
        link.href = href;
      });
    });
}

/** Colores decorativos del fondo del login (esmeralda, violeta, azul). */
export const loginAmbientColors = {
  emerald: accentThemes.find((t) => t.id === 'emerald')!.primary,
  violet: accentThemes.find((t) => t.id === 'violet')!.primary,
  blue: accentThemes.find((t) => t.id === 'blue')!.primary,
} as const;

export function readStoredAccentTheme(): AccentThemeValue {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored && isValidAccentTheme(stored)) {
      return isAccentHex(stored) ? normalizeHex(stored) : stored;
    }
  } catch {
    /* localStorage no disponible */
  }
  return defaultAccentThemeId;
}

export function readStoredCustomAccentHex(): string {
  try {
    const stored = localStorage.getItem(ACCENT_CUSTOM_STORAGE_KEY);
    if (stored && isAccentHex(stored)) return normalizeHex(stored);
  } catch {
    /* ignore */
  }
  return defaultCustomAccentHex;
}

export function persistCustomAccentHex(hex: string) {
  try {
    localStorage.setItem(ACCENT_CUSTOM_STORAGE_KEY, normalizeHex(hex));
  } catch {
    /* ignore */
  }
}

export function applyLoginAmbientColors() {
  const root = document.documentElement;
  root.style.setProperty('--login-ambient-emerald', loginAmbientColors.emerald);
  root.style.setProperty('--login-ambient-violet', loginAmbientColors.violet);
  root.style.setProperty('--login-ambient-blue', loginAmbientColors.blue);
}

export function applyAccentTheme(value: AccentThemeValue) {
  const resolved = resolveAccentColors(value);
  const root = document.documentElement;
  root.dataset.accent = resolved.datasetAccent;
  root.style.setProperty('--primary', resolved.primary);
  root.style.setProperty('--primary-foreground', resolved.primaryForeground);
  root.style.setProperty('--ring', resolved.primary);
  root.style.setProperty('--sidebar-primary', resolved.primary);
  root.style.setProperty('--sidebar-primary-foreground', resolved.primaryForeground);
  root.style.setProperty('--sidebar-ring', resolved.primary);
  root.style.setProperty('--chart-1', resolved.primary);
  applyThemeColorMeta(resolved.themeColor);
  applyMaliGlassCssVars(resolved.palette);
  applyThemedFavicon(resolved.palette);
}
