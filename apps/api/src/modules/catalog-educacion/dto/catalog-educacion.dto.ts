import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const EDUCACION_CRM_AREAS = [
  'educacion',
  'educacion_ca',
  'educacion_ep',
] as const;

export class CreateEducacionLeadStatusDto {
  @IsIn(EDUCACION_CRM_AREAS)
  area!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_terminal?: boolean;
}

export class UpdateEducacionLeadStatusDto {
  @IsIn(EDUCACION_CRM_AREAS)
  area!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_terminal?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpsertEducacionOfertaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nombre!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  descuento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  horario?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  areaId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cursoIds?: string[];
}

export class UpsertEducacionAreaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nombre!: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsIn(['educacion_ca', 'educacion_ep'])
  whatsappArea?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpsertEducacionDistrictDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brochureUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

export class UpsertEducacionSedeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  direccion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  brochureUrl?: string | null;

  @IsOptional()
  @IsString()
  districtId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @IsOptional()
  @IsString()
  horarioHtml?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number | null;

  @IsOptional()
  @IsBoolean()
  showOnSelector?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnMap?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}
