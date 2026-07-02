/** Iconos Material Icons curados para sedes del selector. */
export const SELECTOR_SEDE_ICONS = [
  { id: 'museum', label: 'Museo' },
  { id: 'palette', label: 'Arte' },
  { id: 'school', label: 'Educación' },
  { id: 'menu_book', label: 'Cursos' },
  { id: 'language', label: 'Virtual' },
  { id: 'location_on', label: 'Sede' },
  { id: 'computer', label: 'Tecnología' },
  { id: 'theater_comedy', label: 'Cultura' },
  { id: 'groups', label: 'Comunidad' },
  { id: 'brush', label: 'Talleres' },
] as const;

export type SelectorSedeIconId = (typeof SELECTOR_SEDE_ICONS)[number]['id'];

export function isKnownSelectorIcon(icon: string): icon is SelectorSedeIconId {
  return SELECTOR_SEDE_ICONS.some((item) => item.id === icon);
}
