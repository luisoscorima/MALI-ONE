/** Vista embebida de Google Maps (misma familia que la vista previa del widget). */
export function googleEmbedMapUrl(lat: number, lng: number, zoom = 15): string {
  const params = new URLSearchParams({
    q: `${lat},${lng}`,
    hl: 'es',
    z: String(zoom),
    output: 'embed',
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}
