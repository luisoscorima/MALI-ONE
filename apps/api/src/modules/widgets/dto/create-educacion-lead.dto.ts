import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const EDUCACION_WHATSAPP_AREAS = [
  'educacion_ep',
  'educacion_ca',
] as const;

export class CreateEducacionLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombres!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  apellidos!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(20)
  dni!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  celular!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsBoolean()
  optInMarketing!: boolean;

  @IsBoolean()
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
  @MaxLength(500)
  pageUrl?: string;

  @IsOptional()
  @IsIn([...EDUCACION_WHATSAPP_AREAS])
  whatsappArea?: (typeof EDUCACION_WHATSAPP_AREAS)[number];
}
