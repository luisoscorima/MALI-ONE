export const ACCENT_STORAGE_KEY = 'mali-one-accent-theme';

export type AccentThemeId =
  | 'neutral'
  | 'amber'
  | 'terracotta'
  | 'emerald'
  | 'violet'
  | 'blue';

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

/** Colores decorativos del fondo del login (esmeralda, violeta, azul). */
export const loginAmbientColors = {
  emerald: accentThemes.find((t) => t.id === 'emerald')!.primary,
  violet: accentThemes.find((t) => t.id === 'violet')!.primary,
  blue: accentThemes.find((t) => t.id === 'blue')!.primary,
} as const;

export function getAccentTheme(id: AccentThemeId): AccentTheme {
  return accentThemes.find((t) => t.id === id) ?? accentThemes[0];
}

export function isAccentThemeId(value: string): value is AccentThemeId {
  return accentThemes.some((t) => t.id === value);
}

export function readStoredAccentTheme(): AccentThemeId {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored && isAccentThemeId(stored)) return stored;
  } catch {
    /* localStorage no disponible */
  }
  return defaultAccentThemeId;
}

export function applyLoginAmbientColors() {
  const root = document.documentElement;
  root.style.setProperty('--login-ambient-emerald', loginAmbientColors.emerald);
  root.style.setProperty('--login-ambient-violet', loginAmbientColors.violet);
  root.style.setProperty('--login-ambient-blue', loginAmbientColors.blue);
}

export function applyAccentTheme(id: AccentThemeId) {
  const theme = getAccentTheme(id);
  const root = document.documentElement;
  root.dataset.accent = id;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-foreground', theme.primaryForeground);
  root.style.setProperty('--ring', theme.primary);
  root.style.setProperty('--sidebar-primary', theme.primary);
  root.style.setProperty('--sidebar-primary-foreground', theme.primaryForeground);
  root.style.setProperty('--sidebar-ring', theme.primary);
  root.style.setProperty('--chart-1', theme.primary);
}
