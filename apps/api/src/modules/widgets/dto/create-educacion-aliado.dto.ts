import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const EDUCACION_ALIADO_CATEGORIAS = [
  'patrocinador',
  'auspiciador',
  'aliado',
  'socio',
] as const;

export class CreateEducacionAliadoDto {
  @IsString()
  nombre!: string;

  @IsString()
  imageUrl!: string;

  @IsString()
  @IsIn([...EDUCACION_ALIADO_CATEGORIAS])
  categoria!: string;

  @IsOptional()
  @IsString()
  url?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateEducacionAliadoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn([...EDUCACION_ALIADO_CATEGORIAS])
  categoria?: string;

  @IsOptional()
  @IsString()
  url?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
