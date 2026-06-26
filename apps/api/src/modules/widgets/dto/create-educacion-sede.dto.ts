import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateEducacionSedeDto {
  @IsString()
  slug!: string;

  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  horarioHtml?: string;

  @IsString()
  brochureUrl!: string;

  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsBoolean()
  showOnMap?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateEducacionSedeDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  horarioHtml?: string;

  @IsOptional()
  @IsString()
  brochureUrl?: string;

  @IsOptional()
  @IsString()
  districtId?: string | null;

  @IsOptional()
  @IsBoolean()
  showOnMap?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
