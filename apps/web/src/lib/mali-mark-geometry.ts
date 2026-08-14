export const MALI_MARK_VIEW_BOX = '54 54 576 576';

/** Fondo navy original del icono glassmorphism. */
export const MALI_MARK_NAVY = {
  inner: '#101d5a',
  mid: '#071337',
  outer: '#020615',
} as const;

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

export function maliMarkAccentFillMarkup(fill: string) {
  const paths = maliMarkPanelPaths
    .map((panel) => `<path d="${panel.d}" transform="${panel.transform}"/>`)
    .join('');
  return `<g fill="${fill}" stroke="${fill}" stroke-width="2.2" stroke-linejoin="round">${paths}</g>`;
}
