import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  QrBodyShape,
  QrEyeFrameShape,
  QrEyeShape,
  QrLogoPresetId,
} from '@mali-one/shared';

class QrGradientStopDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  offset!: number;

  @IsString()
  color!: string;
}

class QrGradientDto {
  @IsIn(['linear', 'radial'])
  type!: 'linear' | 'radial';

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QrGradientStopDto)
  colorStops!: QrGradientStopDto[];
}

export class UpdateQrStyleDto {
  @IsOptional()
  @IsString()
  foregroundColor?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QrGradientDto)
  foregroundGradient?: QrGradientDto | null;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsIn([
    'square',
    'dots',
    'rounded',
    'extra-rounded',
    'classy',
    'classy-rounded',
  ])
  bodyShape?: QrBodyShape;

  @IsOptional()
  @IsIn(['square', 'dot', 'extra-rounded'])
  eyeFrameShape?: QrEyeFrameShape;

  @IsOptional()
  @IsIn(['square', 'dot'])
  eyeShape?: QrEyeShape;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(0.45)
  logoSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(32)
  margin?: number;

  @IsOptional()
  @IsIn([
    'whatsapp_texto',
    'educacion',
    'cuadrado_texto',
    'cuadrado',
    'blanco',
    null,
  ])
  logoPreset?: QrLogoPresetId | null;

  @IsOptional()
  clearCustomLogo?: boolean;
}
