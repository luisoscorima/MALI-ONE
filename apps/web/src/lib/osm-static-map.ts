export function osmStaticMapUrl(lat: number, lng: number, size = 96): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=${size}x${size}&markers=${lat},${lng},red-pushpin`;
}
