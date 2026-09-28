import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

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
