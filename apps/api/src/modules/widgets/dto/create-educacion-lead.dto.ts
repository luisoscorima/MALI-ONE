import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const EDUCACION_WHATSAPP_AREAS = [
  'educacion_ep',
  'educacion_ca',
] as const;

export const EDUCACION_LEAD_CAPTURE_SOURCES = [
  'wordpress_widget',
  'landing',
] as const;

function emptyToUndefined({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class CreateEducacionLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombres!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  apellidos!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, v) => v != null)
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  dni?: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  celular!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, v) => v != null)
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsBoolean()
  optInMarketing!: boolean;

  @IsBoolean()
  @Equals(true, { message: 'Debes aceptar las políticas de privacidad' })
  acceptPrivacy!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  courseSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  courseTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  pageUrl?: string;

  @IsOptional()
  @IsIn([...EDUCACION_LEAD_CAPTURE_SOURCES])
  captureSource?: (typeof EDUCACION_LEAD_CAPTURE_SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmCampaign?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  utmTerm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  gclid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fbclid?: string;

  @IsOptional()
  @IsIn([...EDUCACION_WHATSAPP_AREAS])
  whatsappArea?: (typeof EDUCACION_WHATSAPP_AREAS)[number];
}
