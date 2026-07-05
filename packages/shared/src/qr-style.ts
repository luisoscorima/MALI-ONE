import type { QrLogoPresetId } from './qr-logo-presets';

export type QrBodyShape =
  | 'square'
  | 'dots'
  | 'rounded'
  | 'extra-rounded'
  | 'classy'
  | 'classy-rounded';

export type QrEyeFrameShape = 'square' | 'dot' | 'extra-rounded';
export type QrEyeShape = 'square' | 'dot';

export interface QrStyleDto {
  foregroundColor?: string;
  foregroundGradient?: {
    type: 'linear' | 'radial';
    rotation?: number;
    colorStops: { offset: number; color: string }[];
  };
  backgroundColor?: string;
  bodyShape: QrBodyShape;
  eyeFrameShape: QrEyeFrameShape;
  eyeShape: QrEyeShape;
  logoSize?: number;
  margin?: number;
  logoPreset?: QrLogoPresetId | null;
}

export const DEFAULT_QR_STYLE: QrStyleDto = {
  foregroundColor: '#000000',
  backgroundColor: '#ffffff',
  bodyShape: 'dots',
  eyeFrameShape: 'extra-rounded',
  eyeShape: 'dot',
  logoPreset: 'cuadrado',
  logoSize: 0.25,
  margin: 8,
};

export interface LinkStatsDto {
  totalClicks: number;
  clicksByDay: { date: string; count: number }[];
  devices: { type: string; count: number }[];
  browsers: { name: string; count: number }[];
  operatingSystems: { name: string; count: number }[];
}
