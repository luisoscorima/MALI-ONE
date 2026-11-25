const LINK_ATTR = 'data-mali-material-icons';

/** Inject Material Icons stylesheet once (widgets/editors that need glyph names). */
export function ensureMaterialIcons(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[${LINK_ATTR}]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  link.setAttribute(LINK_ATTR, '1');
  document.head.appendChild(link);
}
