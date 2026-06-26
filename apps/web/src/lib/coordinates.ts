export function formatCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return '';
  }
  return `${lat}, ${lng}`;
}

export function parseCoordinates(value: string): {
  lat: number | null;
  lng: number | null;
} {
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length < 2) return { lat: null, lng: null };
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null };
  }
  return { lat, lng };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
