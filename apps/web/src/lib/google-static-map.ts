export function googleStaticMapUrl(
  lat: number,
  lng: number,
  apiKey: string,
  size = '80x96',
): string {
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '15',
    size,
    markers: `color:0x702082|${lat},${lng}`,
    key: apiKey.trim(),
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
