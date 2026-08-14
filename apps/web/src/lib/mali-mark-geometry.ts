export const MALI_MARK_VIEW_BOX = '54 54 576 576';

/** Fondo navy original del icono glassmorphism. */
export const MALI_MARK_NAVY = {
  inner: '#101d5a',
  mid: '#071337',
  outer: '#020615',
  orbBlue: '#087dff',
  orbViolet: '#8a2dff',
} as const;

export type MaliGlassPalette = {
  glass: readonly [string, string, string, string];
  edge: readonly [string, string, string, string];
  letter: readonly [string, string, string];
  glowPanel: string;
  glowLetter: string;
};

/** Vidrio original: cyan → magenta. */
export const MALI_GLASS_ORIGINAL: MaliGlassPalette = {
  glass: ['#35d8ff', '#a9c8ff', '#8879ff', '#cf5fff'],
  edge: ['#3ce6ff', '#d8f3ff', '#aeb5ff', '#d663ff'],
  letter: ['#ffffff', '#dbe8ff', '#a996ff'],
  glowPanel: '#3a78ff',
  glowLetter: '#74a9ff',
};

export const maliGlassPalettes: Record<string, MaliGlassPalette> = {
  neutral: MALI_GLASS_ORIGINAL,
  amber: {
    glass: ['#ffd56a', '#ffe4a8', '#e8a03c', '#ff8a3a'],
    edge: ['#ffe9a8', '#fff6dc', '#f0c36a', '#e8943a'],
    letter: ['#ffffff', '#fff1cc', '#e8c47a'],
    glowPanel: '#d4a853',
    glowLetter: '#f0c36a',
  },
  terracotta: {
    glass: ['#ff8f6a', '#ffb499', '#d4684a', '#e85a78'],
    edge: ['#ffc4b0', '#ffe8e0', '#e08a70', '#c45a6a'],
    letter: ['#ffffff', '#ffd8cc', '#e89a82'],
    glowPanel: '#c4684a',
    glowLetter: '#e08a70',
  },
  emerald: {
    glass: ['#5ee9b5', '#a8f5d4', '#34d399', '#2dd4c7'],
    edge: ['#9ff5d4', '#e6fff5', '#5ee9c0', '#22c3a6'],
    letter: ['#ffffff', '#d1fae5', '#6ee7b7'],
    glowPanel: '#34d399',
    glowLetter: '#6ee7b7',
  },
  violet: {
    glass: ['#c4b5fd', '#ddd6fe', '#a78bfa', '#e879f9'],
    edge: ['#ddd6fe', '#f5f3ff', '#c4b5fd', '#d946ef'],
    letter: ['#ffffff', '#ede9fe', '#c4b5fd'],
    glowPanel: '#a78bfa',
    glowLetter: '#c4b5fd',
  },
  blue: {
    glass: ['#60a5fa', '#93c5fd', '#3b82f6', '#818cf8'],
    edge: ['#93c5fd', '#dbeafe', '#60a5fa', '#6366f1'],
    letter: ['#ffffff', '#dbeafe', '#93c5fd'],
    glowPanel: '#3b82f6',
    glowLetter: '#60a5fa',
  },
};

export function getMaliGlassPalette(id: string): MaliGlassPalette {
  return maliGlassPalettes[id] ?? MALI_GLASS_ORIGINAL;
}

export function applyMaliGlassCssVars(palette: MaliGlassPalette) {
  const root = document.documentElement;
  palette.glass.forEach((color, index) => {
    root.style.setProperty(`--mali-glass-${index}`, color);
  });
  palette.edge.forEach((color, index) => {
    root.style.setProperty(`--mali-edge-${index}`, color);
  });
  palette.letter.forEach((color, index) => {
    root.style.setProperty(`--mali-letter-${index}`, color);
  });
  root.style.setProperty('--mali-glow-panel', palette.glowPanel);
  root.style.setProperty('--mali-glow-letter', palette.glowLetter);
}

export function recolorFaviconGlass(svg: string, palette: MaliGlassPalette) {
  const original = MALI_GLASS_ORIGINAL;
  const replacements: [string, string][] = [
    [original.glass[0], palette.glass[0]],
    [original.glass[1], palette.glass[1]],
    [original.glass[2], palette.glass[2]],
    [original.glass[3], palette.glass[3]],
    [original.edge[0], palette.edge[0]],
    [original.edge[1], palette.edge[1]],
    [original.edge[2], palette.edge[2]],
    [original.edge[3], palette.edge[3]],
    [original.letter[1], palette.letter[1]],
    [original.letter[2], palette.letter[2]],
    [original.glowPanel, palette.glowPanel],
    [original.glowLetter, palette.glowLetter],
  ];
  return replacements.reduce(
    (result, [from, to]) => result.replaceAll(from, to),
    svg,
  );
}

export function maliMarkNavyGradientMarkup(id: string) {
  return `<radialGradient id="${id}" cx="50%" cy="45%" r="72%">
    <stop offset="0" stop-color="${MALI_MARK_NAVY.inner}"/>
    <stop offset="0.52" stop-color="${MALI_MARK_NAVY.mid}"/>
    <stop offset="1" stop-color="${MALI_MARK_NAVY.outer}"/>
  </radialGradient>`;
}

export function maliMarkNavyBackdropMarkup(gradientId: string) {
  return `<rect x="54" y="54" width="576" height="576" fill="url(#${gradientId})"/>
    <ellipse cx="175" cy="472" rx="210" ry="205" fill="${MALI_MARK_NAVY.orbBlue}" opacity=".09"/>
    <ellipse cx="554" cy="197" rx="190" ry="185" fill="${MALI_MARK_NAVY.orbViolet}" opacity=".08"/>`;
}

export const maliMarkPanelPaths = [
  {
    d: 'M 155.699,137.972 H 60.941 v 237.175 h 94.758 z',
    transform: 'matrix(1.3333333,0,0,-1.3333333,0,684.16)',
  },
  {
    d: 'm 0,0 -118.588,-205.399 -82.062,47.378 118.587,205.4 z',
    transform: 'matrix(1.3333333,0,0,-1.3333333,475.13267,236.7332)',
  },
  {
    d: 'm 451.107,137.972 h -94.758 v 237.175 h 94.758 z',
    transform: 'matrix(1.3333333,0,0,-1.3333333,0,684.16)',
  },
] as const;
