/** URLs públicas de assets del widget educación (S3 mali-assets). */
export const EDUCACION_ASSET_URLS = {
  rectangulo:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/Rectangulo.png',
  whatsapp:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/WhatsApp.png',
  circulo:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/circulo.png',
  correo:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/correo.png',
  marker:
    'https://mali-assets.s3.us-east-1.amazonaws.com/assets-educacion/marker.png',
} as const;

export function resolveEducacionImage(
  value: string | null | undefined,
  key: keyof typeof EDUCACION_ASSET_URLS,
): string {
  return value?.trim() || EDUCACION_ASSET_URLS[key];
}
