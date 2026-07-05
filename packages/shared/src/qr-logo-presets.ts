export type QrLogoPresetId =
  | 'whatsapp_texto'
  | 'educacion'
  | 'cuadrado_texto'
  | 'cuadrado'
  | 'blanco';

export const QR_LOGO_PRESETS: Record<
  QrLogoPresetId,
  { label: string; url: string; hint?: string }
> = {
  whatsapp_texto: {
    label: 'MALI WhatsApp',
    url: 'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Whatsapp_Texto.png',
  },
  educacion: {
    label: 'MALI Educación',
    url: 'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Educacion.png',
    hint: 'Logo blanco; ideal sobre fondo oscuro o QR con color de marca',
  },
  cuadrado_texto: {
    label: 'MALI cuadrado con texto',
    url: 'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Cuadrado_Texto.png',
  },
  cuadrado: {
    label: 'MALI cuadrado',
    url: 'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Cuadrado.png',
    hint: 'Recomendado como preset por defecto (formato cuadrado)',
  },
  blanco: {
    label: 'MALI blanco',
    url: 'https://mali-assets.s3.us-east-1.amazonaws.com/assets-web-mali/Logo_MALI_Blanco.png',
    hint: 'Solo legible sobre QR oscuro o con padding/fondo detrás del logo',
  },
};
